from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def create_backup(source: Path, destination_dir: Path) -> Path:
    source = source.resolve()
    if not source.is_file():
        raise FileNotFoundError(f"database does not exist: {source}")

    destination_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"pbdh-{timestamp}.sqlite3"
    if destination.exists():
        raise FileExistsError(f"backup already exists: {destination}")

    with sqlite3.connect(source) as source_connection:
        with sqlite3.connect(destination) as destination_connection:
            source_connection.backup(destination_connection)
            result = destination_connection.execute("PRAGMA integrity_check").fetchone()

    if result != ("ok",):
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"backup integrity check failed: {result!r}")
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a consistent PbDH SQLite backup.")
    parser.add_argument("source", nargs="?", type=Path, default=Path("/data/pbdh.sqlite3"))
    parser.add_argument("destination", nargs="?", type=Path, default=Path("/data/backups"))
    arguments = parser.parse_args()
    print(create_backup(arguments.source, arguments.destination))


if __name__ == "__main__":
    main()
