from __future__ import annotations

import hashlib
import json
import re
from typing import Annotated, Literal
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
from pbdh_backend.managed_media import ManagedMediaQuotaExceeded
from pbdh_backend.publications.repository import (
    PackageOwnershipConflict,
    PublicationCoverInvalid,
    PublicationNotFound,
    PublicationPermissionDenied,
    PublicationRepository,
    PublicationMustBeUnpublished,
    PublicationVersionConflict,
)
from pbdh_backend.publications.service import (
    PublicationService,
    PublicationValidationError,
)
from pbdh_backend.media import InvalidWebP, MAX_WEBP_BYTES, webp_dimensions
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


class ResourcePackageTarget(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True)

    system_package_id: str
    version: str


class ResourcePackageInformation(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    version: str
    description: str = Field(max_length=500)


class PublicationCoverAsset(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True)

    id: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    media_type: Literal["image/webp"]
    byte_length: str = Field(pattern=r"^[1-9][0-9]*$")
    width: str = Field(pattern=r"^[1-9][0-9]*$")
    height: str = Field(pattern=r"^[1-9][0-9]*$")


class PublicationLicenseInformation(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", populate_by_name=True)

    label: str = Field(min_length=1)
    declaration: str = Field(min_length=1)


class PublicationInformation(PublicationMetadata):
    package: ResourcePackageInformation
    targets: list[ResourcePackageTarget]
    license: PublicationLicenseInformation | None = None
    cover_asset: PublicationCoverAsset | None = None


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
    except ManagedMediaQuotaExceeded as error:
        raise ApiError(413, "ACCOUNT_MEDIA_QUOTA_EXCEEDED", "账号托管媒体空间不足。") from error
    return {"publication": publication}


@router.get("")
def list_publications(
    q: Annotated[str | None, Query(max_length=120)] = None,
    template_id: Annotated[list[str] | None, Query(alias="templateId")] = None,
    target_system_package_id: Annotated[
        list[str] | None, Query(alias="targetSystemPackageId")
    ] = None,
    language: Annotated[list[str] | None, Query()] = None,
    category: Annotated[list[str] | None, Query()] = None,
    author_account_id: Annotated[str | None, Query(alias="authorAccountId")] = None,
    sort: Annotated[Literal["relevance", "recent", "title"], Query()] = "recent",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=60)] = 24,
    publication_repository: PublicationRepository = Depends(repository),
) -> dict[str, object]:
    result = publication_repository.search_publications(
        query=q,
        template_ids=template_id or [],
        target_system_package_ids=target_system_package_id or [],
        languages=language or [],
        categories=category or [],
        author_account_id=author_account_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return {
        "publications": result["publications"],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": result["total"],
            "hasMore": page * page_size < result["total"],
        },
        "facets": publication_repository.list_publication_facets(),
    }


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


