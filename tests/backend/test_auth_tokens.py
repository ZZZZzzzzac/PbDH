import io
import json
import time
from urllib.error import HTTPError, URLError

import jwt
import pytest

from pbdh_backend.api_errors import ApiError
from pbdh_backend.identity.tokens import SupabaseJwtVerifier


def verifier_and_token():
    secret = "test-secret-for-hmac-sha256-at-least-32-bytes"
    verifier = SupabaseJwtVerifier("https://example.supabase.co", shared_secret=secret, anon_key="test-public-key")
    token = jwt.encode({"sub": "test-subject", "aud": "authenticated", "iss": verifier.issuer, "exp": time.time() + 60}, secret, algorithm="HS256")
    return verifier, token


def test_only_session_claim_checks_auth_server_liveness(monkeypatch):
    verifier, token = verifier_and_token()
    requests = []

    def respond(request, *, timeout):
        requests.append(request)
        assert timeout == 8
        return io.BytesIO(json.dumps({"id": "test-subject"}).encode())

    monkeypatch.setattr("pbdh_backend.identity.tokens.urlopen", respond)
    assert verifier.verify(token).subject == "test-subject"
    assert requests == []
    assert verifier.verify(token, require_live_session=True).subject == "test-subject"
    assert requests[0].full_url == "https://example.supabase.co/auth/v1/user"
    assert requests[0].get_header("Apikey") == "test-public-key"


@pytest.mark.parametrize("status", [401, 403, 429, 500])
def test_revoked_or_unavailable_auth_fails_closed_without_exposing_upstream(monkeypatch, status):
    verifier, token = verifier_and_token()

    def fail(*args, **kwargs):
        raise HTTPError("https://example.supabase.co/auth/v1/user", status, "private-upstream-error", {}, None)

    monkeypatch.setattr("pbdh_backend.identity.tokens.urlopen", fail)
    with pytest.raises(ApiError) as result:
        verifier.verify(token, require_live_session=True)
    assert "private-upstream-error" not in str(result.value)
    assert result.value.code == ("AUTH_TOKEN_INVALID" if status in (401, 403) else "AUTH_SERVICE_UNAVAILABLE")


def test_network_failure_does_not_accept_locally_valid_token(monkeypatch):
    verifier, token = verifier_and_token()

    def fail(*args, **kwargs):
        raise URLError("network")

    monkeypatch.setattr("pbdh_backend.identity.tokens.urlopen", fail)
    with pytest.raises(ApiError) as result:
        verifier.verify(token, require_live_session=True)
    assert result.value.code == "AUTH_SERVICE_UNAVAILABLE"
