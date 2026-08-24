import copy
import json
from pathlib import Path
from typing import Any

import pytest

from pbdh_backend.contracts import (
    ContractRuntime,
    compute_resource_package_snapshot_digest,
    validate_resource_package_semantics,
)


ROOT = Path(__file__).parents[2]
FIXTURE_ROOTS = [
    ROOT / "contracts/conformance/resource-package/1.0.0-alpha.1",
    ROOT / "contracts/conformance/resource-package/1.0.0",
]


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
RUNTIME = ContractRuntime(CATALOG, SCHEMAS)


def load_media(fixture_root: Path, fixtures: list[dict[str, str]]) -> dict[str, bytes]:
    return {
        fixture["assetId"]: (fixture_root / fixture["path"]).read_bytes()
        for fixture in fixtures
    }


def apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> None:
    kind = mutation["kind"]
    if kind == "none":
        return
    if kind == "duplicate-resource":
        document["resources"].append(
            copy.deepcopy(document["resources"][mutation["sourceIndex"]])
        )
        return
    if kind == "add-root-property":
        document[mutation["property"]] = mutation["value"]
        return
    if kind == "set-target-version":
        document["targets"][mutation["targetIndex"]]["version"] = mutation["value"]
        return
    raise AssertionError(f"Unknown fixture mutation: {kind}")


@pytest.mark.parametrize(
    "fixture_root, conformance_case",
    [
        (fixture_root, conformance_case)
        for fixture_root in FIXTURE_ROOTS
        for conformance_case in read_json(fixture_root / "cases.json")
    ],
    ids=lambda item: item["name"] if isinstance(item, dict) else item.name,
)
def test_resource_package_conformance(
    fixture_root: Path,
    conformance_case: dict[str, Any],
) -> None:
    document = read_json(fixture_root / conformance_case["document"])
    apply_mutation(document, conformance_case["mutation"])
    version = document["contractVersion"]
    diagnostics = RUNTIME.validate({
        "family": "resource-package",
        "version": version,
        "mode": "development",
        "candidate": document,
    })
    if not diagnostics:
        diagnostics = validate_resource_package_semantics(
            document,
            load_media(fixture_root, conformance_case["media"]),
        )
    assert diagnostics == conformance_case["expected"]


@pytest.mark.parametrize(
    "fixture_root, digest_case",
    [
        (fixture_root, digest_case)
        for fixture_root in FIXTURE_ROOTS
        for digest_case in read_json(fixture_root / "digest-cases.json")
    ],
    ids=lambda item: item["name"] if isinstance(item, dict) else item.name,
)
def test_resource_package_digest_known_answers(
    fixture_root: Path,
    digest_case: dict[str, Any],
) -> None:
    document = read_json(fixture_root / digest_case["document"])
    if digest_case["targets"] is not None:
        document["targets"] = copy.deepcopy(digest_case["targets"])
    media = load_media(fixture_root, digest_case["media"])
    assert compute_resource_package_snapshot_digest(document, media) == digest_case["expected"]

    document["targets"].reverse()
    assert compute_resource_package_snapshot_digest(document, media) == digest_case["expected"]