@router.patch("/{publication_id}/information")
def update_publication_information(
    publication_id: str,
    payload: Annotated[dict[str, object], Body()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_service: PublicationService = Depends(service),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    try:
        parsed = PublicationInformation.model_validate(payload)
    except ValidationError as error:
        raise ApiError(422, "PUBLICATION_INFORMATION_INVALID", "资源包信息不完整或格式错误。") from error
    return _commit_publication_information(
        publication_id, parsed, authenticated, publication_service, resolved
    )


@router.patch("/{publication_id}/information-with-cover")
async def update_publication_information_with_cover(
    publication_id: str,
    information: Annotated[str, Form()],
    cover: Annotated[UploadFile, File()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_service: PublicationService = Depends(service),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    try:
        parsed = PublicationInformation.model_validate(json.loads(information))
    except (json.JSONDecodeError, ValidationError) as error:
        raise ApiError(422, "PUBLICATION_INFORMATION_INVALID", "资源包信息不完整或格式错误。") from error
    cover_bytes = await cover.read(MAX_WEBP_BYTES + 1)
    try:
        cover_dimensions = webp_dimensions(cover_bytes)
    except InvalidWebP:
        cover_dimensions = None
    if (
        cover.content_type != "image/webp"
        or len(cover_bytes) > MAX_WEBP_BYTES
        or cover_dimensions != (630, 880)
    ):
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面必须是 630×880 且不超过 2 MB 的 WebP 图片。")
    cover_asset_id = f"sha256:{hashlib.sha256(cover_bytes).hexdigest()}"
    if parsed.cover_asset_id != cover_asset_id:
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面内容与图片编号不一致。")
    if parsed.cover_asset is None or parsed.cover_asset.id != cover_asset_id:
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面缺少包内资产信息。")
    if parsed.cover_asset.byte_length != str(len(cover_bytes)):
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面大小与包内资产信息不一致。")
    return _commit_publication_information(
        publication_id,
        parsed,
        authenticated,
        publication_service,
        resolved,
        (parsed.cover_asset.model_dump(by_alias=True), cover_bytes),
    )


def _commit_publication_information(
    publication_id: str,
    parsed: PublicationInformation,
    authenticated: AuthenticatedAccount,
    publication_service: PublicationService,
    resolved: Settings,
    cover_media: tuple[dict[str, object], bytes] | None = None,
) -> dict[str, object]:
    try:
        publication = publication_service.update_information(
            publication_id,
            authenticated.account.account_id,
            parsed.model_dump(by_alias=True),
            resolved.is_admin_subject(authenticated.account.auth_subject),
            cover_media,
        )
    except PublicationNotFound as error:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该资源包。") from error
    except PublicationPermissionDenied as error:
        raise ApiError(403, "PUBLICATION_PERMISSION_DENIED", "只有该资源包的作者或平台管理员可以修改信息。") from error
    except PublicationCoverInvalid as error:
        raise ApiError(422, "PUBLICATION_COVER_INVALID", "封面不存在或不可用。") from error
    except PublicationVersionConflict as error:
        reasons = {
            "resource-package.version.target-added": "新增目标系统",
            "resource-package.version.target-removed": "移除或更换目标系统",
            "resource-package.version.target-major-changed": "目标系统跨主版本变更",
            "resource-package.version.target-compatible-changed": "目标系统版本变更",
        }
        reason = next((reasons[code] for code in error.reasons if code in reasons), "资源包版本不符合发布要求")
        message = (
            f"{reason}，版本号至少需要 {error.minimum_version}。请修改版本号后重试。"
            if error.minimum_version else "资源包身份与已发布版本不一致，请刷新后重试。"
        )
        raise ApiError(409, "PUBLICATION_VERSION_CONFLICT", message) from error
    except PublicationValidationError as error:
        raise ApiError(422, "PUBLICATION_CANDIDATE_INVALID", "资源包信息未通过校验。", [
            {"path": item["location"], "code": item["code"], "message": item["code"]}
            for item in error.diagnostics
        ]) from error
    except ManagedMediaQuotaExceeded as error:
        raise ApiError(413, "ACCOUNT_MEDIA_QUOTA_EXCEEDED", "账号托管媒体空间不足。") from error
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


@router.delete("/{publication_id}", status_code=204)
def delete_publication(
    publication_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    publication_repository: PublicationRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> Response:
    try:
        publication_repository.delete_publication(
            publication_id,
            authenticated.account.account_id,
            resolved.is_admin_subject(authenticated.account.auth_subject),
        )
    except PublicationNotFound as error:
        raise ApiError(404, "PUBLICATION_NOT_FOUND", "没有找到该出版物。") from error
    except PublicationPermissionDenied as error:
        raise ApiError(403, "PUBLICATION_PERMISSION_DENIED", "只有该出版物的作者或平台管理员可以永久删除。") from error
    except PublicationMustBeUnpublished as error:
        raise ApiError(409, "PUBLICATION_MUST_BE_UNPUBLISHED", "永久删除前必须先取消发布。") from error
    return Response(status_code=204)


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
    publication = publication_repository.get_accessible_publication(
        publication_id, account_id, allow_all
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
