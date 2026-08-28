import copy
import json
from pathlib import Path

import pytest

from pbdh_backend.contracts import ContractRuntime


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/character-save/1.0.0"


def read_json(path: Path) -> object:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
FIXTURE = read_json(FIXTURE_ROOT / "valid/module-state.json")


def mutate(source: dict, mutation: dict | None) -> dict:
    result = copy.deepcopy(source)
    if mutation is None:
        return result
    parent = result
    for segment in mutation["path"][:-1]:
        parent = parent[segment]
    key = mutation["path"][-1]
    if mutation["op"] == "delete":
        del parent[key]
    else:
        parent[key] = mutation["value"]
    return result


@pytest.mark.parametrize(
    "case",
    read_json(FIXTURE_ROOT / "cases.json"),
    ids=lambda case: case["name"],
)
def test_character_save_schema_conformance(case: dict) -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate({
        "family": "character-save",
        "version": "1.0.0",
        "mode": "development",
        "candidate": mutate(FIXTURE, case["mutation"]),
    }) == case["expected"]
