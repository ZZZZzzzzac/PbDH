from __future__ import annotations

import json
import re
import secrets
import sqlite3
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pbdh_backend.contracts import (
    classify_resource_package_version_change,
    resource_package_version_meets_minimum,
)
from pbdh_backend.database import Database
from pbdh_backend.managed_media import ManagedMedia


class PackageOwnershipConflict(Exception):
    pass


class PublicationVersionConflict(Exception):
    pass


class PublicationNotFound(Exception):
    pass


class PublicationPermissionDenied(Exception):
    pass


class PublicationMustBeUnpublished(Exception):
    pass


class PublicationCoverInvalid(Exception):
    pass


@dataclass(frozen=True)
class PublicationWrite:
    publication_id: str
    created: bool
    idempotent: bool


class PublicationRepository:
    def __init__(self, database: Database, managed_media: ManagedMedia | None = None) -> None:
        self._database = database
        self._managed_media = managed_media or ManagedMedia(database)

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
                "SELECT publication_id, package_version, snapshot_digest, logical_document_json "
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
                if not allow_same_version_replace:
                    classification = classify_resource_package_version_change(
                        json.loads(current["logical_document_json"]),
                        document,
                    )
                    if not resource_package_version_meets_minimum(
                        package_version,
                        classification["minimumVersion"],
                    ):
                        raise PublicationVersionConflict(package_id)
                publication_id = current["publication_id"]
                created = False
            else:
                publication_id = _uuid_v7()
                created = True

            assets = {asset["id"]: asset for asset in document["assets"]}
            self._managed_media.store_blobs(connection, {
                asset_id: (assets[asset_id]["mediaType"], media_bytes)
                for asset_id, media_bytes in media.items()
            })
            self._managed_media.claim_ownership(connection, account_id, media)

            encoded_document = json.dumps(
                document, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            )
            encoded_tags = json.dumps(
                metadata["tags"], ensure_ascii=False, separators=(",", ":")
            )
            if created:
                previous_asset_ids: set[str] = set()
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
                previous_asset_ids = {
                    row["asset_id"]
                    for row in connection.execute(
                        "SELECT asset_id FROM publication_media WHERE publication_id = ?",
                        (publication_id,),
                    ).fetchall()
                }
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
            self._managed_media.release_unreferenced_ownership(
                connection,
                account_id,
                previous_asset_ids - set(assets),
            )
            connection.commit()
            return PublicationWrite(publication_id, created, False)
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

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

    def update_information(
        self,
        publication_id: str,
        account_id: str,
        document: Mapping[str, Any],
        metadata: Mapping[str, Any],
        allow_all: bool = False,
        allow_same_version_replace: bool = False,
        cover_media: tuple[Mapping[str, Any], bytes] | None = None,
    ) -> dict[str, Any]:
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT p.package_version, p.logical_document_json, o.account_id "
                "FROM publications p JOIN package_ownership o ON o.package_id = p.package_id "
                "WHERE p.publication_id = ?",
                (publication_id,),
            ).fetchone()
            if current is None:
                raise PublicationNotFound(publication_id)
            if current["account_id"] != account_id and not allow_all:
                raise PublicationPermissionDenied(publication_id)
            previous_document = json.loads(current["logical_document_json"])
            if cover_media is not None:
                cover_asset, cover_bytes = cover_media
                self._managed_media.store_blobs(connection, {
                    cover_asset["id"]: (cover_asset["mediaType"], cover_bytes),
                })
                self._managed_media.claim_ownership(
                    connection, current["account_id"], [cover_asset["id"]]
                )
                connection.execute(
                    "INSERT INTO publication_media(publication_id, asset_id) VALUES (?, ?) "
                    "ON CONFLICT(publication_id, asset_id) DO NOTHING",
                    (publication_id, cover_asset["id"]),
                )
            if document["package"]["id"] != previous_document["package"]["id"]:
                raise PublicationVersionConflict(document["package"]["id"])
            version_order = _compare_semver(
                document["package"]["version"], current["package_version"]
            )
            if version_order < 0:
                raise PublicationVersionConflict(document["package"]["id"])
            classification = classify_resource_package_version_change(
                previous_document, document
            )
            if (
                classification["level"] != "none"
                and not allow_same_version_replace
                and not resource_package_version_meets_minimum(
                    document["package"]["version"],
                    classification["minimumVersion"],
                )
            ):
                raise PublicationVersionConflict(document["package"]["id"])
            cover_exists = connection.execute(
                "SELECT 1 FROM publication_media WHERE publication_id = ? AND asset_id = ?",
                (publication_id, metadata["coverAssetId"]),
            ).fetchone()
            if cover_exists is None:
                raise PublicationCoverInvalid(metadata["coverAssetId"])
            connection.execute(
                "UPDATE publications SET package_version = ?, snapshot_digest = ?, "
                "title = ?, summary = ?, language = ?, tags_json = ?, cover_asset_id = ?, "
                "logical_document_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                "WHERE publication_id = ?",
                (
                    document["package"]["version"],
                    document["snapshotDigest"],
                    metadata["title"],
                    metadata["summary"],
                    metadata["language"],
                    json.dumps(metadata["tags"], ensure_ascii=False, separators=(",", ":")),
                    metadata["coverAssetId"],
                    json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
                    publication_id,
                ),
            )
            retained_asset_ids = {asset["id"] for asset in document["assets"]}
            retained_asset_ids.add(metadata["coverAssetId"])
            removed_asset_ids: set[str] = set()
            for row in connection.execute(
                "SELECT asset_id FROM publication_media WHERE publication_id = ?",
                (publication_id,),
            ).fetchall():
                if row["asset_id"] not in retained_asset_ids:
                    removed_asset_ids.add(row["asset_id"])
                    connection.execute(
                        "DELETE FROM publication_media WHERE publication_id = ? AND asset_id = ?",
                        (publication_id, row["asset_id"]),
                    )
            self._managed_media.release_unreferenced_ownership(
                connection,
                current["account_id"],
                removed_asset_ids,
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
            raise RuntimeError("Publication disappeared after information update")
        return publication

    def delete_publication(
        self,
        publication_id: str,
        account_id: str,
        allow_all: bool = False,
    ) -> None:
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
            if current["status"] != "unpublished":
                raise PublicationMustBeUnpublished(publication_id)
            asset_ids = {
                row["asset_id"]
                for row in connection.execute(
                    "SELECT asset_id FROM publication_media WHERE publication_id = ?",
                    (publication_id,),
                ).fetchall()
            }
            connection.execute(
                "DELETE FROM publications WHERE publication_id = ?",
                (publication_id,),
            )
            self._managed_media.release_unreferenced_ownership(
                connection,
                current["account_id"],
                asset_ids,
            )
            connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    def search_publications(
        self,
        *,
        query: str | None = None,
        template_ids: list[str] | None = None,
        target_system_package_ids: list[str] | None = None,
        languages: list[str] | None = None,
        categories: list[str] | None = None,
        author_account_id: str | None = None,
        sort: str = "recent",
        page: int = 1,
        page_size: int = 24,
    ) -> dict[str, Any]:
        if sort not in {"relevance", "recent", "title"}:
            raise ValueError(f"Invalid publication sort: {sort}")
        if page < 1 or not 1 <= page_size <= 60:
            raise ValueError("Invalid publication page")

        connection = self._database.connect()
        try:
            terms = query.strip() if query else ""
            template_ids = list(dict.fromkeys(template_ids or []))
            target_system_package_ids = list(dict.fromkeys(target_system_package_ids or []))
            languages = list(dict.fromkeys(languages or []))
            categories = list(dict.fromkeys(categories or []))
            clauses = ["p.status = 'published'"]
            parameters: list[Any] = []

            if author_account_id:
                clauses.append("o.account_id = ?")
                parameters.append(author_account_id)

            if terms:
                like = f"%{terms}%"
                clauses.append(
                    "(p.title LIKE ? OR p.summary LIKE ? OR p.tags_json LIKE ? "
                    "OR a.username LIKE ? OR EXISTS (SELECT 1 FROM publication_resources r "
                    "WHERE r.publication_id = p.publication_id AND r.search_text LIKE ?))"
                )
                parameters.extend([like] * 5)
            if template_ids:
                placeholders = ",".join("?" for _ in template_ids)
                clauses.append(
                    "EXISTS (SELECT 1 FROM publication_resources r "
                    f"WHERE r.publication_id = p.publication_id AND r.template_id IN ({placeholders}))"
                )
                parameters.extend(template_ids)
            if target_system_package_ids:
                include_unspecified = "__none__" in target_system_package_ids
                target_ids = [value for value in target_system_package_ids if value != "__none__"]
                target_clauses: list[str] = []
                if target_ids:
                    placeholders = ",".join("?" for _ in target_ids)
                    target_clauses.append(
                        "EXISTS (SELECT 1 FROM json_each(p.logical_document_json, '$.targets') target "
                        f"WHERE json_extract(target.value, '$.systemPackageId') IN ({placeholders}))"
                    )
                    parameters.extend(target_ids)
                if include_unspecified:
                    target_clauses.append(
                        "json_array_length(json_extract(p.logical_document_json, '$.targets')) = 0"
                    )
                clauses.append(f"({' OR '.join(target_clauses)})")
            if languages:
                placeholders = ",".join("?" for _ in languages)
                clauses.append(f"p.language IN ({placeholders})")
                parameters.extend(languages)
            if categories:
                placeholders = ",".join("?" for _ in categories)
                clauses.append(
                    "EXISTS (SELECT 1 FROM json_each(p.tags_json) tag "
                    f"WHERE tag.value IN ({placeholders}))"
                )
                parameters.extend(categories)

            where_sql = " AND ".join(clauses)
            total = connection.execute(
                "SELECT COUNT(*) AS total FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                f"WHERE {where_sql}",
                parameters,
            ).fetchone()["total"]
            order_sql = {
                "recent": "p.updated_at DESC, p.publication_id",
                "title": "p.title COLLATE NOCASE, p.publication_id",
                "relevance": (
                    "CASE WHEN ? <> '' AND p.title = ? THEN 0 "
                    "WHEN ? <> '' AND p.title LIKE ? THEN 1 "
                    "WHEN ? <> '' AND p.title LIKE ? THEN 2 ELSE 3 END, "
                    "p.updated_at DESC, p.publication_id"
                ),
            }[sort]
            order_parameters: list[Any] = []
            if sort == "relevance":
                order_parameters = [
                    terms,
                    terms,
                    terms,
                    f"{terms}%",
                    terms,
                    f"%{terms}%",
                ]
            rows = connection.execute(
                "SELECT p.*, o.account_id, a.username FROM publications p "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "JOIN accounts a ON a.account_id = o.account_id "
                f"WHERE {where_sql} ORDER BY {order_sql} LIMIT ? OFFSET ?",
                [*parameters, *order_parameters, page_size, (page - 1) * page_size],
            ).fetchall()
            publications = [self._public_row(row) for row in rows]
            if terms and publications:
                publication_ids = [item["publicationId"] for item in publications]
                placeholders = ",".join("?" for _ in publication_ids)
                matches = connection.execute(
                    "SELECT publication_id, resource_id FROM publication_resources "
                    f"WHERE publication_id IN ({placeholders}) AND search_text LIKE ? "
                    "ORDER BY publication_id, path, resource_id",
                    [*publication_ids, f"%{terms}%"],
                ).fetchall()
                by_publication: dict[str, list[str]] = {}
                for match in matches:
                    by_publication.setdefault(match["publication_id"], []).append(match["resource_id"])
                for publication in publications:
                    publication["matchedResourceIds"] = by_publication.get(
                        publication["publicationId"], []
                    )
            return {"publications": publications, "total": total}
        finally:
            connection.close()

    def list_publications(self, query: str | None = None) -> list[dict[str, Any]]:
        return self.search_publications(query=query)["publications"]

    def list_publication_facets(self) -> dict[str, list[dict[str, Any]]]:
        connection = self._database.connect()
        try:
            def values(sql: str) -> list[dict[str, Any]]:
                return [
                    {"value": row["value"], "count": row["count"]}
                    for row in connection.execute(sql).fetchall()
                    if row["count"] > 0
                ]

            return {
                "templateIds": values(
                    "SELECT r.template_id AS value, COUNT(DISTINCT r.publication_id) AS count "
                    "FROM publication_resources r JOIN publications p USING(publication_id) "
                    "WHERE p.status = 'published' GROUP BY r.template_id ORDER BY r.template_id"
                ),
                "targetSystemPackageIds": [
                    *values(
                        "SELECT json_extract(target.value, '$.systemPackageId') AS value, "
                        "COUNT(DISTINCT p.publication_id) AS count FROM publications p, "
                        "json_each(p.logical_document_json, '$.targets') target "
                        "WHERE p.status = 'published' GROUP BY value ORDER BY value"
                    ),
                    *values(
                        "SELECT '__none__' AS value, COUNT(*) AS count FROM publications p "
                        "WHERE p.status = 'published' "
                        "AND json_array_length(json_extract(p.logical_document_json, '$.targets')) = 0 "
                    ),
                ],
                "languages": values(
                    "SELECT p.language AS value, COUNT(*) AS count FROM publications p "
                    "WHERE p.status = 'published' GROUP BY p.language ORDER BY p.language"
                ),
                "categories": values(
                    "SELECT tag.value AS value, COUNT(DISTINCT p.publication_id) AS count "
                    "FROM publications p, json_each(p.tags_json) tag "
                    "WHERE p.status = 'published' GROUP BY tag.value ORDER BY tag.value"
                ),
            }
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

    def get_publication_snapshot(self, publication_id: str) -> dict[str, Any] | None:
        connection = self._database.connect()
        try:
            row = connection.execute(
                "SELECT package_id, package_version, snapshot_digest, logical_document_json "
                "FROM publications WHERE publication_id = ?",
                (publication_id,),
            ).fetchone()
            if row is None:
                return None
            return {
                "packageId": row["package_id"],
                "version": row["package_version"],
                "snapshotDigest": row["snapshot_digest"],
                "document": json.loads(row["logical_document_json"]),
            }
        finally:
            connection.close()

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
        publication = self.get_accessible_publication(
            publication_id, account_id, allow_all
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

    def get_accessible_publication(
        self,
        publication_id: str,
        account_id: str | None = None,
        allow_all: bool = False,
    ) -> dict[str, Any] | None:
        if account_id is not None:
            manageable = self.get_manageable_publication(
                publication_id, account_id, allow_all
            )
            if manageable is not None:
                return manageable
        return self.get_publication(publication_id)

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
                    "name": str(resource.get("data", {}).get("名称") or (
                        resource["path"].rsplit("/", 1)[-1].removesuffix(".json")
                    )),
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


def _uuid_v7() -> str:
    timestamp = int(time.time() * 1000) & ((1 << 48) - 1)
    value = timestamp << 80
    value |= 0x7 << 76
    value |= secrets.randbits(12) << 64
    value |= 0b10 << 62
    value |= secrets.randbits(62)
    return str(UUID(int=value))
