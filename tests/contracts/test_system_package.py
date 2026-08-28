import io
import json
import zipfile
from pathlib import Path
from typing import Any

from pbdh_backend.contracts import (
    ContractRuntime,
    load_pbres,
    validate_resource_package_semantics,
)


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/system-package/1.0.0-alpha.2"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


CATALOG = read_json(ROOT / "contracts/catalog.json")
SCHEMAS = {
    version["schema"]: read_json(ROOT / "contracts" / version["schema"])
    for family in CATALOG["families"]
    for version in family["versions"]
}
RUNTIME = ContractRuntime(CATALOG, SCHEMAS)
DOCUMENT = read_json(FIXTURE_ROOT / "valid/daggerheart/system.json")
EMBEDDED = DOCUMENT["embeddedResources"][0]


def validate_resource(document: dict[str, Any], media: dict[str, bytes]) -> list[dict[str, Any]]:
    diagnostics = RUNTIME.validate({
        "family": "resource-package",
        "version": "1.0.0-alpha.1",
        "mode": "development",
        "candidate": document,
    })
    return diagnostics or validate_resource_package_semantics(document, media)


def test_system_package_schema_is_language_neutral() -> None:
    assert RUNTIME.validate({
        "family": "system-package",
        "version": "1.0.0-alpha.2",
        "mode": "development",
        "candidate": DOCUMENT,
    }) == []


def test_pbsys_contains_the_same_directory_and_complete_pbres() -> None:
    directory_pbres = (FIXTURE_ROOT / "valid/daggerheart" / EMBEDDED["path"]).read_bytes()
    pbsys = (FIXTURE_ROOT / "daggerheart.pbsys").read_bytes()
    with zipfile.ZipFile(io.BytesIO(pbsys)) as archive:
        assert archive.namelist() == sorted([
            "system.json",
            "pages.json",
            "modules.json",
            EMBEDDED["path"],
        ])
        assert json.loads(archive.read("system.json")) == DOCUMENT
        assert archive.read(EMBEDDED["path"]) == directory_pbres

    result = load_pbres(directory_pbres, validate_resource)
    assert result["diagnostics"] == []
    resource = result["candidate"]["document"]
    assert resource["package"]["id"] == EMBEDDED["packageId"]
    assert resource["package"]["version"] == EMBEDDED["version"]
    assert resource["snapshotDigest"] == EMBEDDED["snapshotDigest"]
