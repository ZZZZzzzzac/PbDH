import json
from pathlib import Path

from jsonschema import Draft202012Validator


FIXTURE_DIRECTORY = (
    Path(__file__).parents[2]
    / "contracts"
    / "conformance"
    / "tooling-smoke"
)


def read_json(file_name: str) -> object:
    with (FIXTURE_DIRECTORY / file_name).open(encoding="utf-8") as source:
        return json.load(source)


def test_cross_language_conformance_tooling_smoke_fixture() -> None:
    validator = Draft202012Validator(read_json("schema.json"))
    expected = read_json("expected.json")

    assert isinstance(expected, dict)
    for file_name, is_valid in expected.items():
        errors = list(validator.iter_errors(read_json(file_name)))
        assert (not errors) is is_valid, file_name
