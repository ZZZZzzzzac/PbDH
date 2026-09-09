"""只读预览旧回执压缩；明确批准后以 --apply --backup 执行。"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/backend/src"))
from pbdh_backend.cloud_documents.repository import CloudDocumentRepository
from pbdh_backend.database import Database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    database = args.database.resolve(strict=True)
    if args.apply and (args.backup is None or args.backup.exists()):
        parser.error("--apply 必须指定一个尚不存在的 --backup 文件")
    repository = CloudDocumentRepository(Database(database, database.parent))
    connection = sqlite3.connect(f"{database.as_uri()}?mode={'rw' if args.apply else 'ro'}", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        if args.apply:
            connection.execute("BEGIN IMMEDIATE")
            # 写锁下通过独立只读连接备份，包含 WAL 中已提交的数据。
            with sqlite3.connect(f"{database.as_uri()}?mode=ro", uri=True) as source:
                with sqlite3.connect(args.backup) as backup:
                    source.backup(backup)
        rows = connection.execute("SELECT rowid, * FROM cloud_document_mutations ORDER BY created_at DESC, rowid DESC").fetchall()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=repository.RECEIPT_DAYS)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        counts: dict[tuple[str, str], int] = {}
        updates: list[tuple[str, int]] = []
        discarded: list[tuple[int]] = []
        before_bytes = after_bytes = legacy = 0
        for row in rows:
            result = json.loads(row["result_json"])
            is_legacy = result.get("receiptVersion") != 1
            legacy += int(is_legacy)
            before_bytes += len(row["result_json"].encode("utf-8"))
            receipt = repository.compact_receipt(result) if is_legacy else result
            key = (row["account_id"], row["document_id"])
            counts[key] = counts.get(key, 0) + 1
            if row["created_at"] <= cutoff or counts[key] > repository.RECEIPT_LIMIT:
                discarded.append((row["rowid"],))
                continue
            encoded = json.dumps(receipt, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            after_bytes += len(encoded.encode("utf-8"))
            if is_legacy:
                updates.append((encoded, row["rowid"]))
        if args.apply:
            connection.executemany("UPDATE cloud_document_mutations SET result_json = ? WHERE rowid = ?", updates)
            connection.executemany("DELETE FROM cloud_document_mutations WHERE rowid = ?", discarded)
            connection.commit()
        print(json.dumps({"applied": args.apply, "recordsBefore": len(rows), "legacyRecords": legacy,
            "recordsAfter": len(rows) - len(discarded), "receiptBytesBefore": before_bytes,
            "receiptBytesAfter": after_bytes, "discardedRecords": len(discarded)}, ensure_ascii=False))
    finally:
        if connection.in_transaction:
            connection.rollback()
        connection.close()


if __name__ == "__main__":
    main()
