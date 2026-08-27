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
from pbdh_backend.database import Database
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
        admin_auth_subject="platform-admin",
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
    publication_metadata: dict[str, Any] | None = None,
):
    return api.post(
        "/api/publications",
        headers=headers,
        data={"metadata": json.dumps(publication_metadata or metadata(document), ensure_ascii=False)},
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


def test_stable_armor_template_is_publishable(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    document["resources"][0]["template"] = {"id": "护甲", "version": "1.0.0"}
    document["resources"][0]["data"] = {
        "名称": "填充布甲",
        "类型": "护甲",
        "护甲值": "3",
        "重度伤害阈值": "5",
        "严重伤害阈值": "11",
        "描述": "灵活：闪避值+1。",
        "风味描述": "轻柔填料缝入耐磨布层。",
        "位阶": "1",
    }
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)

    response = publish(api, claim(api, "armor-author"), document, media)

    assert response.status_code == 200, response.text
    assert response.json()["publication"]["document"]["resources"][0]["template"] == {
        "id": "护甲",
        "version": "1.0.0",
    }


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


def test_publication_lifecycle_is_server_authoritative_and_rejects_unrelated_accounts(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    owner = claim(api, "author-one")
    outsider = claim(api, "author-two")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]
    original_digest = created["snapshotDigest"]
    original_archive = api.get(f"/api/publications/{publication_id}/download").content

    denied = api.patch(
        f"/api/publications/{publication_id}/metadata",
        headers=outsider,
        json={
            "title": "越权修改",
            "summary": "",
            "language": "zh-CN",
            "tags": [],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert denied.status_code == 403

    metadata_update = api.patch(
        f"/api/publications/{publication_id}/metadata",
        headers=owner,
        json={
            "title": "荒野遭遇集·修订展示",
            "summary": "只修改市场展示信息。",
            "language": "zh-CN",
            "tags": ["敌人", "修订"],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert metadata_update.status_code == 200, metadata_update.text
    edited = metadata_update.json()["publication"]
    assert edited["title"] == "荒野遭遇集·修订展示"
    assert edited["snapshotDigest"] == original_digest
    assert api.get(f"/api/publications/{publication_id}/download").content == original_archive

    assert api.post(f"/api/publications/{publication_id}/unpublish", headers=outsider).status_code == 403
    unpublished = api.post(f"/api/publications/{publication_id}/unpublish", headers=owner)
    assert unpublished.status_code == 200, unpublished.text
    assert unpublished.json()["publication"]["status"] == "unpublished"
    repeated_unpublish = api.post(f"/api/publications/{publication_id}/unpublish", headers=owner)
    assert repeated_unpublish.status_code == 200
    assert repeated_unpublish.json()["publication"]["status"] == "unpublished"
    assert repeated_unpublish.json()["publication"]["updatedAt"] == unpublished.json()["publication"]["updatedAt"]
    assert api.get("/api/publications").json() == {"publications": []}
    assert api.get(f"/api/publications/{publication_id}").status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download").status_code == 404
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}"
    ).status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download", headers=outsider).status_code == 404
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=outsider,
    ).status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download", headers=owner).content == original_archive
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=owner,
    ).content == media[document["assets"][0]["id"]]

    manageable = api.get("/api/publications/manageable", headers=owner)
    assert manageable.status_code == 200
    assert manageable.json()["publications"][0]["publicationId"] == publication_id
    assert manageable.json()["publications"][0]["status"] == "unpublished"
    assert api.get(f"/api/publications/{publication_id}/manage", headers=owner).status_code == 200
    assert api.get(f"/api/publications/{publication_id}/manage", headers=outsider).status_code == 404

    updated_document = copy.deepcopy(document)
    updated_document["resources"][0]["data"]["名称"] = "未发布状态下的新快照"
    updated_document["snapshotDigest"] = compute_resource_package_snapshot_digest(updated_document, media)
    updated_while_unpublished = publish(api, owner, updated_document, media)
    assert updated_while_unpublished.status_code == 200, updated_while_unpublished.text
    assert updated_while_unpublished.json()["publication"]["status"] == "unpublished"
    assert updated_while_unpublished.json()["publication"]["snapshotDigest"] == updated_document["snapshotDigest"]
    assert api.get("/api/publications").json() == {"publications": []}

    assert api.post(f"/api/publications/{publication_id}/republish", headers=outsider).status_code == 403
    republished = api.post(f"/api/publications/{publication_id}/republish", headers=owner)
    assert republished.status_code == 200, republished.text
    assert republished.json()["publication"]["publicationId"] == publication_id
    assert republished.json()["publication"]["status"] == "published"
    repeated_republish = api.post(f"/api/publications/{publication_id}/republish", headers=owner)
    assert repeated_republish.status_code == 200
    assert repeated_republish.json()["publication"]["publicationId"] == publication_id
    assert repeated_republish.json()["publication"]["status"] == "published"
    assert repeated_republish.json()["publication"]["updatedAt"] == republished.json()["publication"]["updatedAt"]


def test_platform_admin_can_manage_another_authors_publication(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    owner = claim(api, "author-one")
    admin = claim(api, "platform-admin")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]

    edited = api.patch(
        f"/api/publications/{publication_id}/metadata",
        headers=admin,
        json={
            "title": "管理员修订展示",
            "summary": "",
            "language": "zh-CN",
            "tags": ["敌人"],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["publication"]["author"]["accountId"] == created["author"]["accountId"]

    unpublished = api.post(f"/api/publications/{publication_id}/unpublish", headers=admin)
    assert unpublished.status_code == 200, unpublished.text
    assert unpublished.json()["publication"]["status"] == "unpublished"
    assert api.get(f"/api/publications/{publication_id}/manage", headers=admin).status_code == 200
    assert api.get("/api/publications/manageable", headers=admin).json()["publications"][0]["publicationId"] == publication_id
    assert api.get(f"/api/publications/{publication_id}/download", headers=admin).status_code == 200
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=admin,
    ).content == media[document["assets"][0]["id"]]

    republished = api.post(f"/api/publications/{publication_id}/republish", headers=admin)
    assert republished.status_code == 200, republished.text
    assert republished.json()["publication"]["status"] == "published"
    assert api.get(f"/api/publications/{publication_id}").status_code == 200


def test_status_migration_preserves_existing_publications_as_published(tmp_path: Path) -> None:
    migrations = tmp_path / "migrations"
    migrations.mkdir()
    source_migrations = ROOT / "apps/backend/migrations"
    for name in ("0001_identity.sql", "0002_publications.sql"):
        (migrations / name).write_text(
            (source_migrations / name).read_text(encoding="utf-8"),
            encoding="utf-8",
        )
    migrated_settings = Settings(
        database_path=tmp_path / "existing.sqlite3",
        migrations_path=migrations,
        supabase_url="https://example.supabase.co",
        supabase_anon_key="public-anon-key",
        publication_mode="development",
    )
    document, _ = candidate()
    database = Database(migrated_settings.database_path, migrations)
    connection = database.connect()
    connection.execute(
        "INSERT INTO accounts(account_id, auth_subject, username, username_key, created_at, updated_at) "
        "VALUES ('account-existing', 'author-one', 'author-one', 'author-one', '2026-08-25', '2026-08-25')"
    )
    connection.execute(
        "INSERT INTO package_ownership(package_id, account_id, claimed_at) VALUES (?, 'account-existing', '2026-08-25')",
        (document["package"]["id"],),
    )
    connection.execute(
        "INSERT INTO publications(publication_id, package_id, contract_version, package_version, "
        "snapshot_digest, title, summary, language, tags_json, cover_asset_id, logical_document_json, "
        "created_at, updated_at) VALUES ('publication-existing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-08-25', '2026-08-25')",
        (
            document["package"]["id"],
            document["contractVersion"],
            document["package"]["version"],
            document["snapshotDigest"],
            "荒野遭遇集",
            "包含牛头人破坏者。",
            "zh-CN",
            json.dumps(["敌人"], ensure_ascii=False),
            document["assets"][0]["id"],
            json.dumps(document, ensure_ascii=False),
        ),
    )
    connection.commit()
    connection.close()

    (migrations / "0003_publication_status.sql").write_text(
        (source_migrations / "0003_publication_status.sql").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = TestClient(create_app(migrated_settings, FakeTokenVerifier()))
    publications = after.get("/api/publications").json()["publications"]

    assert len(publications) == 1
    assert publications[0]["publicationId"] == "publication-existing"
    assert publications[0]["status"] == "published"


def test_invalid_update_preserves_current_snapshot(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    document, media = candidate()
    first = publish(api, owner, document, media)
    assert first.status_code == 200, first.text
    publication_id = first.json()["publication"]["publicationId"]

    update = copy.deepcopy(document)
    update["package"]["version"] = "1.0.1"
    update["resources"][0]["data"]["名称"] = "无效更新不应提交"
    update["snapshotDigest"] = compute_resource_package_snapshot_digest(update, media)
    invalid_metadata = metadata(update)
    invalid_metadata["coverAssetId"] = "sha256:" + "0" * 64
    rejected = publish(api, owner, update, media, invalid_metadata)
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "PUBLICATION_CANDIDATE_INVALID"

    unchanged = api.get(f"/api/publications/{publication_id}").json()["publication"]
    assert unchanged["snapshotDigest"] == document["snapshotDigest"]
    assert unchanged["packageVersion"] == "1.0.0"


def test_production_mode_rejects_development_contract(tmp_path: Path) -> None:
    api = client(tmp_path, "production")
    document, media = candidate()
    response = publish(api, claim(api, "author-one"), document, media)
    assert response.status_code == 422
    field_errors = response.json()["error"]["fieldErrors"]
    assert field_errors[0]["code"] == "contract.version.development-not-allowed"
    assert api.get("/api/publications").json() == {"publications": []}
