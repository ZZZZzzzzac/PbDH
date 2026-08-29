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
RESOURCE_PACKAGE_SCHEMA_PATH = "resource-package/0.0.0-dev.1/schema.json"
RESOURCE_PACKAGE_ALPHA_SCHEMA_PATH = "resource-package/1.0.0-alpha.1/schema.json"
RESOURCE_PACKAGE_STABLE_SCHEMA_PATH = "resource-package/1.0.0/schema.json"
SYSTEM_PACKAGE_ALPHA_SCHEMA_PATH = "system-package/1.0.0-alpha.1/schema.json"
SYSTEM_PACKAGE_ALPHA2_SCHEMA_PATH = "system-package/1.0.0-alpha.2/schema.json"
SYSTEM_PACKAGE_STABLE_SCHEMA_PATH = "system-package/1.0.0/schema.json"
CHARACTER_SAVE_ALPHA_SCHEMA_PATH = "character-save/1.0.0-alpha.1/schema.json"
CHARACTER_SAVE_STABLE_SCHEMA_PATH = "character-save/1.0.0/schema.json"
TABLETOP_DOCUMENT_ALPHA_SCHEMA_PATH = "tabletop-document/1.0.0-alpha.1/schema.json"
TABLETOP_DOCUMENT_STABLE_SCHEMA_PATH = "tabletop-document/1.0.0/schema.json"
SCHEMAS = {
    RESOURCE_PACKAGE_SCHEMA_PATH: read_json(
        f"contracts/{RESOURCE_PACKAGE_SCHEMA_PATH}"
    ),
    RESOURCE_PACKAGE_ALPHA_SCHEMA_PATH: read_json(
        f"contracts/{RESOURCE_PACKAGE_ALPHA_SCHEMA_PATH}"
    ),
    RESOURCE_PACKAGE_STABLE_SCHEMA_PATH: read_json(
        f"contracts/{RESOURCE_PACKAGE_STABLE_SCHEMA_PATH}"
    ),
    SYSTEM_PACKAGE_ALPHA_SCHEMA_PATH: read_json(
        f"contracts/{SYSTEM_PACKAGE_ALPHA_SCHEMA_PATH}"
    ),
    SYSTEM_PACKAGE_ALPHA2_SCHEMA_PATH: read_json(
        f"contracts/{SYSTEM_PACKAGE_ALPHA2_SCHEMA_PATH}"
    ),
    SYSTEM_PACKAGE_STABLE_SCHEMA_PATH: read_json(
        f"contracts/{SYSTEM_PACKAGE_STABLE_SCHEMA_PATH}"
    ),
    CHARACTER_SAVE_ALPHA_SCHEMA_PATH: read_json(
        f"contracts/{CHARACTER_SAVE_ALPHA_SCHEMA_PATH}"
    ),
    CHARACTER_SAVE_STABLE_SCHEMA_PATH: read_json(
        f"contracts/{CHARACTER_SAVE_STABLE_SCHEMA_PATH}"
    ),
    TABLETOP_DOCUMENT_ALPHA_SCHEMA_PATH: read_json(
        f"contracts/{TABLETOP_DOCUMENT_ALPHA_SCHEMA_PATH}"
    ),
    TABLETOP_DOCUMENT_STABLE_SCHEMA_PATH: read_json(
        f"contracts/{TABLETOP_DOCUMENT_STABLE_SCHEMA_PATH}"
    ),
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
        match="Duplicate Contract version: resource-package@0.0.0-dev.1",
    ):
        ContractRuntime(duplicate_catalog, SCHEMAS)


def test_catalog_queries_exact_version_state() -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.get_version_state("resource-package", "0.0.0-dev.1") == "development"
    assert runtime.get_version_state("resource-package", "1.0.0") == "development"


@pytest.mark.parametrize(
    "conformance_case",
    [
        *read_json("contracts/conformance/contract-catalog/cases.json"),
        *read_json("contracts/conformance/system-package/1.0.0/cases.json"),
    ],
    ids=lambda item: item["name"],
)
def test_stable_contract_diagnostic_conformance(conformance_case: dict) -> None:
    runtime = ContractRuntime(CATALOG, SCHEMAS)
    assert runtime.validate(conformance_case["request"]) == conformance_case["expected"]
