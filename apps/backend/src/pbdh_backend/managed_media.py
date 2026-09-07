from __future__ import annotations

import hashlib
import sqlite3
from dataclasses import dataclass
from typing import Iterable, Mapping

from pbdh_backend.database import Database
from pbdh_backend.media import InvalidWebP, validate_normalized_webp


class ManagedMediaInvalid(Exception):
    pass


@dataclass(frozen=True)
class ManagedMediaQuotaExceeded(Exception):
    limit: int
    usage: int
    requested: int


class ManagedMedia:
    """统一托管媒体的所有权、文档授权、配额与回收规则。"""

    def __init__(self, database: Database, account_quota_bytes: int | None = None) -> None:
        self._database = database
        self._account_quota_bytes = account_quota_bytes

    def prepare_owned(
        self,
        account_id: str,
        asset_id: str,
        media_type: str,
        content: bytes,
    ) -> dict[str, object]:
        expected = f"sha256:{hashlib.sha256(content).hexdigest()}"
        try:
            validate_normalized_webp(content)
        except InvalidWebP:
            raise ManagedMediaInvalid(asset_id) from None
        if asset_id != expected or media_type != "image/webp":
            raise ManagedMediaInvalid(asset_id)

        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            self.store_blobs(connection, {
                asset_id: (media_type, content),
            })
            self.claim_ownership(connection, account_id, [asset_id])
            connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()
        return {"assetId": asset_id, "byteLength": len(content), "ready": True}

    @staticmethod
    def store_blobs(
        connection: sqlite3.Connection,
        media: Mapping[str, tuple[str, bytes]],
    ) -> None:
        connection.executemany(
            "INSERT INTO media_blobs(asset_id, media_type, byte_length, bytes) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(asset_id) DO NOTHING",
            [
                (asset_id, media_type, len(content), content)
                for asset_id, (media_type, content) in media.items()
            ],
        )

    def claim_ownership(
        self,
        connection: sqlite3.Connection,
        account_id: str,
        asset_ids: Iterable[str],
    ) -> None:
        requested = sorted(set(asset_ids))
        if not requested:
            return
        placeholders = ",".join("?" for _ in requested)
        new_assets = [
            row
            for row in connection.execute(
                "SELECT b.asset_id, b.byte_length FROM media_blobs b "
                f"WHERE b.asset_id IN ({placeholders}) AND NOT EXISTS ("
                "SELECT 1 FROM account_media_ownership o "
                "WHERE o.account_id = ? AND o.asset_id = b.asset_id)",
                [*requested, account_id],
            ).fetchall()
        ]
        if len(new_assets) != len(requested) - self._owned_count(connection, account_id, requested):
            raise ManagedMediaInvalid("missing media blob")
        additional = sum(int(row["byte_length"]) for row in new_assets)
        usage = self.owned_usage(connection, account_id)
        if self._account_quota_bytes is not None and usage + additional > self._account_quota_bytes:
            raise ManagedMediaQuotaExceeded(self._account_quota_bytes, usage, additional)
        connection.executemany(
            "INSERT INTO account_media_ownership(account_id, asset_id, acquired_at) "
            "VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) "
            "ON CONFLICT(account_id, asset_id) DO NOTHING",
            [(account_id, row["asset_id"]) for row in new_assets],
        )

    @staticmethod
    def owned_usage(connection: sqlite3.Connection, account_id: str) -> int:
        row = connection.execute(
            "SELECT COALESCE(SUM(b.byte_length), 0) AS usage "
            "FROM account_media_ownership o "
            "JOIN media_blobs b ON b.asset_id = o.asset_id WHERE o.account_id = ?",
            (account_id,),
        ).fetchone()
        return int(row["usage"])

    def storage_usage(self, account_id: str) -> dict[str, object]:
        from pbdh_backend.storage_usage import summarize_storage

        connection = self._database.connect()
        try:
            connection.execute("BEGIN")
            return summarize_storage(connection, account_id, self._account_quota_bytes)
        finally:
            connection.rollback()
            connection.close()

    @staticmethod
    def authorize_document_assets(
        connection: sqlite3.Connection,
        account_id: str,
        document_id: str,
        asset_ids: Iterable[str],
    ) -> tuple[dict[str, bool], list[str]]:
        authorization: dict[str, bool] = {}
        denied: list[str] = []
        for asset_id in sorted(set(asset_ids)):
            owned = connection.execute(
                "SELECT 1 FROM account_media_ownership WHERE account_id = ? AND asset_id = ?",
                (account_id, asset_id),
            ).fetchone() is not None
            retained = connection.execute(
                "SELECT 1 FROM cloud_document_media m "
                "JOIN cloud_documents d ON d.document_id = m.document_id "
                "WHERE d.account_id = ? AND d.document_id = ? AND m.asset_id = ?",
                (account_id, document_id, asset_id),
            ).fetchone() is not None
            public = connection.execute(
                "SELECT 1 FROM publication_media m "
                "JOIN publications p ON p.publication_id = m.publication_id "
                "WHERE p.status = 'published' AND m.asset_id = ? LIMIT 1",
                (asset_id,),
            ).fetchone() is not None
            if not (owned or retained or public):
                denied.append(asset_id)
            else:
                authorization[asset_id] = owned
        return authorization, denied

    def replace_document_references(
        self,
        connection: sqlite3.Connection,
        account_id: str,
        document_id: str,
        authorization: Mapping[str, bool],
    ) -> None:
        previous_owned = {
            row["asset_id"]
            for row in connection.execute(
                "SELECT asset_id FROM cloud_document_media "
                "WHERE document_id = ? AND owns_asset = 1",
                (document_id,),
            ).fetchall()
        }
        connection.execute("DELETE FROM cloud_document_media WHERE document_id = ?", (document_id,))
        connection.executemany(
            "INSERT INTO cloud_document_media(document_id, asset_id, owns_asset) VALUES (?, ?, ?)",
            [
                (document_id, asset_id, 1 if owns_asset else 0)
                for asset_id, owns_asset in sorted(authorization.items())
            ],
        )
        self.release_unreferenced_ownership(
            connection,
            account_id,
            previous_owned - set(authorization),
        )

    def release_unreferenced_ownership(
        self,
        connection: sqlite3.Connection,
        account_id: str,
        asset_ids: Iterable[str],
    ) -> None:
        for asset_id in sorted(set(asset_ids)):
            has_owned_document = connection.execute(
                "SELECT 1 FROM cloud_document_media m "
                "JOIN cloud_documents d ON d.document_id = m.document_id "
                "WHERE d.account_id = ? AND m.asset_id = ? AND m.owns_asset = 1 LIMIT 1",
                (account_id, asset_id),
            ).fetchone() is not None
            has_publication = connection.execute(
                "SELECT 1 FROM publication_media m "
                "JOIN publications p ON p.publication_id = m.publication_id "
                "JOIN package_ownership o ON o.package_id = p.package_id "
                "WHERE o.account_id = ? AND m.asset_id = ? LIMIT 1",
                (account_id, asset_id),
            ).fetchone() is not None
            if not has_owned_document and not has_publication:
                connection.execute(
                    "DELETE FROM account_media_ownership WHERE account_id = ? AND asset_id = ?",
                    (account_id, asset_id),
                )
        self.collect_unreferenced_blobs(connection)

    @staticmethod
    def collect_unreferenced_blobs(connection: sqlite3.Connection) -> None:
        connection.execute(
            "DELETE FROM media_blobs WHERE NOT EXISTS ("
            "SELECT 1 FROM publication_media pm WHERE pm.asset_id = media_blobs.asset_id"
            ") AND NOT EXISTS ("
            "SELECT 1 FROM cloud_document_media cm WHERE cm.asset_id = media_blobs.asset_id"
            ") AND NOT EXISTS ("
            "SELECT 1 FROM account_media_ownership ao WHERE ao.asset_id = media_blobs.asset_id"
            ")"
        )

    @staticmethod
    def _owned_count(
        connection: sqlite3.Connection,
        account_id: str,
        asset_ids: list[str],
    ) -> int:
        if not asset_ids:
            return 0
        placeholders = ",".join("?" for _ in asset_ids)
        row = connection.execute(
            f"SELECT COUNT(*) AS count FROM account_media_ownership "
            f"WHERE account_id = ? AND asset_id IN ({placeholders})",
            [account_id, *asset_ids],
        ).fetchone()
        return int(row["count"])
