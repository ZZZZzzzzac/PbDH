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
FIXTURE_ROOT = ROOT / "contracts/conformance/resource-package/1.0.0-alpha.1"


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


def load_media(fixtures: list[dict[str, str]]) -> dict[str, bytes]:
    return {
        fixture["assetId"]: (FIXTURE_ROOT / fixture["path"]).read_bytes()
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
    "conformance_case",
    read_json(FIXTURE_ROOT / "cases.json"),
    ids=lambda item: item["name"],
)
def test_resource_package_conformance(conformance_case: dict[str, Any]) -> None:
    document = read_json(FIXTURE_ROOT / conformance_case["document"])
    apply_mutation(document, conformance_case["mutation"])
    diagnostics = RUNTIME.validate({
        "family": "resource-package",
        "version": "1.0.0-alpha.1",
        "mode": "development",
        "candidate": document,
    })
    if not diagnostics:
        diagnostics = validate_resource_package_semantics(
            document,
            load_media(conformance_case["media"]),
        )
    assert diagnostics == conformance_case["expected"]


@pytest.mark.parametrize(
    "digest_case",
    read_json(FIXTURE_ROOT / "digest-cases.json"),
    ids=lambda item: item["name"],
)
def test_resource_package_digest_known_answers(digest_case: dict[str, Any]) -> None:
    document = read_json(FIXTURE_ROOT / digest_case["document"])
    if digest_case["targets"] is not None:
        document["targets"] = copy.deepcopy(digest_case["targets"])
    media = load_media(digest_case["media"])
    assert compute_resource_package_snapshot_digest(document, media) == digest_case["expected"]

    document["targets"].reverse()
    assert compute_resource_package_snapshot_digest(document, media) == digest_case["expected"]
