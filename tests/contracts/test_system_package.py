import json
from pathlib import Path
from typing import Any

from pbdh_backend.contracts import (
    ContractRuntime,
    load_pbres,
    validate_resource_package_semantics,
)


ROOT = Path(__file__).parents[2]
SYSTEM_ROOT = ROOT / "apps/player/public/system-packages/daggerheart-core"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
RUNTIME = ContractRuntime(CATALOG, SCHEMAS)
DOCUMENT = read_json(SYSTEM_ROOT / "system.json")


def validate_resource(document: dict[str, Any], media: dict[str, bytes]) -> list[dict[str, Any]]:
    diagnostics = RUNTIME.validate({
        "family": "resource-package",
        "version": "1.0.0",
        "mode": "development",
        "candidate": document,
    })
    return diagnostics or validate_resource_package_semantics(document, media)


def test_system_package_schema_is_language_neutral() -> None:
    assert RUNTIME.validate({
        "family": "system-package",
        "version": "1.0.0",
        "mode": "production",
        "candidate": DOCUMENT,
    }) == []


def test_official_system_contains_a_complete_stable_pbres() -> None:
    pbres = (SYSTEM_ROOT / DOCUMENT["embeddedResources"][0]["path"]).read_bytes()
    result = load_pbres(pbres, validate_resource)
    assert result["diagnostics"] == []
    resource = result["candidate"]["document"]
    assert resource["contractVersion"] == "1.0.0"
    assert resource["package"]["version"] == "1.0.18"
    assert {item["template"]["version"] for item in resource["resources"]} == {"1.0.0"}
