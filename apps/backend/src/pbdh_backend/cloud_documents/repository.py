from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from pbdh_backend.database import Database


class CloudDocumentNotFound(Exception):
    pass


class CloudDocumentPermissionDenied(Exception):
    pass


class CloudDocumentRevisionConflict(Exception):
    pass


class CloudDocumentStateConflict(Exception):
    pass


@dataclass(frozen=True)
class CloudMediaNotReady(Exception):
    asset_ids: list[str]


class CloudMediaInvalid(Exception):
    pass


class CloudDocumentRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def prepare_media(self, asset_id: str, media_type: str, content: bytes) -> dict[str, object]:
        expected = f"sha256:{hashlib.sha256(content).hexdigest()}"
        if asset_id != expected or media_type != "image/webp":
            raise CloudMediaInvalid(asset_id)
        connection = self._database.connect()
        try:
            connection.execute(
                "INSERT INTO media_blobs(asset_id, media_type, byte_length, bytes) "
                "VALUES (?, ?, ?, ?) ON CONFLICT(asset_id) DO NOTHING",
                (asset_id, media_type, len(content), content),
            )
            connection.commit()
        finally:
            connection.close()
        return {"assetId": asset_id, "byteLength": len(content), "ready": True}

    def list_documents(
        self,
        account_id: str,
        document_kind: str | None,
        include_deleted: bool,
    ) -> list[dict[str, Any]]:
        connection = self._database.connect()
        try:
            self._purge_expired(connection)
            rows = connection.execute(
                "SELECT * FROM cloud_documents WHERE account_id = ? "
                "AND (? IS NULL OR document_kind = ?) "
                "AND (? = 1 OR deleted_at IS NULL) "
                "ORDER BY updated_at DESC, document_id",
                (account_id, document_kind, document_kind, include_deleted),
            ).fetchall()
            return [self._document_row(connection, row) for row in rows]
        finally:
            connection.close()

    def get_document(self, account_id: str, document_id: str) -> dict[str, Any] | None:
        connection = self._database.connect()
        try:
            self._purge_expired(connection)
            row = connection.execute(
                "SELECT * FROM cloud_documents WHERE document_id = ? AND account_id = ?",
                (document_id, account_id),
            ).fetchone()
            return None if row is None else self._document_row(connection, row)
        finally:
            connection.close()

    def put_document(
        self,
        account_id: str,
        document_id: str,
        mutation_id: str,
        document_kind: str,
        contract_family: str,
        contract_version: str,
        base_revision: int | None,
        asset_ids: list[str],
        payload: dict[str, Any],
        force: bool,
    ) -> dict[str, Any]:
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            replay = self._mutation_result(connection, account_id, mutation_id)
            if replay is not None:
                connection.commit()
                return replay
            current = connection.execute(
                "SELECT * FROM cloud_documents WHERE document_id = ?",
                (document_id,),
            ).fetchone()
            if current is not None and current["account_id"] != account_id:
                raise CloudDocumentPermissionDenied(document_id)
            if current is not None and current["deleted_at"] is not None:
                raise CloudDocumentStateConflict(document_id)
            current_revision = None if current is None else int(current["revision"])
            if not force and base_revision != current_revision:
                raise CloudDocumentRevisionConflict(document_id)
            if current is not None and current["document_kind"] != document_kind:
                raise CloudDocumentStateConflict(document_id)
            unique_assets = sorted(set(asset_ids))
            missing = self._missing_media(connection, unique_assets)
            if missing:
                raise CloudMediaNotReady(missing)
            revision = 1 if current_revision is None else current_revision + 1
            payload_json = self._json(payload)
            if current is None:
                connection.execute(
                    "INSERT INTO cloud_documents("
                    "document_id, account_id, document_kind, contract_family, contract_version, "
                    "revision, payload_json, created_at, updated_at, deleted_at, purge_after"
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, "
                    "strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
                    "strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL, NULL)",
                    (
                        document_id,
                        account_id,
                        document_kind,
                        contract_family,
                        contract_version,
                        revision,
                        payload_json,
                    ),
                )
            else:
                connection.execute(
                    "UPDATE cloud_documents SET contract_family = ?, contract_version = ?, "
                    "revision = ?, payload_json = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                    "WHERE document_id = ?",
                    (contract_family, contract_version, revision, payload_json, document_id),
                )
            connection.execute("DELETE FROM cloud_document_media WHERE document_id = ?", (document_id,))
            connection.executemany(
                "INSERT INTO cloud_document_media(document_id, asset_id) VALUES (?, ?)",
                [(document_id, asset_id) for asset_id in unique_assets],
            )
            result = self._required_document(connection, account_id, document_id)
            self._record_mutation(connection, account_id, mutation_id, document_id, result)
            connection.commit()
            return result
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    def trash_document(
        self,
        account_id: str,
        document_id: str,
        mutation_id: str,
        base_revision: int,
    ) -> dict[str, Any]:
        return self._set_deleted(account_id, document_id, mutation_id, base_revision, True)

    def restore_document(
        self,
        account_id: str,
        document_id: str,
        mutation_id: str,
        base_revision: int,
    ) -> dict[str, Any]:
        return self._set_deleted(account_id, document_id, mutation_id, base_revision, False)

    def delete_document(
        self,
        account_id: str,
        document_id: str,
        base_revision: int,
    ) -> None:
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT revision, deleted_at FROM cloud_documents "
                "WHERE document_id = ? AND account_id = ?",
                (document_id, account_id),
            ).fetchone()
            if current is None:
                raise CloudDocumentNotFound(document_id)
            if int(current["revision"]) != base_revision:
                raise CloudDocumentRevisionConflict(document_id)
            if current["deleted_at"] is None:
                raise CloudDocumentStateConflict(document_id)
            connection.execute("DELETE FROM cloud_documents WHERE document_id = ?", (document_id,))
            connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    def get_media(
        self,
        account_id: str,
        document_id: str,
        asset_id: str,
    ) -> tuple[str, bytes] | None:
        connection = self._database.connect()
        try:
            self._purge_expired(connection)
            row = connection.execute(
                "SELECT b.media_type, b.bytes FROM media_blobs b "
                "JOIN cloud_document_media m ON m.asset_id = b.asset_id "
                "JOIN cloud_documents d ON d.document_id = m.document_id "
                "WHERE d.document_id = ? AND d.account_id = ? AND m.asset_id = ?",
                (document_id, account_id, asset_id),
            ).fetchone()
            return None if row is None else (row["media_type"], row["bytes"])
        finally:
            connection.close()

    def _set_deleted(
        self,
        account_id: str,
        document_id: str,
        mutation_id: str,
        base_revision: int,
        deleted: bool,
    ) -> dict[str, Any]:
        connection = self._database.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            replay = self._mutation_result(connection, account_id, mutation_id)
            if replay is not None:
                connection.commit()
                return replay
            current = connection.execute(
                "SELECT * FROM cloud_documents WHERE document_id = ? AND account_id = ?",
                (document_id, account_id),
            ).fetchone()
            if current is None:
                raise CloudDocumentNotFound(document_id)
            if int(current["revision"]) != base_revision:
                raise CloudDocumentRevisionConflict(document_id)
            if (current["deleted_at"] is not None) == deleted:
                raise CloudDocumentStateConflict(document_id)
            revision = base_revision + 1
            if deleted:
                connection.execute(
                    "UPDATE cloud_documents SET revision = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
                    "deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
                    "purge_after = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days') "
                    "WHERE document_id = ?",
                    (revision, document_id),
                )
            else:
                connection.execute(
                    "UPDATE cloud_documents SET revision = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), "
                    "deleted_at = NULL, purge_after = NULL WHERE document_id = ?",
                    (revision, document_id),
                )
            result = self._required_document(connection, account_id, document_id)
            self._record_mutation(connection, account_id, mutation_id, document_id, result)
            connection.commit()
            return result
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _purge_expired(connection: sqlite3.Connection) -> None:
        connection.execute(
            "DELETE FROM cloud_documents WHERE deleted_at IS NOT NULL "
            "AND purge_after <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
        )
        connection.commit()

    @staticmethod
    def _json(value: object) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    @staticmethod
    def _missing_media(connection: sqlite3.Connection, asset_ids: list[str]) -> list[str]:
        if not asset_ids:
            return []
        placeholders = ",".join("?" for _ in asset_ids)
        found = {
            row["asset_id"]
            for row in connection.execute(
                f"SELECT asset_id FROM media_blobs WHERE asset_id IN ({placeholders})",
                asset_ids,
            )
        }
        return [asset_id for asset_id in asset_ids if asset_id not in found]

    @staticmethod
    def _mutation_result(
        connection: sqlite3.Connection,
        account_id: str,
        mutation_id: str,
    ) -> dict[str, Any] | None:
        row = connection.execute(
            "SELECT result_json FROM cloud_document_mutations "
            "WHERE account_id = ? AND mutation_id = ?",
            (account_id, mutation_id),
        ).fetchone()
        return None if row is None else json.loads(row["result_json"])

    def _record_mutation(
        self,
        connection: sqlite3.Connection,
        account_id: str,
        mutation_id: str,
        document_id: str,
        result: dict[str, Any],
    ) -> None:
        connection.execute(
            "INSERT INTO cloud_document_mutations("
            "account_id, mutation_id, document_id, result_json, created_at"
            ") VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
            (account_id, mutation_id, document_id, self._json(result)),
        )

    def _required_document(
        self,
        connection: sqlite3.Connection,
        account_id: str,
        document_id: str,
    ) -> dict[str, Any]:
        row = connection.execute(
            "SELECT * FROM cloud_documents WHERE document_id = ? AND account_id = ?",
            (document_id, account_id),
        ).fetchone()
        if row is None:
            raise CloudDocumentNotFound(document_id)
        return self._document_row(connection, row)

    @staticmethod
    def _document_row(connection: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
        asset_ids = [
            asset["asset_id"]
            for asset in connection.execute(
                "SELECT asset_id FROM cloud_document_media WHERE document_id = ? ORDER BY asset_id",
                (row["document_id"],),
            )
        ]
        return {
            "documentId": row["document_id"],
            "documentKind": row["document_kind"],
            "contractFamily": row["contract_family"],
            "contractVersion": row["contract_version"],
            "revision": int(row["revision"]),
            "payload": json.loads(row["payload_json"]),
            "assetIds": asset_ids,
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "deletedAt": row["deleted_at"],
            "purgeAfter": row["purge_after"],
        }
