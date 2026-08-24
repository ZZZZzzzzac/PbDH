import copy
import io
import json
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from pbdh_backend.contracts import (
    ContractRuntime,
    compute_resource_package_snapshot_digest,
    load_pbres,
    load_resource_package_directory,
    validate_resource_package_semantics,
    write_pbres,
    write_resource_package_directory,
)


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/resource-package/1.0.0-alpha.1"
ASSET_ID = "sha256:0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034"
ASSET_PATH = FIXTURE_ROOT / "media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp"


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


DOCUMENT = read_json(FIXTURE_ROOT / "valid/minotaur-wrecker.json")
MEDIA = {ASSET_ID: ASSET_PATH.read_bytes()}
CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
RUNTIME = ContractRuntime(CATALOG, SCHEMAS)


def validate(document: dict[str, Any], media: dict[str, bytes]) -> list[dict[str, Any]]:
    version = document.get("contractVersion", "1.0.0-alpha.1")
    diagnostics = RUNTIME.validate({
        "family": "resource-package",
        "version": version,
        "mode": "development",
        "candidate": document,
    })
    return diagnostics or validate_resource_package_semantics(document, media)


def mutate_entries(
    source: list[dict[str, Any]],
    mutation: dict[str, str],
) -> list[dict[str, Any]]:
    entries = copy.deepcopy(source)
    kind = mutation["kind"]
    if kind == "add-file":
        entries.append({"path": mutation["path"], "kind": "file", "bytes": b"{}"})
    elif kind == "add-directory":
        entries.append({"path": mutation["path"], "kind": "directory"})
    elif kind == "add-special":
        entries.append({
            "path": mutation["path"],
            "kind": mutation["entryKind"],
        })
    elif kind == "add-collision":
        entries.append({"path": mutation["first"], "kind": "file", "bytes": b"{}"})
        entries.append({"path": mutation["second"], "kind": "file", "bytes": b"{}"})
    elif kind == "duplicate-path":
        entry = next(item for item in entries if item["path"] == mutation["path"])
        entries.append(copy.deepcopy(entry))
    elif kind == "remove-path":
        return [entry for entry in entries if entry["path"] != mutation["path"]]
    elif kind == "tamper-path":
        entry = next(item for item in entries if item["path"] == mutation["path"])
        tampered = bytearray(entry["bytes"])
        tampered[0] ^= 0xFF
        entry["bytes"] = bytes(tampered)
    else:
        raise AssertionError(f"Unknown archive fixture mutation: {kind}")
    return entries


def test_directory_profile_round_trip() -> None:
    entries = write_resource_package_directory(DOCUMENT, MEDIA)
    assert len([entry for entry in entries if entry["path"].startswith("assets/")]) == 1
    result = load_resource_package_directory(entries, validate)
    assert result["diagnostics"] == []
    assert result["candidate"]["document"] == DOCUMENT
    assert result["candidate"]["media"][ASSET_ID] == MEDIA[ASSET_ID]


def test_stable_directory_and_pbres_round_trip() -> None:
    fixture_root = ROOT / "contracts/conformance/resource-package/1.0.0"
    document = read_json(fixture_root / "valid/minotaur-wrecker.json")
    asset_id = document["assets"][0]["id"]
    media = {asset_id: (fixture_root / f"media/{asset_id.removeprefix('sha256:')}.webp").read_bytes()}

    directory_result = load_resource_package_directory(
        write_resource_package_directory(document, media),
        validate,
    )
    assert directory_result["diagnostics"] == []
    assert directory_result["candidate"] == {"document": document, "media": media}

    archive_result = load_pbres(write_pbres(document, media), validate)
    assert archive_result["diagnostics"] == []
    assert archive_result["candidate"] == {"document": document, "media": media}


def test_directory_profile_round_trips_empty_directories() -> None:
    document = copy.deepcopy(DOCUMENT)
    document["emptyDirectories"] = ["敌人/待整理"]
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, MEDIA)
    entries = write_resource_package_directory(document, MEDIA)
    assert {"path": "敌人/待整理/", "kind": "directory"} in entries
    result = load_resource_package_directory(entries, validate)
    assert result["diagnostics"] == []
    assert result["candidate"]["document"] == document


@pytest.mark.parametrize(
    "archive_case",
    read_json(FIXTURE_ROOT / "archive-cases.json"),
    ids=lambda item: item["name"],
)
def test_directory_profile_conformance(archive_case: dict[str, Any]) -> None:
    entries = mutate_entries(
        write_resource_package_directory(DOCUMENT, MEDIA),
        archive_case["mutation"],
    )
    result = load_resource_package_directory(entries, validate)
    assert bool(result["candidate"]) is archive_case["candidate"]
    assert result["diagnostics"] == archive_case["expected"]


def test_pbres_mechanical_differences_preserve_snapshot_digest() -> None:
    stored = write_pbres(
        DOCUMENT,
        MEDIA,
        compression_level=0,
        export_time=datetime(2001, 1, 1),
    )
    compressed = write_pbres(
        DOCUMENT,
        MEDIA,
        compression_level=9,
        export_time=datetime(2026, 8, 18, 12),
    )
    assert stored != compressed
    for archive in (stored, compressed):
        result = load_pbres(archive, validate)
        assert result["diagnostics"] == []
        assert result["candidate"]["document"] == DOCUMENT
        assert result["candidate"]["document"]["snapshotDigest"] == DOCUMENT["snapshotDigest"]


def test_invalid_zip_yields_zero_candidate() -> None:
    result = load_pbres(b"PK", validate)
    assert result == {
        "candidate": None,
        "diagnostics": [{
            "code": "resource-package.archive.zip.invalid",
            "severity": "error",
            "family": "resource-package",
            "version": "1.0.0-alpha.1",
            "location": "",
            "params": {},
        }],
    }


def make_zip(
    path: str,
    payload: bytes,
    *,
    external_attr: int | None = None,
    compression: int = zipfile.ZIP_DEFLATED,
) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        info = zipfile.ZipInfo(path)
        info.compress_type = compression
        if external_attr is not None:
            info.create_system = 3
            info.external_attr = external_attr
        archive.writestr(info, payload)
    return output.getvalue()


@pytest.mark.parametrize(
    ("archive", "expected_code"),
    [
        (make_zip("../evil.json", b"{}"), "resource-package.archive.path.invalid"),
        (
            make_zip("link.webp", b"outside", external_attr=0o120777 << 16),
            "resource-package.archive.entry.special",
        ),
        (
            make_zip("bomb.bin", bytes(256 * 1024)),
            "resource-package.archive.compression-ratio-exceeded",
        ),
    ],
)
def test_pbres_rejects_unsafe_zip(archive: bytes, expected_code: str) -> None:
    result = load_pbres(archive, validate)
    assert result["candidate"] is None
    assert expected_code in [item["code"] for item in result["diagnostics"]]
