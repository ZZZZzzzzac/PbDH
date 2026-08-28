import copy
import hashlib
import io
import json
import re
import unicodedata
import zipfile
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from typing import Any


FAMILY = "resource-package"
VERSION = "1.0.0"
ROOT_PATH = "package.json"
MAX_ENTRIES = 1024
MAX_PATH_BYTES = 512
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_EXPANDED_BYTES = 64 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100
WINDOWS_RESERVED = re.compile(
    r"^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$",
    re.IGNORECASE,
)
ASSET_PATH = re.compile(r"^assets/([0-9a-f]{64})\.webp$")


Diagnostic = dict[str, Any]
PortableEntry = dict[str, Any]
CandidateValidator = Callable[[Mapping[str, Any], Mapping[str, bytes]], list[Diagnostic]]


def _diagnostic(
    code: str,
    location: str,
    params: Mapping[str, Any] | None = None,
    severity: str = "error",
) -> Diagnostic:
    return {
        "code": code,
        "severity": severity,
        "family": FAMILY,
        "version": VERSION,
        "location": location,
        "params": dict(params or {}),
    }


def _sort_diagnostics(diagnostics: list[Diagnostic]) -> list[Diagnostic]:
    return sorted(diagnostics, key=lambda item: (item["location"], item["code"]))


def _has_errors(diagnostics: Sequence[Diagnostic]) -> bool:
    return any(item["severity"] == "error" for item in diagnostics)


def _path_problem(path: str, directory: bool) -> str | None:
    candidate = path[:-1] if directory and path.endswith("/") else path
    if not candidate:
        return "empty"
    if len(candidate.encode("utf-8")) > MAX_PATH_BYTES:
        return "too-long"
    if candidate.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", candidate):
        return "absolute"
    if "\\" in candidate:
        return "backslash"
    for segment in candidate.split("/"):
        if not segment:
            return "empty-segment"
        if segment in (".", ".."):
            return "traversal"
        if any(unicodedata.category(character) == "Cc" for character in segment):
            return "control-character"
        if segment.endswith((" ", ".")):
            return "trailing-space-or-dot"
        if WINDOWS_RESERVED.match(segment):
            return "windows-reserved"
    return None


def _collision_key(path: str) -> str:
    return unicodedata.normalize("NFC", path.removesuffix("/")).lower()


def _encode_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n"
    ).encode("utf-8")


def write_resource_package_directory(
    document: Mapping[str, Any],
    media: Mapping[str, bytes],
) -> list[PortableEntry]:
    root = copy.deepcopy(dict(document))
    resources = root.pop("resources")
    entries: list[PortableEntry] = [
        {"path": ROOT_PATH, "kind": "file", "bytes": _encode_json(root)}
    ]
    for resource in resources:
        resource_path = resource["path"]
        if (
            _path_problem(resource_path, False)
            or resource_path == ROOT_PATH
            or resource_path.startswith("assets/")
        ):
            raise ValueError(f"Invalid Resource path: {resource_path}")
        payload = copy.deepcopy(resource)
        payload.pop("path")
        entries.append({
            "path": resource_path,
            "kind": "file",
            "bytes": _encode_json(payload),
        })
    for asset in document["assets"]:
        asset_id = asset["id"]
        if asset_id not in media:
            raise ValueError(f"Missing media bytes: {asset_id}")
        entries.append({
            "path": f"assets/{asset_id.removeprefix('sha256:')}.webp",
            "kind": "file",
            "bytes": media[asset_id],
        })
    for directory in document["emptyDirectories"]:
        if _path_problem(directory, True):
            raise ValueError(f"Invalid empty directory path: {directory}")
        entries.append({
            "path": f"{directory.removesuffix('/')}/",
            "kind": "directory",
        })
    return sorted(entries, key=lambda entry: entry["path"])


