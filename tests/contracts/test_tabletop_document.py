import copy
import json
from pathlib import Path
from typing import Any

import pytest

from pbdh_backend.contracts import ContractRuntime


ROOT = Path(__file__).parents[2]
FIXTURE_ROOTS = [
    ROOT / "contracts/conformance/tabletop-document/1.0.0",
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
    ("fixture_root", "conformance_case"),
    [
        (fixture_root, conformance_case)
        for fixture_root in FIXTURE_ROOTS
        for conformance_case in read_json(fixture_root / "cases.json")
    ],
    ids=lambda item: item.name if isinstance(item, Path) else item["name"],
)
def test_tabletop_document_schema_conformance(
    fixture_root: Path,
    conformance_case: dict[str, Any],
) -> None:
    document = copy.deepcopy(read_json(fixture_root / "valid/basic.json"))
    apply_mutation(document, conformance_case["mutation"])
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate({
        "family": "tabletop-document",
        "version": document["contractVersion"],
        "mode": "development",
        "candidate": document,
    }) == conformance_case["expected"]
