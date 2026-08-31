import json
from collections.abc import Mapping, Sequence
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


ContractDiagnostic = dict[str, Any]
ContractRequest = Mapping[str, Any]


def escape_pointer_segment(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def pointer_from_path(path: Sequence[object]) -> str:
    return "".join(f"/{escape_pointer_segment(str(segment))}" for segment in path)


def append_pointer(pointer: str, segment: object) -> str:
    return f"{pointer}/{escape_pointer_segment(str(segment))}"


def diagnostic(
    request: ContractRequest,
    code: str,
    location: str = "",
    params: Mapping[str, Any] | None = None,
) -> ContractDiagnostic:
    return {
        "code": code,
        "severity": "error",
        "family": request["family"],
        "version": request["version"],
        "location": location,
        "params": dict(params or {}),
    }


def map_schema_error(
    request: ContractRequest,
    error: ValidationError,
) -> list[ContractDiagnostic]:
    location = pointer_from_path(list(error.absolute_path))
    if error.validator == "type":
        return [diagnostic(
            request,
            "contract.schema.type",
            location,
            {"expected": error.validator_value},
        )]
    if error.validator == "required":
        required = set(error.validator_value)
        present = set(error.instance) if isinstance(error.instance, Mapping) else set()
        return [
            diagnostic(
                request,
                "contract.schema.required",
                append_pointer(location, property_name),
                {"property": property_name},
            )
            for property_name in sorted(required - present)
        ]
    if error.validator == "additionalProperties":
        properties = error.schema.get("properties", {})
        allowed = set(properties) if isinstance(properties, Mapping) else set()
        present = set(error.instance) if isinstance(error.instance, Mapping) else set()
        extras = sorted(present - allowed)
        return [
            diagnostic(
                request,
                "contract.schema.additional-property",
                append_pointer(location, property_name),
                {"property": property_name},
            )
            for property_name in extras
        ]
    if error.validator == "const":
        return [diagnostic(
            request,
            "contract.schema.const",
            location,
            {"expected": error.validator_value},
        )]
    if error.validator == "minLength":
        return [diagnostic(
            request,
            "contract.schema.min-length",
            location,
            {"limit": error.validator_value},
        )]
    return [diagnostic(
        request,
        "contract.schema.invalid",
        location,
        {"keyword": error.validator},
    )]


def sort_diagnostics(
    diagnostics: list[ContractDiagnostic],
) -> list[ContractDiagnostic]:
    return sorted(
        diagnostics,
        key=lambda item: (
            item["location"],
            item["code"],
            json.dumps(item["params"], ensure_ascii=False, sort_keys=True),
        ),
    )


class ContractRuntime:
    def __init__(
        self,
        catalog: Mapping[str, Any],
        schemas: Mapping[str, Mapping[str, Any]],
    ) -> None:
        self._catalog = catalog
        self._versions: dict[str, Mapping[str, Any]] = {}
        self._validators: dict[str, Draft202012Validator] = {}

        for family in catalog["families"]:
            for version in family["versions"]:
                key = f"{family['id']}@{version['version']}"
                if key in self._versions:
                    raise ValueError(f"Duplicate Contract version: {key}")
                schema_path = version["schema"]
                if schema_path not in schemas:
                    raise ValueError(f"Missing Contract schema: {schema_path}")
                self._versions[key] = version
                if family["id"] == "backend-api":
                    continue
                self._validators[key] = Draft202012Validator(schemas[schema_path])

    def get_version_state(self, family: str, version: str) -> str | None:
        catalog_version = self._versions.get(f"{family}@{version}")
        return None if catalog_version is None else catalog_version["state"]

    def validate(self, request: ContractRequest) -> list[ContractDiagnostic]:
        if not any(
            family["id"] == request["family"]
            for family in self._catalog["families"]
        ):
            return [diagnostic(request, "contract.family.unknown")]

        key = f"{request['family']}@{request['version']}"
        version = self._versions.get(key)
        if version is None:
            return [diagnostic(request, "contract.version.unsupported")]
        if request["mode"] == "production" and version["state"] == "development":
            return [diagnostic(
                request,
                "contract.version.development-not-allowed",
            )]

        validator = self._validators.get(key)
        if validator is None:
            return [diagnostic(request, "contract.validation.not-applicable")]
        diagnostics = []
        for error in validator.iter_errors(request["candidate"]):
            diagnostics.extend(map_schema_error(request, error))
        return sort_diagnostics(diagnostics)
