from __future__ import annotations

import json
import re
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pydantic.alias_generators import to_camel

from pbdh_backend.api_errors import ApiError
from pbdh_backend.identity.router import (
    AuthenticatedAccount,
    active_account,
    optional_active_account,
    settings,
)
from pbdh_backend.publications.repository import (
    PackageOwnershipConflict,
    PublicationCoverInvalid,
    PublicationNotFound,
    PublicationPermissionDenied,
    PublicationRepository,
    PublicationVersionConflict,
)
from pbdh_backend.publications.service import (
    PublicationService,
    PublicationValidationError,
)
from pbdh_backend.settings import Settings


router = APIRouter(prefix="/api/publications", tags=["publications"])


class PublicationMetadata(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        populate_by_name=True,
    )

    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(max_length=500)
    language: str = Field(min_length=2, max_length=35)
    tags: list[str] = Field(max_length=20)
    cover_asset_id: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")


def service(request: Request) -> PublicationService:
    return request.app.state.publication_service


def repository(request: Request) -> PublicationRepository:
    return request.app.state.publication_repository


@router.post("")
async def publish(
    archive: Annotated[UploadFile, File()],
    metadata: Annotated[str, Form()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_service: PublicationService = Depends(service),
) -> dict[str, object]:
    try:
        parsed = PublicationMetadata.model_validate(json.loads(metadata))
    except (json.JSONDecodeError, ValidationError) as error:
        raise ApiError(422, "PUBLICATION_METADATA_INVALID", "发布信息不完整或格式错误。") from error
    try:
        publication = publication_service.publish(
            authenticated.account.account_id,
            await archive.read(),
            parsed.model_dump(by_alias=True),
        )
    except PublicationValidationError as error:
        raise ApiError(
            422,
            "PUBLICATION_CANDIDATE_INVALID",
            "资源包未通过发布校验，服务器没有写入任何内容。",
            [
                {
                    "path": item["location"],
                    "code": item["code"],
                    "message": item["code"],
                }
                for item in error.diagnostics
            ],
        ) from error
    except PackageOwnershipConflict as error:
        raise ApiError(409, "PACKAGE_ID_OWNED_BY_ANOTHER_ACCOUNT", "该资源包 ID 已由其他账号发布。") from error
    except PublicationVersionConflict as error:
        raise ApiError(409, "PUBLICATION_VERSION_CONFLICT", "新快照必须提高资源包版本。") from error
    return {"publication": publication}


@router.get("")
def list_publications(
    q: Annotated[str | None, Query(max_length=120)] = None,
    publication_repository: PublicationRepository = Depends(repository),
) -> dict[str, object]:
    return {"publications": publication_repository.list_publications(q)}


@router.get("/manageable")
def list_manageable_publications(
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    return {
        "publications": publication_repository.list_manageable_publications(
            authenticated.account.account_id,
            resolved.is_admin_subject(authenticated.account.auth_subject),
        )
    }


@router.patch("/{publication_id}/metadata")
def update_publication_metadata(
    publication_id: str,
    payload: Annotated[dict[str, object], Body()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    try:
        parsed = PublicationMetadata.model_validate(payload)
    except ValidationError as error:
        raise ApiError(422, "PUBLICATION_METADATA_INVALID", "发布信息不完整或格式错误。") from error
    try:
        publication = publication_repository.update_metadata(
            publication_id,
            authenticated.account.account_id,
            parsed.model_dump(by_alias=True),
            resolved.is_admin_subject(authenticated.account.auth_subject),
        )
    except PublicationNotFound as error:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该出版物。") from error
    except PublicationPermissionDenied as error:
        raise ApiError(403, "PUBLICATION_PERMISSION_DENIED", "只有该出版物的作者或平台管理员可以修改展示信息。") from error
    except PublicationCoverInvalid as error:
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面必须来自当前资源包资产。") from error
    return {"publication": publication}


@router.post("/{publication_id}/unpublish")
def unpublish_publication(
    publication_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    return {
        "publication": _set_publication_status(
            publication_repository,
            publication_id,
            authenticated.account.account_id,
            "unpublished",
            resolved.is_admin_subject(authenticated.account.auth_subject),
        )
    }


@router.post("/{publication_id}/republish")
def republish_publication(
    publication_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    return {
        "publication": _set_publication_status(
            publication_repository,
            publication_id,
            authenticated.account.account_id,
            "published",
            resolved.is_admin_subject(authenticated.account.auth_subject),
        )
    }


@router.get("/{publication_id}/manage")
def get_manageable_publication(
    publication_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    publication = publication_repository.get_manageable_publication(
        publication_id,
        authenticated.account.account_id,
        resolved.is_admin_subject(authenticated.account.auth_subject),
    )
    if publication is None:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该资源包。")
    return {"publication": publication}


def _set_publication_status(
    publication_repository: PublicationRepository,
    publication_id: str,
    account_id: str,
    status: str,
    allow_all: bool,
) -> dict[str, object]:
    try:
        return publication_repository.set_status(publication_id, account_id, status, allow_all)
    except PublicationNotFound as error:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该出版物。") from error
    except PublicationPermissionDenied as error:
        raise ApiError(403, "PUBLICATION_PERMISSION_DENIED", "只有该出版物的作者或平台管理员可以修改发布状态。") from error


@router.get("/{publication_id}")
def get_publication(
    publication_id: str,
    publication_repository: PublicationRepository = Depends(repository),
) -> dict[str, object]:
    publication = publication_repository.get_publication(publication_id)
    if publication is None:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该资源包。")
    return {"publication": publication}


@router.get("/{publication_id}/download")
def download_publication(
    publication_id: str,
    authenticated: AuthenticatedAccount | None = Depends(optional_active_account),
    publication_service: PublicationService = Depends(service),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> Response:
    account_id = authenticated.account.account_id if authenticated else None
    allow_all = bool(authenticated and resolved.is_admin_subject(authenticated.account.auth_subject))
    archive = publication_service.download(publication_id, account_id, allow_all)
    if archive is None:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该资源包。")
    publication = (
        publication_repository.get_manageable_publication(publication_id, account_id, allow_all)
        if account_id is not None
        else publication_repository.get_publication(publication_id)
    )
    package_name = publication["title"] if publication else "资源包"
    if publication:
        package_name = (
            publication.get("document", {})
            .get("package", {})
            .get("name", package_name)
        )
    archive_name = _safe_archive_name(str(package_name))
    return Response(
        archive,
        media_type="application/vnd.pbdh.resource-package+zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="resource-package.pbres"; '
                f"filename*=UTF-8''{quote(archive_name)}"
            )
        },
    )


def _safe_archive_name(package_name: str) -> str:
    normalized = re.sub(r'[\x00-\x1f\\/:*?"<>|]', "-", package_name.strip())
    normalized = re.sub(r"\s+", " ", normalized).rstrip(". ")[:120]
    if not normalized:
        normalized = "资源包"
    if re.fullmatch(r"(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])", normalized):
        normalized += "-资源包"
    return f"{normalized}.pbres"


@router.get("/{publication_id}/media/{asset_id}")
def get_publication_media(
    publication_id: str,
    asset_id: str,
    authenticated: AuthenticatedAccount | None = Depends(optional_active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> Response:
    account_id = authenticated.account.account_id if authenticated else None
    allow_all = bool(authenticated and resolved.is_admin_subject(authenticated.account.auth_subject))
    media = publication_repository.get_media(publication_id, asset_id, account_id, allow_all)
    if media is None:
        raise ApiError(404, "PUBLICATION_MEDIA_NOT_FOUND", "没有找到该公开媒体。")
    return Response(media[1], media_type=media[0])
