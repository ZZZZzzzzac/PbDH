import copy
import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from pbdh_backend.api_errors import ApiError
from pbdh_backend.app import create_app
from pbdh_backend.contracts import (
    compute_resource_package_snapshot_digest,
    load_pbres,
    validate_resource_package_semantics,
    write_pbres,
)
from pbdh_backend.identity.tokens import VerifiedIdentity
from pbdh_backend.settings import Settings


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/resource-package/1.0.0"


class FakeTokenVerifier:
    def verify(self, token: str) -> VerifiedIdentity:
        if not token.startswith("token:"):
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效或已过期。")
        return VerifiedIdentity(token.removeprefix("token:"))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def settings(tmp_path: Path, mode: str = "development") -> Settings:
    return Settings(
        database_path=tmp_path / "pbdh.sqlite3",
        migrations_path=ROOT / "apps/backend/migrations",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="public-anon-key",
        publication_mode=mode,
    )


def client(tmp_path: Path, mode: str = "development") -> TestClient:
    return TestClient(create_app(settings(tmp_path, mode), FakeTokenVerifier()))


def claim(api: TestClient, subject: str) -> dict[str, str]:
    response = api.post(
        "/api/auth/session/claim",
        headers={"Authorization": f"Bearer token:{subject}"},
        json={},
    )
    assert response.status_code == 200
    return {
        "Authorization": f"Bearer token:{subject}",
        "X-PbDH-Session": response.json()["sessionId"],
    }


def candidate() -> tuple[dict[str, Any], dict[str, bytes]]:
    document = read_json(FIXTURE_ROOT / "valid/minotaur-wrecker.json")
    media = {
        asset["id"]: (
            FIXTURE_ROOT / f"media/{asset['id'].removeprefix('sha256:')}.webp"
        ).read_bytes()
        for asset in document["assets"]
    }
    return document, media


def metadata(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": "荒野遭遇集",
        "summary": "包含牛头人破坏者。",
        "language": "zh-CN",
        "tags": ["敌人", "荒野"],
        "coverAssetId": document["assets"][0]["id"],
    }


def publish(
    api: TestClient,
    headers: dict[str, str],
    document: dict[str, Any],
    media: dict[str, bytes],
):
    return api.post(
        "/api/publications",
        headers=headers,
        data={"metadata": json.dumps(metadata(document), ensure_ascii=False)},
        files={
            "archive": (
                "package.pbres",
                write_pbres(document, media),
                "application/vnd.pbdh.resource-package+zip",
            )
        },
    )


def test_authenticated_publish_is_anonymously_discoverable_and_downloadable(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    response = publish(api, claim(api, "author-one"), document, media)

    assert response.status_code == 200, response.text
    publication = response.json()["publication"]
    assert publication["created"] is True
    assert publication["idempotent"] is False
    publication_id = publication["publicationId"]

    listing = api.get("/api/publications", params={"q": "牛头人"})
    assert listing.status_code == 200
    assert [item["publicationId"] for item in listing.json()["publications"]] == [publication_id]

    detail = api.get(f"/api/publications/{publication_id}")
    assert detail.status_code == 200
    assert detail.json()["publication"]["document"] == document

    cover = api.get(f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}")
    assert cover.status_code == 200
    assert cover.content == next(iter(media.values()))

    download = api.get(f"/api/publications/{publication_id}/download")
    assert download.status_code == 200
    assert "filename*=UTF-8''" in download.headers["content-disposition"]
    assert "%E7%89%9B%E5%A4%B4%E4%BA%BA" in download.headers["content-disposition"]
    loaded = load_pbres(download.content, validate_resource_package_semantics)
    assert loaded["diagnostics"] == []
    assert loaded["candidate"] == {"document": document, "media": media}


def test_publication_requires_active_account_session(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    response = publish(api, {}, document, media)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_invalid_archive_and_unpublishable_template_leave_zero_rows(tmp_path: Path) -> None:
    api = client(tmp_path)
    headers = claim(api, "author-one")
    document, media = candidate()
    broken_media = dict(media)
    broken_media[document["assets"][0]["id"]] = b"not-the-image"

    invalid = publish(api, headers, document, broken_media)
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "PUBLICATION_CANDIDATE_INVALID"

    alpha_root = ROOT / "contracts/conformance/resource-package/1.0.0-alpha.1"
    alpha_document = read_json(alpha_root / "valid/minotaur-wrecker.json")
    alpha_media = {
        asset["id"]: (
            alpha_root / f"media/{asset['id'].removeprefix('sha256:')}.webp"
        ).read_bytes()
        for asset in alpha_document["assets"]
    }
    unpublishable = publish(api, headers, alpha_document, alpha_media)
    assert unpublishable.status_code == 422
    assert api.get("/api/publications").json() == {"publications": []}


def test_package_ownership_idempotency_and_monotonic_versions(tmp_path: Path) -> None:
    api = client(tmp_path)
    first_headers = claim(api, "author-one")
    document, media = candidate()
    first = publish(api, first_headers, document, media)
    assert first.status_code == 200

    repeated = publish(api, first_headers, document, media)
    assert repeated.status_code == 200
    assert repeated.json()["publication"]["idempotent"] is True

    second_headers = claim(api, "author-two")
    stolen = publish(api, second_headers, document, media)
    assert stolen.status_code == 409
    assert stolen.json()["error"]["code"] == "PACKAGE_ID_OWNED_BY_ANOTHER_ACCOUNT"

    changed = copy.deepcopy(document)
    changed["resources"][0]["data"]["名称"] = "另一只牛头人"
    changed["snapshotDigest"] = compute_resource_package_snapshot_digest(changed, media)
    development_replace = publish(api, first_headers, changed, media)
    assert development_replace.status_code == 200
    assert development_replace.json()["publication"]["created"] is False
    assert development_replace.json()["publication"]["idempotent"] is False
    assert development_replace.json()["publication"]["packageVersion"] == "1.0.0"
    assert development_replace.json()["publication"]["snapshotDigest"] == changed["snapshotDigest"]

    changed["package"]["version"] = "1.0.1"
    changed["snapshotDigest"] = compute_resource_package_snapshot_digest(changed, media)
    updated = publish(api, first_headers, changed, media)
    assert updated.status_code == 200
    assert updated.json()["publication"]["publicationId"] == first.json()["publication"]["publicationId"]
    assert updated.json()["publication"]["packageVersion"] == "1.0.1"


def test_production_mode_rejects_development_contract(tmp_path: Path) -> None:
    api = client(tmp_path, "production")
    document, media = candidate()
    response = publish(api, claim(api, "author-one"), document, media)
    assert response.status_code == 422
    field_errors = response.json()["error"]["fieldErrors"]
    assert field_errors[0]["code"] == "contract.version.development-not-allowed"
    assert api.get("/api/publications").json() == {"publications": []}
