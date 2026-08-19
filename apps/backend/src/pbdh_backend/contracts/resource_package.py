import copy
import hashlib
import json
import struct
from collections.abc import Mapping
from typing import Any


FAMILY = "resource-package"
VERSION = "1.0.0-alpha.1"
DIGEST_DOMAIN = "pbdh-resource-package-digest-v1"


def _utf16_sort_key(value: str) -> bytes:
    return value.encode("utf-16-be")


def _canonicalize(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        value.encode("utf-8")
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return f"[{','.join(_canonicalize(item) for item in value)}]"
    if isinstance(value, Mapping):
        keys = sorted(value, key=_utf16_sort_key)
        return "{" + ",".join(
            f"{json.dumps(key, ensure_ascii=False)}:{_canonicalize(value[key])}"
            for key in keys
        ) + "}"
    raise ValueError("Resource Package canonical JSON supports only string, boolean, null, array, and object")


def _normalized_document(document: Mapping[str, Any]) -> dict[str, Any]:
    content = copy.deepcopy(dict(document))
    content.pop("snapshotDigest", None)
    content["targets"].sort(
        key=lambda item: (item["systemPackageId"], item["version"])
    )
    content["assets"].sort(key=lambda item: item["id"])
    content["resources"].sort(key=lambda item: (item["path"], item["id"]))
    content["emptyDirectories"].sort()
    return content


def _frame(frame_type: str, payload: bytes) -> bytes:
    type_bytes = frame_type.encode("utf-8")
    return (
        struct.pack(">I", len(type_bytes))
        + type_bytes
        + struct.pack(">Q", len(payload))
        + payload
    )


def compute_resource_package_snapshot_digest(
    document: Mapping[str, Any],
    media: Mapping[str, bytes],
) -> str:
    parts = [
        _frame("domain", DIGEST_DOMAIN.encode("utf-8")),
        _frame(
            "logical-document",
            _canonicalize(_normalized_document(document)).encode("utf-8"),
        ),
    ]
    for asset in sorted(document["assets"], key=lambda item: item["id"]):
        asset_id = asset["id"]
        if asset_id not in media:
            raise ValueError(f"Missing media bytes: {asset_id}")
        parts.append(_frame("asset-id", asset_id.encode("utf-8")))
        parts.append(_frame("asset-bytes", media[asset_id]))
    return f"sha256:{hashlib.sha256(b''.join(parts)).hexdigest()}"


def _diagnostic(
    code: str,
    location: str,
    params: Mapping[str, Any],
) -> dict[str, Any]:
    return {
        "code": code,
        "severity": "error",
        "family": FAMILY,
        "version": VERSION,
        "location": location,
        "params": dict(params),
    }


def _pointer_segment(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def validate_resource_package_semantics(
    document: Mapping[str, Any],
    media: Mapping[str, bytes],
) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    resource_ids: set[str] = set()
    targets: set[tuple[str, str]] = set()
    asset_ids: set[str] = set()

    for index, resource in enumerate(document["resources"]):
        resource_id = resource["id"]
        if resource_id in resource_ids:
            diagnostics.append(_diagnostic(
                "resource-package.resource-id.duplicate",
                f"/resources/{index}/id",
                {"id": resource_id},
            ))
        resource_ids.add(resource_id)

    for index, target in enumerate(document["targets"]):
        key = (target["systemPackageId"], target["version"])
        if key in targets:
            diagnostics.append(_diagnostic(
                "resource-package.target.duplicate",
                f"/targets/{index}",
                {
                    "systemPackageId": target["systemPackageId"],
                    "version": target["version"],
                },
            ))
        targets.add(key)

    for index, asset in enumerate(document["assets"]):
        asset_id = asset["id"]
        if asset_id in asset_ids:
            diagnostics.append(_diagnostic(
                "resource-package.asset-id.duplicate",
                f"/assets/{index}/id",
                {"id": asset_id},
            ))
        asset_ids.add(asset_id)
        media_bytes = media.get(asset_id)
        if media_bytes is None:
            diagnostics.append(_diagnostic(
                "resource-package.media.bytes-missing",
                f"/assets/{index}/id",
                {"assetId": asset_id},
            ))
            continue
        actual_id = f"sha256:{hashlib.sha256(media_bytes).hexdigest()}"
        if actual_id != asset_id:
            diagnostics.append(_diagnostic(
                "resource-package.media.digest-mismatch",
                f"/assets/{index}/id",
                {"actual": actual_id, "expected": asset_id},
            ))
        if str(len(media_bytes)) != asset["byteLength"]:
            diagnostics.append(_diagnostic(
                "resource-package.media.byte-length-mismatch",
                f"/assets/{index}/byteLength",
                {"actual": str(len(media_bytes)), "expected": asset["byteLength"]},
            ))

    for resource_index, resource in enumerate(document["resources"]):
        for slot, asset_id in resource["media"].items():
            if asset_id not in asset_ids:
                diagnostics.append(_diagnostic(
                    "resource-package.media.asset-undeclared",
                    f"/resources/{resource_index}/media/{_pointer_segment(slot)}",
                    {"assetId": asset_id},
                ))

    if not diagnostics:
        actual = compute_resource_package_snapshot_digest(document, media)
        if actual != document["snapshotDigest"]:
            diagnostics.append(_diagnostic(
                "resource-package.snapshot-digest.mismatch",
                "/snapshotDigest",
                {"actual": actual, "expected": document["snapshotDigest"]},
            ))

    return sorted(diagnostics, key=lambda item: (item["location"], item["code"]))
