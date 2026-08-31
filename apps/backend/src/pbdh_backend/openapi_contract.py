from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute


BACKEND_API_VERSION = "1.0.0"


def stable_operation_id(route: APIRoute) -> str:
    return route.name


def install_openapi_contract(application: FastAPI) -> None:
    def build() -> dict[str, Any]:
        if application.openapi_schema is not None:
            return application.openapi_schema
        schema = get_openapi(
            title=application.title,
            version=BACKEND_API_VERSION,
            routes=application.routes,
        )
        schema["info"]["description"] = (
            "PbDH Platform 的身份、云文档、托管媒体和资源市场 HTTP 合约。"
            "领域 payload 仍由各自 Platform Contract 管理。"
        )
        schema["x-pbdh-contract-family"] = "backend-api"
        components = schema.setdefault("components", {})
        components.setdefault("securitySchemes", {}).update({
            "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"},
            "siteSession": {"type": "apiKey", "in": "header", "name": "X-PbDH-Session"},
        })
        components.setdefault("schemas", {}).update(_error_schemas())
        components.setdefault("responses", {})["ContractError"] = {
            "description": "使用稳定错误代码表示的失败。",
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorResponse"}}},
        }

        for path, path_item in schema["paths"].items():
            for method, operation in path_item.items():
                if method not in {"get", "post", "put", "patch", "delete"}:
                    continue
                operation["security"] = _security(path, method)
                operation.setdefault("responses", {})["default"] = {
                    "$ref": "#/components/responses/ContractError"
                }
                if "422" in operation["responses"]:
                    operation["responses"]["422"] = {
                        "$ref": "#/components/responses/ContractError"
                    }

        schema["paths"]["/api/cloud/media/{asset_id}"]["put"]["requestBody"] = {
            "required": True,
            "content": {"image/webp": {"schema": {"type": "string", "format": "binary"}}},
        }
        for path in (
            "/api/cloud/documents/{document_id}/media/{asset_id}",
            "/api/publications/{publication_id}/media/{asset_id}",
        ):
            schema["paths"][path]["get"]["responses"]["200"] = {
                "description": "WebP 图片字节。",
                "content": {"image/webp": {"schema": {"type": "string", "format": "binary"}}},
            }
        schema["paths"]["/api/publications/{publication_id}/download"]["get"]["responses"]["200"] = {
            "description": "Resource Package 便携归档。",
            "content": {
                "application/vnd.pbdh.resource-package+zip": {
                    "schema": {"type": "string", "format": "binary"}
                }
            },
        }
        application.openapi_schema = schema
        return schema

    application.openapi = build


def _security(path: str, method: str) -> list[dict[str, list[str]]]:
    if path in {"/api/health", "/api/auth/config"}:
        return []
    if path in {"/api/auth/session/status", "/api/auth/session/claim"}:
        return [{"bearerAuth": []}]
    if path == "/api/publications" and method == "get":
        return []
    if path == "/api/publications/{publication_id}" and method == "get":
        return []
    if path in {
        "/api/publications/{publication_id}/download",
        "/api/publications/{publication_id}/media/{asset_id}",
    }:
        return [{}, {"bearerAuth": [], "siteSession": []}]
    return [{"bearerAuth": [], "siteSession": []}]


def _error_schemas() -> dict[str, Any]:
    return {
        "ApiFieldError": {
            "type": "object",
            "required": ["path", "code", "message"],
            "properties": {
                "path": {"type": "string"},
                "code": {"type": "string"},
                "message": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "ApiError": {
            "type": "object",
            "required": ["code", "message", "retryable"],
            "properties": {
                "code": {"type": "string"},
                "message": {"type": "string"},
                "retryable": {"type": "boolean"},
                "fieldErrors": {
                    "type": "array",
                    "items": {"$ref": "#/components/schemas/ApiFieldError"},
                },
            },
            "additionalProperties": False,
        },
        "ApiErrorResponse": {
            "type": "object",
            "required": ["schemaVersion", "error"],
            "properties": {
                "schemaVersion": {"const": BACKEND_API_VERSION},
                "error": {"$ref": "#/components/schemas/ApiError"},
            },
            "additionalProperties": False,
        },
    }
