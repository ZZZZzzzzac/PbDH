from __future__ import annotations

import sqlite3
import threading
from pathlib import Path


class Database:
    def __init__(self, path: Path, migrations_path: Path) -> None:
        self.path = path
        self.migrations_path = migrations_path
        self._initialized = False
        self._lock = threading.Lock()

    def connect(self) -> sqlite3.Connection:
        self.ensure_initialized()
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def ensure_initialized(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            self.path.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(self.path, timeout=10)
            try:
                connection.execute("PRAGMA foreign_keys = ON")
                connection.execute("PRAGMA journal_mode = WAL")
                connection.execute(
                    "CREATE TABLE IF NOT EXISTS schema_migrations ("
                    "version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
                )
                applied = {
                    row[0]
                    for row in connection.execute("SELECT version FROM schema_migrations")
                }
                for migration in sorted(self.migrations_path.glob("*.sql")):
                    if migration.stem in applied:
                        continue
                    sql = migration.read_text(encoding="utf-8")
                    escaped_version = migration.stem.replace("'", "''")
                    connection.executescript(
                        "BEGIN IMMEDIATE;\n"
                        f"{sql}\n"
                        "INSERT INTO schema_migrations(version, applied_at) "
                        f"VALUES ('{escaped_version}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));\n"
                        "COMMIT;"
                    )
            except Exception:
                if connection.in_transaction:
                    connection.rollback()
                raise
            finally:
                connection.close()
            self._initialized = True