def _validate_entry_set(
    entries: Sequence[PortableEntry],
    require_file_bytes: bool = True,
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    exact_paths: set[str] = set()
    collision_paths: dict[str, tuple[str, str]] = {}
    expanded_bytes = 0
    if len(entries) > MAX_ENTRIES:
        diagnostics.append(_diagnostic(
            "resource-package.archive.entry-count-exceeded",
            "",
            {"actual": len(entries), "limit": MAX_ENTRIES},
        ))
    for index, entry in enumerate(entries):
        location = f"/entries/{index}"
        is_directory = entry["kind"] == "directory"
        problem = _path_problem(entry["path"], is_directory)
        if problem:
            diagnostics.append(_diagnostic(
                "resource-package.archive.path.invalid",
                f"{location}/path",
                {"path": entry["path"], "reason": problem},
            ))
        if entry["kind"] not in ("file", "directory"):
            diagnostics.append(_diagnostic(
                "resource-package.archive.entry.special",
                location,
                {"kind": entry["kind"], "path": entry["path"]},
            ))
        if require_file_bytes and entry["kind"] == "file" and "bytes" not in entry:
            diagnostics.append(_diagnostic(
                "resource-package.archive.file.bytes-missing",
                location,
                {"path": entry["path"]},
            ))
        if "bytes" in entry:
            byte_length = len(entry["bytes"])
            expanded_bytes += byte_length
            if byte_length > MAX_FILE_BYTES:
                diagnostics.append(_diagnostic(
                    "resource-package.archive.file-too-large",
                    location,
                    {
                        "actual": byte_length,
                        "limit": MAX_FILE_BYTES,
                        "path": entry["path"],
                    },
                ))
        if entry["path"] in exact_paths:
            diagnostics.append(_diagnostic(
                "resource-package.archive.entry.duplicate",
                f"{location}/path",
                {"path": entry["path"]},
            ))
        exact_paths.add(entry["path"])
        if not problem and entry["kind"] in ("file", "directory"):
            key = _collision_key(entry["path"])
            previous = collision_paths.get(key)
            if previous and (previous[0] != entry["path"] or previous[1] != entry["kind"]):
                diagnostics.append(_diagnostic(
                    "resource-package.archive.path.collision",
                    f"{location}/path",
                    {"first": previous[0], "second": entry["path"]},
                ))
            elif previous is None:
                collision_paths[key] = (entry["path"], entry["kind"])
            segments = entry["path"].removesuffix("/").split("/")
            for length in range(1, len(segments)):
                parent = "/".join(segments[:length])
                parent_key = _collision_key(parent)
                parent_entry = collision_paths.get(parent_key)
                if parent_entry and parent_entry[1] == "file":
                    diagnostics.append(_diagnostic(
                        "resource-package.archive.path.collision",
                        f"{location}/path",
                        {"first": parent_entry[0], "second": entry["path"]},
                    ))
                elif parent_entry is None:
                    collision_paths[parent_key] = (parent, "directory")
    if expanded_bytes > MAX_EXPANDED_BYTES:
        diagnostics.append(_diagnostic(
            "resource-package.archive.expanded-bytes-exceeded",
            "",
            {"actual": expanded_bytes, "limit": MAX_EXPANDED_BYTES},
        ))
    return diagnostics


def load_resource_package_directory(
    entries: list[PortableEntry],
    validate: CandidateValidator,
) -> dict[str, Any]:
    diagnostics = _validate_entry_set(entries)
    if _has_errors(diagnostics):
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    root_entries = [
        entry for entry in entries
        if entry["kind"] == "file" and entry["path"] == ROOT_PATH
    ]
    if not root_entries:
        diagnostics.append(_diagnostic(
            "resource-package.archive.root.missing",
            f"/{ROOT_PATH}",
        ))
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    try:
        root = json.loads(root_entries[0]["bytes"].decode("utf-8"))
        if not isinstance(root, dict):
            raise ValueError
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        diagnostics.append(_diagnostic(
            "resource-package.archive.root.invalid-json",
            f"/{ROOT_PATH}",
        ))
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    if "resources" in root:
        diagnostics.append(_diagnostic(
            "resource-package.archive.root.resources-forbidden",
            f"/{ROOT_PATH}/resources",
        ))

    actual_empty_directories = sorted(
        entry["path"].removesuffix("/")
        for entry in entries
        if entry["kind"] == "directory"
        and not any(
            candidate["kind"] == "file"
            and candidate["path"].startswith(entry["path"])
            for candidate in entries
        )
    )
    declared_empty_directories = sorted(
        item for item in root.get("emptyDirectories", []) if isinstance(item, str)
    )
    if actual_empty_directories != declared_empty_directories:
        diagnostics.append(_diagnostic(
            "resource-package.archive.empty-directories.mismatch",
            f"/{ROOT_PATH}/emptyDirectories",
            {
                "actual": actual_empty_directories,
                "expected": declared_empty_directories,
            },
        ))

    resources = []
    resource_entries = [
        entry for entry in entries
        if entry["kind"] == "file"
        and entry["path"] != ROOT_PATH
        and not entry["path"].startswith("assets/")
    ]
    for entry in resource_entries:
        if not entry["path"].endswith(".json"):
            diagnostics.append(_diagnostic(
                "resource-package.archive.file.unknown",
                f"/{entry['path']}",
                {"path": entry["path"]},
            ))
            continue
        try:
            resource = json.loads(entry["bytes"].decode("utf-8"))
            if not isinstance(resource, dict):
                raise ValueError
            if "path" in resource:
                diagnostics.append(_diagnostic(
                    "resource-package.archive.resource.path-forbidden",
                    f"/{entry['path']}/path",
                ))
            resource["path"] = entry["path"]
            resources.append(resource)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            diagnostics.append(_diagnostic(
                "resource-package.archive.resource.invalid-json",
                f"/{entry['path']}",
            ))

    declared_assets = {
        asset["id"] for asset in root.get("assets", [])
        if isinstance(asset, dict) and isinstance(asset.get("id"), str)
    }
    media: dict[str, bytes] = {}
    for entry in entries:
        if entry["kind"] != "file" or not entry["path"].startswith("assets/"):
            continue
        match = ASSET_PATH.match(entry["path"])
        if not match:
            diagnostics.append(_diagnostic(
                "resource-package.archive.file.unknown",
                f"/{entry['path']}",
                {"path": entry["path"]},
            ))
            continue
        asset_id = f"sha256:{match.group(1)}"
        media[asset_id] = entry["bytes"]
        if asset_id not in declared_assets:
            actual_id = f"sha256:{hashlib.sha256(entry['bytes']).hexdigest()}"
            diagnostics.append(
                _diagnostic(
                    "resource-package.archive.media.orphan",
                    f"/{entry['path']}",
                    {"assetId": asset_id},
                    "warning",
                )
                if actual_id == asset_id
                else _diagnostic(
                    "resource-package.media.digest-mismatch",
                    f"/{entry['path']}",
                    {"actual": actual_id, "expected": asset_id},
                )
            )
    document = {**root, "resources": resources}
    if not _has_errors(diagnostics):
        diagnostics.extend(validate(document, media))
    if _has_errors(diagnostics):
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    return {
        "candidate": {"document": document, "media": media},
        "diagnostics": _sort_diagnostics(diagnostics),
    }


def write_pbres(
    document: Mapping[str, Any],
    media: Mapping[str, bytes],
    compression_level: int = 6,
    export_time: datetime = datetime(2000, 1, 1),
) -> bytes:
    output = io.BytesIO()
    compression = zipfile.ZIP_STORED if compression_level == 0 else zipfile.ZIP_DEFLATED
    with zipfile.ZipFile(
        output,
        mode="w",
        compression=compression,
        compresslevel=None if compression_level == 0 else compression_level,
    ) as archive:
        for entry in write_resource_package_directory(document, media):
            info = zipfile.ZipInfo(entry["path"], export_time.timetuple()[:6])
            info.create_system = 3
            is_directory = entry["kind"] == "directory"
            info.external_attr = (0o40755 if is_directory else 0o100644) << 16
            info.compress_type = compression
            archive.writestr(info, entry.get("bytes", b""))
    return output.getvalue()


def load_pbres(archive_bytes: bytes, validate: CandidateValidator) -> dict[str, Any]:
    diagnostics: list[Diagnostic] = []
    try:
        archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
        infos = archive.infolist()
    except (zipfile.BadZipFile, OSError):
        return {
            "candidate": None,
            "diagnostics": [_diagnostic("resource-package.archive.zip.invalid", "")],
        }
    if len(infos) > MAX_ENTRIES:
        diagnostics.append(_diagnostic(
            "resource-package.archive.entry-count-exceeded",
            "",
            {"actual": len(infos), "limit": MAX_ENTRIES},
        ))
    metadata_entries = []
    expanded_bytes = 0
    for index, info in enumerate(infos):
        location = f"/entries/{index}"
        if info.flag_bits & 0x1:
            diagnostics.append(_diagnostic(
                "resource-package.archive.zip.encrypted",
                location,
                {"path": info.filename},
            ))
        if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            diagnostics.append(_diagnostic(
                "resource-package.archive.zip.compression-unsupported",
                location,
                {"compression": info.compress_type, "path": info.filename},
            ))
        unix_type = ((info.external_attr >> 16) & 0xffff) & 0xf000 if info.create_system == 3 else 0
        if unix_type not in (0, 0x8000, 0x4000):
            diagnostics.append(_diagnostic(
                "resource-package.archive.entry.special",
                location,
                {"kind": "zip-special", "path": info.filename},
            ))
        directory = info.is_dir()
        if (directory and unix_type == 0x8000) or (not directory and unix_type == 0x4000):
            diagnostics.append(_diagnostic(
                "resource-package.archive.entry.type-mismatch",
                location,
                {"path": info.filename},
            ))
        if info.file_size > MAX_FILE_BYTES:
            diagnostics.append(_diagnostic(
                "resource-package.archive.file-too-large",
                location,
                {
                    "actual": info.file_size,
                    "limit": MAX_FILE_BYTES,
                    "path": info.filename,
                },
            ))
        if info.file_size > 0 and info.file_size > info.compress_size * MAX_COMPRESSION_RATIO:
            diagnostics.append(_diagnostic(
                "resource-package.archive.compression-ratio-exceeded",
                location,
                {
                    "compressed": info.compress_size,
                    "expanded": info.file_size,
                    "limit": MAX_COMPRESSION_RATIO,
                    "path": info.filename,
                },
            ))
        expanded_bytes += info.file_size
        metadata_entries.append({
            "path": info.filename,
            "kind": "directory" if directory else "file",
        })
    diagnostics.extend(_validate_entry_set(metadata_entries, False))
    if expanded_bytes > MAX_EXPANDED_BYTES:
        diagnostics.append(_diagnostic(
            "resource-package.archive.expanded-bytes-exceeded",
            "",
            {"actual": expanded_bytes, "limit": MAX_EXPANDED_BYTES},
        ))
    if _has_errors(diagnostics):
        archive.close()
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    try:
        entries = [
            {
                "path": info.filename,
                "kind": "directory" if info.is_dir() else "file",
                **({} if info.is_dir() else {"bytes": archive.read(info)}),
            }
            for info in infos
        ]
    except (zipfile.BadZipFile, RuntimeError, OSError):
        archive.close()
        return {
            "candidate": None,
            "diagnostics": [_diagnostic("resource-package.archive.zip.invalid", "")],
        }
    archive.close()
    result = load_resource_package_directory(entries, validate)
    diagnostics.extend(result["diagnostics"])
    if _has_errors(diagnostics):
        return {"candidate": None, "diagnostics": _sort_diagnostics(diagnostics)}
    return {
        "candidate": result["candidate"],
        "diagnostics": _sort_diagnostics(diagnostics),
    }
