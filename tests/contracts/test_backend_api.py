from __future__ import annotations

import json
from pathlib import Path

from pbdh_backend.app import create_app


ROOT = Path(__file__).parents[2]
OPENAPI_PATH = ROOT / "contracts/backend-api/1.0.0/openapi.json"
CASES_PATH = ROOT / "contracts/conformance/backend-api/1.0.0/cases.json"


def test_published_openapi_matches_backend_implementation() -> None:
    assert json.loads(OPENAPI_PATH.read_text(encoding="utf-8")) == create_app().openapi()


def test_backend_api_operations_security_and_errors_match_conformance() -> None:
    contract = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    operations = {
        (method.upper(), path, operation["operationId"])
        for path, path_item in contract["paths"].items()
        for method, operation in path_item.items()
        if method in {"get", "post", "put", "patch", "delete"}
    }
    assert operations == {tuple(item) for item in cases["operations"]}
    by_id = {
        operation["operationId"]: operation
        for path_item in contract["paths"].values()
        for method, operation in path_item.items()
        if method in {"get", "post", "put", "patch", "delete"}
    }
    for operation_id in cases["anonymous"]:
        assert by_id[operation_id]["security"] == []
    for operation_id in cases["bearerOnly"]:
        assert by_id[operation_id]["security"] == [{"bearerAuth": []}]
    for operation_id in cases["optionalSession"]:
        assert by_id[operation_id]["security"] == [
            {}, {"bearerAuth": [], "siteSession": []}
        ]
    assert contract["components"]["schemas"]["ApiErrorResponse"]["additionalProperties"] is False
