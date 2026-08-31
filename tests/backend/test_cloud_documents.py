import hashlib
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from pbdh_backend.api_errors import ApiError
from pbdh_backend.app import create_app
from pbdh_backend.identity.tokens import VerifiedIdentity
from pbdh_backend.settings import Settings


ROOT = Path(__file__).parents[2]


def webp(marker: int = 0) -> bytes:
    names = [
        "a991add6e770461480dd9bf35fde9debe267f7f5b970d01cb65bb689166b28cd.webp",
        "0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    ]
    return (ROOT / "contracts/conformance/resource-package/1.0.0/media" / names[marker]).read_bytes()


def minimal_webp(width: int, height: int) -> bytes:
    bits = (width - 1) | ((height - 1) << 14)
    chunk = b"\x2f" + bits.to_bytes(4, "little")
    payload = b"WEBP" + b"VP8L" + len(chunk).to_bytes(4, "little") + chunk + b"\x00"
    return b"RIFF" + len(payload).to_bytes(4, "little") + payload


class FakeTokenVerifier:
    def verify(self, token: str) -> VerifiedIdentity:
        if not token.startswith("token:"):
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效或已过期。")
        return VerifiedIdentity(token.removeprefix("token:"))


def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(Settings(
        database_path=tmp_path / "pbdh.sqlite3",
        migrations_path=ROOT / "apps/backend/migrations",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="public-anon-key",
        admin_auth_subject="platform-admin",
    ), FakeTokenVerifier()))


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


def document_write(
    mutation_id: str,
    document_kind: str,
    payload: dict[str, object],
    asset_ids: list[str],
    base_revision: int | None,
    force: bool = False,
) -> dict[str, object]:
    return {
        "mutationId": mutation_id,
        "documentKind": document_kind,
        "contractFamily": "creator-workspace-draft" if document_kind == "creator-workspace" else "tabletop-document",
        "contractVersion": "1",
        "baseRevision": base_revision,
        "assetIds": asset_ids,
        "payload": payload,
        "force": force,
    }


