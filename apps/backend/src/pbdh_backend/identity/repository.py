from __future__ import annotations

import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from pbdh_backend.api_errors import ApiError
from pbdh_backend.database import Database


@dataclass(frozen=True)
class Account:
    account_id: str
    auth_subject: str
    username: str | None


@dataclass(frozen=True)
class ActiveSession:
    session_id: str
    account_id: str


class IdentityRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def get_or_create_account(self, auth_subject: str) -> Account:
        now = utc_now()
        with self.database.connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO accounts("
                "account_id, auth_subject, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (f"account_{uuid4().hex}", auth_subject, now, now),
            )
            row = connection.execute(
                "SELECT account_id, auth_subject, username FROM accounts "
                "WHERE auth_subject = ? AND deleted_at IS NULL",
                (auth_subject,),
            ).fetchone()
        if not row:
            raise ApiError(404, "AUTH_ACCOUNT_NOT_FOUND", "账号不存在。")
        return to_account(row)

    def get_active_session(self, account_id: str) -> ActiveSession | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT session_id, account_id FROM active_sessions WHERE account_id = ?",
                (account_id,),
            ).fetchone()
        return ActiveSession(row["session_id"], row["account_id"]) if row else None

    def claim_session(
        self,
        account_id: str,
        current_session_id: str | None,
        replace_existing: bool,
        new_session_id: str,
    ) -> tuple[ActiveSession, bool]:
        now = utc_now()
        with self.database.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT session_id, account_id FROM active_sessions WHERE account_id = ?",
                (account_id,),
            ).fetchone()
            if row and current_session_id == row["session_id"]:
                connection.execute(
                    "UPDATE active_sessions SET last_seen_at = ? WHERE session_id = ?",
                    (now, row["session_id"]),
                )
                connection.commit()
                return ActiveSession(row["session_id"], row["account_id"]), False
            if row and not replace_existing:
                connection.rollback()
                raise ApiError(
                    409,
                    "AUTH_SESSION_REPLACEMENT_REQUIRED",
                    "此账号已在其他设备登录，继续将顶掉旧会话。",
                )
            connection.execute(
                "DELETE FROM active_sessions WHERE account_id = ?", (account_id,)
            )
            connection.execute(
                "INSERT INTO active_sessions("
                "session_id, account_id, claimed_at, last_seen_at) VALUES (?, ?, ?, ?)",
                (new_session_id, account_id, now, now),
            )
            connection.commit()
        return ActiveSession(new_session_id, account_id), bool(row)

    def require_active_session(self, account_id: str, session_id: str) -> None:
        with self.database.connect() as connection:
            cursor = connection.execute(
                "UPDATE active_sessions SET last_seen_at = ? "
                "WHERE account_id = ? AND session_id = ?",
                (utc_now(), account_id, session_id),
            )
            if cursor.rowcount != 1:
                raise ApiError(
                    401,
                    "AUTH_SESSION_REPLACED",
                    "此账号已在其他设备登录，云端写入已停止。",
                )

    def release_session(self, account_id: str, session_id: str) -> None:
        with self.database.connect() as connection:
            connection.execute(
                "DELETE FROM active_sessions WHERE account_id = ? AND session_id = ?",
                (account_id, session_id),
            )

    def set_username(self, account_id: str, username: str) -> Account:
        username_key = unicodedata.normalize("NFKC", username).casefold()
        try:
            with self.database.connect() as connection:
                cursor = connection.execute(
                    "UPDATE accounts SET username = ?, username_key = ?, updated_at = ? "
                    "WHERE account_id = ? AND deleted_at IS NULL",
                    (username, username_key, utc_now(), account_id),
                )
                if cursor.rowcount != 1:
                    raise ApiError(404, "AUTH_ACCOUNT_NOT_FOUND", "账号不存在。")
                row = connection.execute(
                    "SELECT account_id, auth_subject, username FROM accounts "
                    "WHERE account_id = ?",
                    (account_id,),
                ).fetchone()
        except sqlite3.IntegrityError as error:
            raise ApiError(
                409,
                "USERNAME_TAKEN",
                "该用户名已被使用。",
                [{"path": "/username", "code": "USERNAME_TAKEN", "message": "请换一个用户名。"}],
            ) from error
        return to_account(row)


def to_account(row: sqlite3.Row) -> Account:
    return Account(row["account_id"], row["auth_subject"], row["username"])


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
