from __future__ import annotations

import json
from collections import Counter

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from pbdh_backend.identity.router import AuthenticatedAccount, active_account


router = APIRouter(prefix="/api/storage", tags=["storage"])


class StorageEntry(BaseModel):
    id: str
    name: str
    kind: str
    deleted: bool
    mediaBytes: int
    ownedBytes: int
    reclaimableBytes: int
    dataBytes: int


class StorageUsage(BaseModel):
    usedBytes: int
    limitBytes: int | None
    unattachedBytes: int
    dataBytes: int
    entries: list[StorageEntry]


@router.get("/usage", response_model=StorageUsage)
def storage_usage(request: Request, auth: AuthenticatedAccount = Depends(active_account)) -> dict[str, object]:
    media = request.app.state.managed_media
    return media.storage_usage(auth.account.account_id)


def summarize_storage(connection, account_id: str, limit: int | None) -> dict[str, object]:
    # 在同一读取快照中计算所有引用，避免共享媒体被重复计为可释放容量。
    sizes = {r["asset_id"]: int(r["byte_length"]) for r in connection.execute(
        "SELECT o.asset_id, b.byte_length FROM account_media_ownership o "
        "JOIN media_blobs b ON b.asset_id = o.asset_id WHERE o.account_id = ?", (account_id,),
    )}
    entries = []
    references: Counter[str] = Counter()
    for row in connection.execute("SELECT * FROM cloud_documents WHERE account_id = ?", (account_id,)):
        raw = json.loads(row["payload_json"])
        payload = raw if isinstance(raw, dict) else {}
        document = payload.get("document", payload)
        document = document if isinstance(document, dict) else {}
        package = document.get("package", {})
        package = package if isinstance(package, dict) else {}
        title = next((name for name in [package.get("name"), document.get("name"), payload.get("name")]
                      if isinstance(name, str) and name.strip()), row["document_id"])
        assets = list(connection.execute(
            "SELECT m.asset_id, m.owns_asset, b.byte_length FROM cloud_document_media m "
            "JOIN media_blobs b ON b.asset_id = m.asset_id WHERE m.document_id = ?", (row["document_id"],),
        ))
        owned = {r["asset_id"] for r in assets if r["owns_asset"] and r["asset_id"] in sizes}
        references.update(owned)
        entries.append({"id": row["document_id"], "name": title, "kind": row["document_kind"],
                        "deleted": row["deleted_at"] is not None,
                        "dataBytes": len(row["payload_json"].encode("utf-8")),
                        "mediaBytes": sum(int(r["byte_length"]) for r in assets), "owned": owned})
    for row in connection.execute(
        "SELECT p.* FROM publications p JOIN package_ownership o ON o.package_id = p.package_id "
        "WHERE o.account_id = ?", (account_id,),
    ):
        assets = list(connection.execute(
            "SELECT m.asset_id, b.byte_length FROM publication_media m "
            "JOIN media_blobs b ON b.asset_id = m.asset_id WHERE m.publication_id = ?", (row["publication_id"],),
        ))
        owned = {r["asset_id"] for r in assets if r["asset_id"] in sizes}
        references.update(owned)
        entries.append({"id": row["publication_id"], "name": row["title"], "kind": "publication",
                        "deleted": False, "dataBytes": len(row["logical_document_json"].encode("utf-8")),
                        "mediaBytes": sum(int(r["byte_length"]) for r in assets), "owned": owned})
    for entry in entries:
        owned = entry.pop("owned")
        entry["ownedBytes"] = sum(sizes[a] for a in owned)
        entry["reclaimableBytes"] = sum(sizes[a] for a in owned if references[a] == 1)
    return {"usedBytes": sum(sizes.values()), "limitBytes": limit,
            "dataBytes": sum(entry["dataBytes"] for entry in entries),
            "unattachedBytes": sum(size for asset, size in sizes.items() if not references[asset]),
            "entries": sorted(entries, key=lambda e: (e["deleted"], e["kind"], e["name"]))}
