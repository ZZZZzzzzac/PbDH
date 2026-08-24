from pathlib import Path

from fastapi.testclient import TestClient

from pbdh_backend.api_errors import ApiError
from pbdh_backend.app import create_app
from pbdh_backend.identity.tokens import VerifiedIdentity
from pbdh_backend.settings import Settings


class FakeTokenVerifier:
    def verify(self, token: str) -> VerifiedIdentity:
        if not token.startswith("token:"):
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效或已过期。")
        return VerifiedIdentity(token.removeprefix("token:"))


def settings(tmp_path: Path, *, configured: bool = True) -> Settings:
    return Settings(
        database_path=tmp_path / "pbdh.sqlite3",
        migrations_path=Path(__file__).parents[2] / "apps" / "backend" / "migrations",
        supabase_url="https://example.supabase.co" if configured else None,
        supabase_anon_key="public-anon-key" if configured else None,
        admin_auth_subject="subject-admin",
    )


def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(settings(tmp_path), FakeTokenVerifier()))


def bearer(subject: str) -> dict[str, str]:
    return {"Authorization": f"Bearer token:{subject}"}


def claim(
    api: TestClient,
    subject: str,
    *,
    current_session_id: str | None = None,
    replace_existing: bool = False,
):
    return api.post(
        "/api/auth/session/claim",
        headers=bearer(subject),
        json={
            "currentSessionId": current_session_id,
            "replaceExisting": replace_existing,
        },
    )


def test_unconfigured_auth_keeps_public_health_available(tmp_path: Path) -> None:
    api = TestClient(create_app(settings(tmp_path, configured=False)))

    assert api.get("/api/health").json() == {
        "status": "ok",
        "service": "pbdh-platform-api",
    }
    assert api.get("/api/auth/config").json() == {"configured": False}
    response = api.post("/api/auth/session/claim", json={})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_NOT_CONFIGURED"


def test_claims_roleless_normal_and_configured_admin_accounts(tmp_path: Path) -> None:
    api = client(tmp_path)

    normal = claim(api, "subject-normal")
    admin = claim(api, "subject-admin")

    assert normal.status_code == 200
    assert normal.json()["profile"] == {
        "accountId": normal.json()["profile"]["accountId"],
        "username": None,
        "isAdmin": False,
    }
    assert admin.json()["profile"]["isAdmin"] is True
    assert "role" not in normal.json()["profile"]
    assert "email" not in normal.json()["profile"]


def test_requires_explicit_replacement_and_invalidates_old_session(tmp_path: Path) -> None:
    api = client(tmp_path)
    first = claim(api, "subject-one").json()

    refused = claim(api, "subject-one")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "AUTH_SESSION_REPLACEMENT_REQUIRED"

    replacement = claim(api, "subject-one", replace_existing=True)
    assert replacement.status_code == 200
    assert replacement.json()["replacedExisting"] is True
    assert replacement.json()["sessionId"] != first["sessionId"]

    old = api.get(
        "/api/auth/me",
        headers={**bearer("subject-one"), "X-PbDH-Session": first["sessionId"]},
    )
    assert old.status_code == 401
    assert old.json()["error"]["code"] == "AUTH_SESSION_REPLACED"

    current = api.get(
        "/api/auth/me",
        headers={
            **bearer("subject-one"),
            "X-PbDH-Session": replacement.json()["sessionId"],
        },
    )
    assert current.status_code == 200


def test_reuses_current_session_without_replacement(tmp_path: Path) -> None:
    api = client(tmp_path)
    first = claim(api, "subject-one").json()

    repeated = claim(
        api, "subject-one", current_session_id=first["sessionId"]
    ).json()

    assert repeated["sessionId"] == first["sessionId"]
    assert repeated["replacedExisting"] is False


def test_username_is_normalized_unique_and_never_accepts_client_identity(tmp_path: Path) -> None:
    api = client(tmp_path)
    first = claim(api, "subject-one").json()
    second = claim(api, "subject-two").json()

    first_update = api.put(
        "/api/auth/profile/username",
        headers={
            **bearer("subject-one"),
            "X-PbDH-Session": first["sessionId"],
        },
        json={"username": "  测试用户  "},
    )
    assert first_update.json()["profile"]["username"] == "测试用户"

    duplicate = api.put(
        "/api/auth/profile/username",
        headers={
            **bearer("subject-two"),
            "X-PbDH-Session": second["sessionId"],
        },
        json={"username": "测试用户"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "USERNAME_TAKEN"


def test_migration_has_no_role_or_email_columns(tmp_path: Path) -> None:
    api = client(tmp_path)
    claim(api, "subject-one")
    repository = api.app.state.identity_repository

    with repository.database.connect() as connection:
        columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(accounts)")
        }
        session_indexes = list(
            connection.execute("PRAGMA index_list(active_sessions)")
        )

    assert "role" not in columns
    assert "email" not in columns
    assert {"account_id", "auth_subject", "username", "username_key"} <= columns
    assert any(row["unique"] == 1 for row in session_indexes)
