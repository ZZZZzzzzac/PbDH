from __future__ import annotations

import copy
import re
from collections.abc import Mapping
from typing import Any


_SEMVER = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
_LEVEL_RANK = {"none": 0, "patch": 1, "minor": 2, "major": 3}


def classify_resource_package_version_change(
    previous: Mapping[str, Any],
    current: Mapping[str, Any],
) -> dict[str, Any]:
    if current["package"]["id"] != previous["package"]["id"]:
        raise ValueError("Resource Package version comparison requires the same Package ID")
    if _version_content(previous) == _version_content(current):
        return {
            "level": "none",
            "minimumVersion": previous["package"]["version"],
            "reasons": [],
        }

    reasons: list[dict[str, str]] = []

    def add_reason(level: str, code: str, subject: str) -> None:
        reasons.append({"code": code, "level": level, "subject": subject})

    if _semver_major(current["contractVersion"]) != _semver_major(previous["contractVersion"]):
        add_reason(
            "major",
            "resource-package.version.contract-major-changed",
            current["contractVersion"],
        )

    current_resources = {resource["id"]: resource for resource in current["resources"]}
    previous_resource_ids = {resource["id"] for resource in previous["resources"]}
    for old_resource in previous["resources"]:
        resource = current_resources.get(old_resource["id"])
        if resource is None:
            add_reason(
                "major",
                "resource-package.version.resource-removed",
                old_resource["id"],
            )
            continue
        if (
            resource["template"]["id"] != old_resource["template"]["id"]
            or _semver_major(resource["template"]["version"])
            != _semver_major(old_resource["template"]["version"])
        ):
            add_reason(
                "major",
                "resource-package.version.resource-template-incompatible",
                old_resource["id"],
            )
        elif resource["template"]["version"] != old_resource["template"]["version"]:
            add_reason(
                "patch",
                "resource-package.version.resource-template-compatible",
                old_resource["id"],
            )
        _classify_replacement_changes(
            old_resource["id"],
            old_resource.get("replacements", []),
            resource.get("replacements", []),
            add_reason,
        )
    for resource in current["resources"]:
        if resource["id"] not in previous_resource_ids:
            add_reason(
                "minor",
                "resource-package.version.resource-added",
                resource["id"],
            )

    _classify_target_changes(previous["targets"], current["targets"], add_reason)
    if not reasons:
        add_reason(
            "patch",
            "resource-package.version.content-changed",
            previous["package"]["id"],
        )
    reasons.sort(key=lambda reason: (
        -_LEVEL_RANK[reason["level"]],
        reason["code"],
        reason["subject"],
    ))
    level = max(
        (reason["level"] for reason in reasons),
        key=lambda candidate: _LEVEL_RANK[candidate],
    )
    return {
        "level": level,
        "minimumVersion": _bump_version(previous["package"]["version"], level),
        "reasons": reasons,
    }


def resource_package_version_meets_minimum(
    selected_version: str,
    minimum_version: str,
) -> bool:
    selected = _parse_semver(selected_version)
    minimum = _parse_semver(minimum_version)
    if selected is None or minimum is None:
        return False
    return _compare_semver(selected, minimum) >= 0


def _version_content(document: Mapping[str, Any]) -> dict[str, Any]:
    content = copy.deepcopy(dict(document))
    content.pop("snapshotDigest", None)
    content["package"].pop("version", None)
    content["targets"].sort(
        key=lambda item: (item["systemPackageId"], item["version"])
    )
    content["assets"].sort(key=lambda item: item["id"])
    content["resources"].sort(key=lambda item: (item["path"], item["id"]))
    for resource in content["resources"]:
        resource.get("replacements", []).sort(
            key=lambda item: (item["replacementId"], item["targetResourceId"])
        )
    content["emptyDirectories"].sort()
    return content


def _classify_replacement_changes(
    resource_id: str,
    previous_replacements: list[Mapping[str, str]],
    current_replacements: list[Mapping[str, str]],
    add_reason: Any,
) -> None:
    current = {
        replacement["replacementId"]: replacement
        for replacement in current_replacements
    }
    previous_ids = {
        replacement["replacementId"] for replacement in previous_replacements
    }
    for replacement in previous_replacements:
        replacement_id = replacement["replacementId"]
        next_replacement = current.get(replacement_id)
        subject = f"{resource_id}:{replacement_id}"
        if next_replacement is None:
            add_reason(
                "major",
                "resource-package.version.replacement-removed",
                subject,
            )
        elif next_replacement["targetResourceId"] != replacement["targetResourceId"]:
            add_reason(
                "major",
                "resource-package.version.replacement-target-changed",
                subject,
            )
    for replacement in current_replacements:
        replacement_id = replacement["replacementId"]
        if replacement_id not in previous_ids:
            add_reason(
                "minor",
                "resource-package.version.replacement-added",
                f"{resource_id}:{replacement_id}",
            )


