from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from pbdh_backend.database import Database


class PackageOwnershipConflict(Exception):
    pass


class PublicationVersionConflict(Exception):
    pass


class PublicationNotFound(Exception):
    pass


class PublicationPermissionDenied(Exception):
    pass


class PublicationCoverInvalid(Exception):
    pass


@dataclass(frozen=True)
class PublicationWrite:
    publication_id: str
    created: bool
    idempotent: bool


class PublicationRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def publish(
        self,
        account_id: str,
        document: Mapping[str, Any],
        media: Mapping[str, bytes],
        metadata: Mapping[str, Any],
        allow_same_version_replace: bool = False,
    ) -> PublicationWrite:
        package_id = document["package"]["id"]
        package_version = document["package"]["version"]
        snapshot_digest = document["snapshotDigest"]
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            ownership = connection.execute(
                "SELECT account_id FROM package_ownership WHERE package_id = ?",
                (package_id,),
            ).fetchone()
            if ownership and ownership["account_id"] != account_id:
                raise PackageOwnershipConflict(package_id)
            if ownership is None:
                connection.execute(
                    "INSERT INTO package_ownership(package_id, account_id, claimed_at) "
                    "VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                    (package_id, account_id),
                )

            current = connection.execute(
                "SELECT publication_id, package_version, snapshot_digest "
                "FROM publications WHERE package_id = ?",
                (package_id,),
            ).fetchone()
            if current:
                if (
                    current["package_version"] == package_version
                    and current["snapshot_digest"] == snapshot_digest
                ):
                    connection.commit()
                    return PublicationWrite(current["publication_id"], False, True)
                version_order = _compare_semver(package_version, current["package_version"])
                if version_order < 0 or (version_order == 0 and not allow_same_version_replace):
                    raise PublicationVersionConflict(package_id)
                publication_id = current["publication_id"]
                created = False
            else:
                publication_id = str(uuid4())
                created = True

            assets = {asset["id"]: asset for asset in document["assets"]}
            for asset_id, media_bytes in media.items():
                asset = assets[asset_id]
                connection.execute(
                    "INSERT INTO media_blobs(asset_id, media_type, byte_length, bytes) "
                    "VALUES (?, ?, ?, ?) ON CONFLICT(asset_id) DO NOTHING",
                    (asset_id, asset["mediaType"], len(media_bytes), media_bytes),
                )

            encoded_document = json.dumps(
                document, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            )
            encoded_tags = json.dumps(
                metadata["tags"], ensure_ascii=False, separators=(",", ":")
            )
            if created:
                connection.execute(
                    "INSERT INTO publications("
                    "publication_id, package_id, contract_version, package_version, "
                    "snapshot_digest, title, summary, language, tags_json, cover_asset_id, "
                    "logical_document_json, created_at, updated_at"
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                    "strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
                    "strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                    (
                        publication_id,
                        package_id,
                        document["contractVersion"],
                        package_version,
                        snapshot_digest,
                        metadata["title"],
                        metadata["summary"],
                        metadata["language"],
                        encoded_tags,
                        metadata["coverAssetId"],
                        encoded_document,
                    ),
                )
            else:
                connection.execute(
                    "UPDATE publications SET contract_version = ?, package_version = ?, "
                    "snapshot_digest = ?, title = ?, summary = ?, language = ?, tags_json = ?, "
                    "cover_asset_id = ?, logical_document_json = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                    "WHERE publication_id = ?",
                    (
                        document["contractVersion"],
                        package_version,
                        snapshot_digest,
                        metadata["title"],
                        metadata["summary"],
                        metadata["language"],
                        encoded_tags,
                        metadata["coverAssetId"],
                        encoded_document,
                        publication_id,
                    ),
                )
                connection.execute(
                    "DELETE FROM publication_resources WHERE publication_id = ?",
                    (publication_id,),
                )
                connection.execute(
                    "DELETE FROM publication_media WHERE publication_id = ?",
                    (publication_id,),
                )

            connection.executemany(
                "INSERT INTO publication_resources("
                "publication_id, resource_id, path, template_id, template_version, search_text"
                ") VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (
                        publication_id,
                        resource["id"],
                        resource["path"],
                        resource["template"]["id"],
                        resource["template"]["version"],
                        json.dumps(resource, ensure_ascii=False, separators=(",", ":")),
                    )
                    for resource in document["resources"]
                ],
            )
            connection.executemany(
                "INSERT INTO publication_media(publication_id, asset_id) VALUES (?, ?)",
                [(publication_id, asset["id"]) for asset in document["assets"]],
            )
            connection.commit()
            return PublicationWrite(publication_id, created, False)
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    def update_metadata(
        self,
        publication_id: str,
        account_id: str,
        metadata: Mapping[str, Any],
        allow_all: bool = False,
    ) -> dict[str, Any]:
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT p.logical_document_json, o.account_id "
                "FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "WHERE p.publication_id = ?",
                (publication_id,),
            ).fetchone()
            if current is None:
                raise PublicationNotFound(publication_id)
            if current["account_id"] != account_id and not allow_all:
                raise PublicationPermissionDenied(publication_id)
            document = json.loads(current["logical_document_json"])
            if metadata["coverAssetId"] not in {
                asset["id"] for asset in document["assets"]
            }:
                raise PublicationCoverInvalid(metadata["coverAssetId"])
            connection.execute(
                "UPDATE publications SET title = ?, summary = ?, language = ?, "
                "tags_json = ?, cover_asset_id = ?, "
                "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                "WHERE publication_id = ?",
                (
                    metadata["title"],
                    metadata["summary"],
                    metadata["language"],
                    json.dumps(metadata["tags"], ensure_ascii=False, separators=(",", ":")),
                    metadata["coverAssetId"],
                    publication_id,
                ),
            )
            connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()
        publication = self.get_manageable_publication(publication_id, account_id, allow_all)
        if publication is None:
            raise RuntimeError("Publication disappeared after metadata update")
        return publication

    def set_status(
        self,
        publication_id: str,
        account_id: str,
        status: str,
        allow_all: bool = False,
    ) -> dict[str, Any]:
        if status not in ("published", "unpublished"):
            raise ValueError(f"Invalid publication status: {status}")
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT o.account_id, p.status FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "WHERE p.publication_id = ?",
                (publication_id,),
            ).fetchone()
            if current is None:
                raise PublicationNotFound(publication_id)
            if current["account_id"] != account_id and not allow_all:
                raise PublicationPermissionDenied(publication_id)
            if current["status"] != status:
                connection.execute(
                    "UPDATE publications SET status = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                    "WHERE publication_id = ?",
                    (status, publication_id),
                )
            connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()
        publication = self.get_manageable_publication(publication_id, account_id, allow_all)
        if publication is None:
            raise RuntimeError("Publication disappeared after status update")
        return publication

    def list_publications(self, query: str | None = None) -> list[dict[str, Any]]:
        connection = self._database.connect()
        try:
            terms = query.strip() if query else ""
            rows = connection.execute(
                "SELECT p.*, o.account_id, a.username FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                "WHERE p.status = 'published' AND ("
                "? = '' OR p.title LIKE ? OR p.summary LIKE ? OR p.tags_json LIKE ? "
                "OR EXISTS (SELECT 1 FROM publication_resources r "
                "WHERE r.publication_id = p.publication_id AND r.search_text LIKE ?)) "
                "ORDER BY p.updated_at DESC, p.publication_id",
                (terms, *(f"%{terms}%",) * 4),
            ).fetchall()
            return [self._public_row(row) for row in rows]
        finally:
            connection.close()

    def get_publication(self, publication_id: str) -> dict[str, Any] | None:
        connection = self._database.connect()
        try:
            row = connection.execute(
                "SELECT p.*, o.account_id, a.username FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                "WHERE p.publication_id = ? AND p.status = 'published'",
                (publication_id,),
            ).fetchone()
            if row is None:
                return None
            result = self._public_row(row)
            result["document"] = json.loads(row["logical_document_json"])
            return result
        finally:
            connection.close()

    def list_manageable_publications(
        self, account_id: str, allow_all: bool
    ) -> list[dict[str, Any]]:
        connection = self._database.connect()
        try:
            rows = connection.execute(
                "SELECT p.*, o.account_id, a.username FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                "WHERE ? = 1 OR o.account_id = ? "
                "ORDER BY p.updated_at DESC, p.publication_id",
                (allow_all, account_id),
            ).fetchall()
            return [self._public_row(row) for row in rows]
        finally:
            connection.close()

    def get_owned_publication(
        self, publication_id: str, account_id: str
    ) -> dict[str, Any] | None:
        return self.get_manageable_publication(publication_id, account_id, False)

    def get_manageable_publication(
        self, publication_id: str, account_id: str, allow_all: bool
    ) -> dict[str, Any] | None:
        connection = self._database.connect()
        try:
            row = connection.execute(
                "SELECT p.*, o.account_id, a.username FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                "WHERE p.publication_id = ? AND (? = 1 OR o.account_id = ?)",
                (publication_id, allow_all, account_id),
            ).fetchone()
            if row is None:
                return None
            result = self._public_row(row)
            result["document"] = json.loads(row["logical_document_json"])
            return result
        finally:
            connection.close()

    def get_media(
        self,
        publication_id: str,
        asset_id: str,
        account_id: str | None = None,
        allow_all: bool = False,
    ) -> tuple[str, bytes] | None:
        connection = self._database.connect()
        try:
            row = connection.execute(
                "SELECT b.media_type, b.bytes FROM media_blobs b "
                "JOIN publication_media m ON m.asset_id = b.asset_id "
                "JOIN publications p ON p.publication_id = m.publication_id "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "WHERE m.publication_id = ? AND m.asset_id = ? "
                "AND (p.status = 'published' OR ? = 1 OR o.account_id = ?)",
                (publication_id, asset_id, allow_all, account_id or ""),
            ).fetchone()
            return None if row is None else (row["media_type"], row["bytes"])
        finally:
            connection.close()

    def get_archive_candidate(
        self,
        publication_id: str,
        account_id: str | None = None,
        allow_all: bool = False,
    ) -> tuple[dict[str, Any], dict[str, bytes]] | None:
        publication = (
            self.get_manageable_publication(publication_id, account_id, allow_all)
            if account_id is not None
            else self.get_publication(publication_id)
        )
        if publication is None:
            return None
        document = publication["document"]
        media: dict[str, bytes] = {}
        for asset in document["assets"]:
            found = self.get_media(publication_id, asset["id"], account_id, allow_all)
            if found is None:
                raise RuntimeError(f"Publication media missing: {asset['id']}")
            media[asset["id"]] = found[1]
        return document, media

    @staticmethod
    def _public_row(row: sqlite3.Row) -> dict[str, Any]:
        document = json.loads(row["logical_document_json"])
        return {
            "publicationId": row["publication_id"],
            "packageId": row["package_id"],
            "contractVersion": row["contract_version"],
            "packageVersion": row["package_version"],
            "snapshotDigest": row["snapshot_digest"],
            "title": row["title"],
            "summary": row["summary"],
            "language": row["language"],
            "tags": json.loads(row["tags_json"]),
            "coverAssetId": row["cover_asset_id"],
            "author": {
                "accountId": row["account_id"],
                "username": row["username"],
            },
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "status": row["status"],
            "templateIds": sorted({
                resource["template"]["id"] for resource in document["resources"]
            }),
            "targetSystemPackageIds": [
                target["systemPackageId"] for target in document["targets"]
            ],
            "license": document["license"],
            "resourceCount": len(document["resources"]),
            "resources": [
                {
                    "id": resource["id"],
                    "path": resource["path"],
                    "template": resource["template"],
                    "name": resource["path"].rsplit("/", 1)[-1].removesuffix(".json"),
                }
                for resource in document["resources"]
            ],
        }


def _compare_semver(left: str, right: str) -> int:
    def parse(value: str) -> tuple[tuple[int, int, int], list[str] | None]:
        match = re.fullmatch(
            r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
            r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?",
            value,
        )
        if not match:
            raise ValueError(f"Invalid SemVer: {value}")
        core = (int(match[1]), int(match[2]), int(match[3]))
        return core, match[4].split(".") if match[4] else None

    left_core, left_pre = parse(left)
    right_core, right_pre = parse(right)
    if left_core != right_core:
        return 1 if left_core > right_core else -1
    if left_pre is None or right_pre is None:
        return (left_pre is None) - (right_pre is None)
    for left_part, right_part in zip(left_pre, right_pre):
        if left_part == right_part:
            continue
        left_number = int(left_part) if left_part.isdigit() else None
        right_number = int(right_part) if right_part.isdigit() else None
        if left_number is not None and right_number is not None:
            return 1 if left_number > right_number else -1
        if left_number is not None:
            return -1
        if right_number is not None:
            return 1
        return 1 if left_part > right_part else -1
    return (len(left_pre) > len(right_pre)) - (len(left_pre) < len(right_pre))