def test_cloud_document_requires_media_before_atomic_revision_commit(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    outsider = claim(api, "author-two")
    document_id = "workspace-1"
    media = webp()
    asset_id = f"sha256:{hashlib.sha256(media).hexdigest()}"
    write = document_write("mutation-1", "creator-workspace", {"name": "荒野遭遇集"}, [asset_id], None)

    missing = api.put(f"/api/cloud/documents/{document_id}", headers=owner, json=write)
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "CLOUD_MEDIA_NOT_READY"
    assert api.get(f"/api/cloud/documents/{document_id}", headers=owner).status_code == 404

    prepared = api.put(
        f"/api/cloud/media/{asset_id}",
        headers={**owner, "Content-Type": "image/webp"},
        content=media,
    )
    assert prepared.status_code == 200
    assert prepared.json() == {"assetId": asset_id, "byteLength": len(media), "ready": True}

    committed = api.put(f"/api/cloud/documents/{document_id}", headers=owner, json=write)
    assert committed.status_code == 200, committed.text
    cloud_document = committed.json()["document"]
    assert cloud_document["documentId"] == document_id
    assert cloud_document["revision"] == 1
    assert cloud_document["payload"] == {"name": "荒野遭遇集"}
    assert cloud_document["assetIds"] == [asset_id]

    restored_media = api.get(
        f"/api/cloud/documents/{document_id}/media/{asset_id}",
        headers=owner,
    )
    assert restored_media.status_code == 200
    assert restored_media.content == media
    assert api.get(
        f"/api/cloud/documents/{document_id}/media/{asset_id}",
        headers=outsider,
    ).status_code == 404


def test_cloud_media_rejects_invalid_or_oversized_webp_before_storage(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "media-author")
    invalid = b"not-webp"
    invalid_id = f"sha256:{hashlib.sha256(invalid).hexdigest()}"

    malformed = api.put(
        f"/api/cloud/media/{invalid_id}",
        headers={**owner, "Content-Type": "image/webp"},
        content=invalid,
    )
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "CLOUD_MEDIA_INVALID"

    oversized = webp() + bytes(2 * 1024 * 1024)
    oversized_id = f"sha256:{hashlib.sha256(oversized).hexdigest()}"
    too_large = api.put(
        f"/api/cloud/media/{oversized_id}",
        headers={**owner, "Content-Type": "image/webp"},
        content=oversized,
    )
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "CLOUD_MEDIA_TOO_LARGE"

    wrong_width = minimal_webp(629, 880)
    wrong_width_id = f"sha256:{hashlib.sha256(wrong_width).hexdigest()}"
    wrong_dimensions = api.put(
        f"/api/cloud/media/{wrong_width_id}",
        headers={**owner, "Content-Type": "image/webp"},
        content=wrong_width,
    )
    assert wrong_dimensions.status_code == 422
    assert wrong_dimensions.json()["error"]["code"] == "CLOUD_MEDIA_INVALID"


def test_cloud_document_mutations_are_idempotent_and_conflicts_are_explicit(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    document_id = "workspace-1"
    initial = document_write("mutation-1", "creator-workspace", {"value": 1}, [], None)

    created = api.put(f"/api/cloud/documents/{document_id}", headers=owner, json=initial)
    repeated = api.put(f"/api/cloud/documents/{document_id}", headers=owner, json=initial)
    assert created.status_code == repeated.status_code == 200
    assert created.json() == repeated.json()

    updated = api.put(
        f"/api/cloud/documents/{document_id}",
        headers=owner,
        json=document_write("mutation-2", "creator-workspace", {"value": 2}, [], 1),
    )
    assert updated.json()["document"]["revision"] == 2

    conflict = api.put(
        f"/api/cloud/documents/{document_id}",
        headers=owner,
        json=document_write("mutation-3", "creator-workspace", {"value": 3}, [], 1),
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "CLOUD_DOCUMENT_REVISION_CONFLICT"

    overwritten = api.put(
        f"/api/cloud/documents/{document_id}",
        headers=owner,
        json=document_write("mutation-4", "creator-workspace", {"value": 4}, [], 1, True),
    )
    assert overwritten.status_code == 200
    assert overwritten.json()["document"]["revision"] == 3
    assert overwritten.json()["document"]["payload"] == {"value": 4}


def test_cloud_documents_keep_kinds_revisions_and_recycle_bin_independent(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")

    workspace = api.put(
        "/api/cloud/documents/workspace-1",
        headers=owner,
        json=document_write("mutation-w1", "creator-workspace", {"resource": "enemy"}, [], None),
    ).json()["document"]
    tabletop = api.put(
        "/api/cloud/documents/tabletop-1",
        headers=owner,
        json=document_write("mutation-t1", "gm-tabletop-document", {"stress": 2}, [], None),
    ).json()["document"]
    assert workspace["revision"] == tabletop["revision"] == 1

    trashed = api.post(
        "/api/cloud/documents/tabletop-1/trash",
        headers=owner,
        json={"mutationId": "mutation-t2", "baseRevision": 1},
    )
    assert trashed.status_code == 200
    assert trashed.json()["document"]["revision"] == 2
    assert trashed.json()["document"]["deletedAt"] is not None
    assert api.get("/api/cloud/documents?documentKind=gm-tabletop-document", headers=owner).json() == {"documents": []}
    assert len(api.get(
        "/api/cloud/documents?documentKind=gm-tabletop-document&includeDeleted=true",
        headers=owner,
    ).json()["documents"]) == 1

    restored = api.post(
        "/api/cloud/documents/tabletop-1/restore",
        headers=owner,
        json={"mutationId": "mutation-t3", "baseRevision": 2},
    )
    assert restored.status_code == 200
    assert restored.json()["document"]["revision"] == 3
    assert restored.json()["document"]["deletedAt"] is None

    current_workspace = api.get("/api/cloud/documents/workspace-1", headers=owner).json()["document"]
    assert current_workspace["revision"] == 1
    assert current_workspace["payload"] == {"resource": "enemy"}


def test_cloud_document_permanent_delete_requires_trash_and_releases_media_reference(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    media = webp()
    asset_id = f"sha256:{hashlib.sha256(media).hexdigest()}"
    assert api.put(
        f"/api/cloud/media/{asset_id}",
        headers={**owner, "Content-Type": "image/webp"},
        content=media,
    ).status_code == 200
    assert api.put(
        "/api/cloud/documents/tabletop-delete",
        headers=owner,
        json=document_write("create-delete", "gm-tabletop-document", {"enemy": "巨人"}, [asset_id], None),
    ).status_code == 200

    active_delete = api.delete(
        "/api/cloud/documents/tabletop-delete?baseRevision=1",
        headers=owner,
    )
    assert active_delete.status_code == 409
    trashed = api.post(
        "/api/cloud/documents/tabletop-delete/trash",
        headers=owner,
        json={"mutationId": "trash-delete", "baseRevision": 1},
    ).json()["document"]
    assert trashed["purgeAfter"] is not None

    deleted = api.delete(
        f"/api/cloud/documents/tabletop-delete?baseRevision={trashed['revision']}",
        headers=owner,
    )
    assert deleted.status_code == 204
    assert api.get("/api/cloud/documents/tabletop-delete", headers=owner).status_code == 404
    with sqlite3.connect(tmp_path / "pbdh.sqlite3") as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM cloud_document_media WHERE document_id = ?",
            ("tabletop-delete",),
        ).fetchone()[0] == 0


def test_expired_cloud_trash_is_purged_when_recycle_bin_is_read(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    assert api.put(
        "/api/cloud/documents/tabletop-expired",
        headers=owner,
        json=document_write("create-expired", "gm-tabletop-document", {"enemy": "尸群"}, [], None),
    ).status_code == 200
    assert api.post(
        "/api/cloud/documents/tabletop-expired/trash",
        headers=owner,
        json={"mutationId": "trash-expired", "baseRevision": 1},
    ).status_code == 200
    with sqlite3.connect(tmp_path / "pbdh.sqlite3") as connection:
        connection.execute(
            "UPDATE cloud_documents SET purge_after = '2000-01-01T00:00:00.000Z' "
            "WHERE document_id = ?",
            ("tabletop-expired",),
        )
        connection.commit()

    recycle_bin = api.get(
        "/api/cloud/documents?documentKind=gm-tabletop-document&includeDeleted=true",
        headers=owner,
    )
    assert recycle_bin.status_code == 200
    assert recycle_bin.json() == {"documents": []}
    assert api.get("/api/cloud/documents/tabletop-expired", headers=owner).status_code == 404

