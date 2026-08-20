import copy
import json
from pathlib import Path
from typing import Any

import pytest

from pbdh_backend.contracts import ContractRuntime


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/tabletop-document/1.0.0-alpha.1"


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
DOCUMENT = read_json(FIXTURE_ROOT / "valid/basic.json")


def apply_mutation(document: dict[str, Any], mutation: dict[str, Any] | None) -> None:
    if mutation is None:
        return
    parent: Any = document
    for segment in mutation["path"][:-1]:
        parent = parent[segment]
    key = mutation["path"][-1]
    if mutation["op"] == "delete":
        del parent[key]
    else:
        parent[key] = mutation["value"]


@pytest.mark.parametrize(
    "conformance_case",
    read_json(FIXTURE_ROOT / "cases.json"),
    ids=lambda item: item["name"],
)
def test_tabletop_document_schema_conformance(conformance_case: dict[str, Any]) -> None:
    document = copy.deepcopy(DOCUMENT)
    apply_mutation(document, conformance_case["mutation"])
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate({
        "family": "tabletop-document",
        "version": "1.0.0-alpha.1",
        "mode": "development",
        "candidate": document,
    }) == conformance_case["expected"]
