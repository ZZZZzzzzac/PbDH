from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    field_errors: list[dict[str, str]] | None = None


def api_error_response(error: ApiError) -> JSONResponse:
    payload: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.status_code >= 500,
        },
    }
    if error.field_errors:
        payload["error"]["fieldErrors"] = error.field_errors
    return JSONResponse(status_code=error.status_code, content=payload)


async def handle_api_error(_: Request, error: ApiError) -> JSONResponse:
    return api_error_response(error)


async def handle_request_validation(
    _: Request, error: RequestValidationError
) -> JSONResponse:
    field_errors = [
        {
            "path": "/" + "/".join(str(part) for part in issue["loc"] if part != "body"),
            "code": "REQUEST_FIELD_INVALID",
            "message": issue["msg"],
        }
        for issue in error.errors()
    ]
    return api_error_response(
        ApiError(422, "REQUEST_INVALID", "请求字段不符合接口合同。", field_errors)
    )
