import copy
import json
from pathlib import Path
from typing import Any

import pytest

from pbdh_backend.contracts import (
    classify_resource_package_version_change,
    resource_package_version_meets_minimum,
)


ROOT = Path(__file__).parents[2]
FIXTURE_PATH = (
    ROOT / "contracts/conformance/resource-package-version/1.0.0/cases.json"
)
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _read_document(source: str | None = None) -> dict[str, Any]:
    path = FIXTURE_PATH.parent / (source or FIXTURE["defaultSource"])
    return json.loads(path.read_text(encoding="utf-8"))


def _pointer_parts(pointer: str) -> list[str]:
    return [part.replace("~1", "/").replace("~0", "~")
            for part in pointer[1:].split("/")]


def _value_at(document: Any, pointer: str) -> Any:
    value = document
    for part in _pointer_parts(pointer):
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def _apply_operation(document: dict[str, Any], operation: dict[str, Any]) -> None:
    if operation["op"] == "copy":
        _apply_operation(document, {
            "op": "add",
            "path": operation["path"],
            "value": copy.deepcopy(_value_at(document, operation["from"])),
        })
        return
    if operation["op"] == "reverse":
        _value_at(document, operation["path"]).reverse()
        return
    parts = _pointer_parts(operation["path"])
    key = parts.pop()
    parent: Any = document
    for part in parts:
        parent = parent[int(part)] if isinstance(parent, list) else parent[part]
    if isinstance(parent, list):
        if operation["op"] == "remove":
            parent.pop(int(key))
        elif key == "-":
            parent.append(copy.deepcopy(operation["value"]))
        else:
            parent[int(key)] = copy.deepcopy(operation["value"])
    elif operation["op"] == "remove":
        parent.pop(key)
    else:
        parent[key] = copy.deepcopy(operation["value"])


@pytest.mark.parametrize("fixture_case", FIXTURE["cases"], ids=lambda item: item["name"])
def test_shared_structural_semver_conformance(fixture_case: dict[str, Any]) -> None:
    previous = _read_document(fixture_case.get("source"))
    for operation in fixture_case.get("previous", []):
        _apply_operation(previous, operation)
    current = copy.deepcopy(previous)
    for operation in fixture_case["current"]:
        _apply_operation(current, operation)
    result = classify_resource_package_version_change(previous, current)
    expected = fixture_case["expected"]
    assert result["level"] == expected["level"]
    assert result["minimumVersion"] == expected["minimumVersion"]
    assert [reason["code"] for reason in result["reasons"]] == expected["reasonCodes"]


@pytest.mark.parametrize("choice", FIXTURE["versionChoices"])
def test_shared_version_choice_conformance(choice: dict[str, Any]) -> None:
    assert resource_package_version_meets_minimum(
        choice["selected"], choice["minimum"]
    ) is choice["accepted"]
