import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).parents[2]


def test_shared_grid_layout_conformance() -> None:
    schema = json.loads((ROOT / "contracts/system-package/1.0.0/grid-layout.schema.json").read_text(encoding="utf-8"))
    fixtures = json.loads((ROOT / "contracts/conformance/system-package-grid/1.0.0/cases.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    for fixture in fixtures:
        assert validator.is_valid(fixture["value"]) == fixture["valid"], fixture["name"]
