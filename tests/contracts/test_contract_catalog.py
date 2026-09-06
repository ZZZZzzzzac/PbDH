import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pbdh_backend.contracts import ContractRuntime


ROOT = Path(__file__).parents[2]


def read_json(relative_path: str) -> object:
    with (ROOT / relative_path).open(encoding="utf-8") as source:
        return json.load(source)


CATALOG = read_json("contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(f"contracts/{version['schema']}")
    for family in CATALOG["families"]
    for version in family["versions"]
}


def test_catalog_matches_schema_and_declares_each_family_once() -> None:
    validator = Draft202012Validator(read_json("contracts/catalog.schema.json"))
    assert list(validator.iter_errors(CATALOG)) == []
    assert [family["id"] for family in CATALOG["families"]] == [
        "resource-package",
        "system-package",
        "character-save",
        "tabletop-document",
        "backend-api",
    ]


def test_catalog_rejects_duplicate_exact_versions() -> None:
    duplicate_catalog = copy.deepcopy(CATALOG)
    duplicate_catalog["families"][0]["versions"].append(
        copy.deepcopy(duplicate_catalog["families"][0]["versions"][0])
    )
    with pytest.raises(
        ValueError,
        match="Duplicate Contract version: resource-package@1.0.0",
    ):
        ContractRuntime(duplicate_catalog, SCHEMAS)


def test_catalog_queries_exact_version_state() -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.get_version_state("resource-package", "0.9.0") is None
    assert runtime.get_version_state("resource-package", "1.0.0") == "published"
    assert runtime.get_version_state("resource-package", "1.1.0") == "published"


def test_accepts_reviewed_resource_package_in_production_mode() -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate({
        "family": "resource-package",
        "version": "1.0.0",
        "mode": "production",
        "candidate": read_json(
            "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json"
        ),
    }) == []


def test_accepts_resource_package_1_1_0_in_production_mode() -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate({
        "family": "resource-package",
        "version": "1.1.0",
        "mode": "production",
        "candidate": read_json(
            "contracts/conformance/resource-package/1.1.0/valid/minimal.json"
        ),
    }) == []


def test_tracks_backend_api_without_treating_openapi_as_json_schema() -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.get_version_state("backend-api", "1.0.0") == "published"
    assert runtime.validate({
        "family": "backend-api",
        "version": "1.0.0",
        "mode": "production",
        "candidate": {},
    }) == [{
        "code": "contract.validation.not-applicable",
        "severity": "error",
        "family": "backend-api",
        "version": "1.0.0",
        "location": "",
        "params": {},
    }]


@pytest.mark.parametrize(
    "conformance_case",
    [
        *read_json("contracts/conformance/contract-catalog/cases.json"),
        *read_json("contracts/conformance/resource-package/1.1.0/cases.json"),
        *read_json("contracts/conformance/system-package/1.0.0/cases.json"),
    ],
    ids=lambda item: item["name"],
)
def test_stable_contract_diagnostic_conformance(conformance_case: dict) -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate(conformance_case["request"]) == conformance_case["expected"]