def _classify_target_changes(
    previous_targets: list[Mapping[str, str]],
    current_targets: list[Mapping[str, str]],
    add_reason: Any,
) -> None:
    matched_previous: set[int] = set()
    matched_current: set[int] = set()
    for previous_index, previous in enumerate(previous_targets):
        exact = _find_target(current_targets, matched_current, lambda current: (
            current["systemPackageId"] == previous["systemPackageId"]
            and current["version"] == previous["version"]
        ))
        if exact is not None:
            matched_previous.add(previous_index)
            matched_current.add(exact)
    for previous_index, previous in enumerate(previous_targets):
        if previous_index in matched_previous:
            continue
        compatible = _find_target(current_targets, matched_current, lambda current: (
            current["systemPackageId"] == previous["systemPackageId"]
            and _semver_major(current["version"]) == _semver_major(previous["version"])
        ))
        if compatible is not None:
            matched_previous.add(previous_index)
            matched_current.add(compatible)
            add_reason(
                "patch",
                "resource-package.version.target-compatible-changed",
                previous["systemPackageId"],
            )
    for previous_index, previous in enumerate(previous_targets):
        if previous_index in matched_previous:
            continue
        same_system = _find_target(current_targets, matched_current, lambda current: (
            current["systemPackageId"] == previous["systemPackageId"]
        ))
        if same_system is not None:
            matched_previous.add(previous_index)
            matched_current.add(same_system)
            add_reason(
                "major",
                "resource-package.version.target-major-changed",
                previous["systemPackageId"],
            )
    for previous_index, previous in enumerate(previous_targets):
        if previous_index not in matched_previous:
            add_reason(
                "major",
                "resource-package.version.target-removed",
                previous["systemPackageId"],
            )
    for index, target in enumerate(current_targets):
        if index not in matched_current:
            add_reason(
                "minor",
                "resource-package.version.target-added",
                f"{target['systemPackageId']}@{target['version']}",
            )


def _find_target(
    targets: list[Mapping[str, str]],
    matched: set[int],
    predicate: Any,
) -> int | None:
    return next(
        (index for index, target in enumerate(targets)
         if index not in matched and predicate(target)),
        None,
    )


def _parse_semver(value: str) -> tuple[int, int, int, tuple[str, ...]] | None:
    match = _SEMVER.fullmatch(value)
    if match is None:
        return None
    prerelease = tuple(match.group(4).split(".")) if match.group(4) else ()
    if any(part.isdigit() and len(part) > 1 and part.startswith("0") for part in prerelease):
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3)), prerelease


def _semver_major(value: str) -> int:
    parsed = _parse_semver(value)
    if parsed is None:
        raise ValueError(f"Invalid SemVer in Resource Package version comparison: {value}")
    return parsed[0]


def _compare_semver(
    left: tuple[int, int, int, tuple[str, ...]],
    right: tuple[int, int, int, tuple[str, ...]],
) -> int:
    if left[:3] != right[:3]:
        return (left[:3] > right[:3]) - (left[:3] < right[:3])
    left_prerelease, right_prerelease = left[3], right[3]
    if not left_prerelease and not right_prerelease:
        return 0
    if not left_prerelease:
        return 1
    if not right_prerelease:
        return -1
    for index in range(max(len(left_prerelease), len(right_prerelease))):
        if index >= len(left_prerelease):
            return -1
        if index >= len(right_prerelease):
            return 1
        left_part, right_part = left_prerelease[index], right_prerelease[index]
        if left_part == right_part:
            continue
        left_numeric, right_numeric = left_part.isdigit(), right_part.isdigit()
        if left_numeric and right_numeric:
            return int(left_part) - int(right_part)
        if left_numeric:
            return -1
        if right_numeric:
            return 1
        return -1 if left_part < right_part else 1
    return 0


def _bump_version(version: str, level: str) -> str:
    parsed = _parse_semver(version)
    if parsed is None:
        raise ValueError(f"Invalid Resource Package version: {version}")
    major, minor, patch, _prerelease = parsed
    if level == "major":
        return f"{major + 1}.0.0"
    if level == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"
