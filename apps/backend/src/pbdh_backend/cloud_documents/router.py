from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from pbdh_backend.api_errors import ApiError
from pbdh_backend.cloud_documents.repository import (
    CloudDocumentNotFound,
    CloudDocumentPermissionDenied,
    CloudDocumentRepository,
    CloudDocumentRevisionConflict,
    CloudDocumentStateConflict,
    CloudMediaInvalid,
    CloudMediaNotReady,
)
from pbdh_backend.identity.router import AuthenticatedAccount, active_account


router = APIRouter(prefix="/api/cloud", tags=["cloud-documents"])


def _to_camel(name: str) -> str:
    first, *rest = name.split("_")
    return first + "".join(part.capitalize() for part in rest)


class DocumentWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=_to_camel)

    mutation_id: str = Field(min_length=1, max_length=200)
    document_kind: Literal["creator-workspace", "gm-tabletop-document", "character-save"]
    contract_family: str = Field(min_length=1, max_length=100)
    contract_version: str = Field(min_length=1, max_length=100)
    base_revision: int | None = Field(ge=1)
    asset_ids: list[str] = Field(max_length=1000)
    payload: dict[str, Any]
    force: bool = False


class LifecycleWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=_to_camel)

    mutation_id: str = Field(min_length=1, max_length=200)
    base_revision: int = Field(ge=1)


def repository(request: Request) -> CloudDocumentRepository:
    return request.app.state.cloud_document_repository


@router.put("/media/{asset_id}")
async def prepare_media(
    asset_id: str,
    request: Request,
    _: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    content = await request.body()
    try:
        return cloud_repository.prepare_media(asset_id, media_type, content)
    except CloudMediaInvalid as error:
        raise ApiError(422, "CLOUD_MEDIA_INVALID", "媒体必须是与 Asset ID 匹配的 WebP。") from error


@router.get("/documents")
def list_documents(
    authenticated: AuthenticatedAccount = Depends(active_account),
    document_kind: Annotated[
        Literal["creator-workspace", "gm-tabletop-document", "character-save"] | None,
        Query(alias="documentKind"),
    ] = None,
    include_deleted: Annotated[bool, Query(alias="includeDeleted")] = False,
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    return {
        "documents": cloud_repository.list_documents(
            authenticated.account.account_id,
            document_kind,
            include_deleted,
        )
    }


@router.get("/documents/{document_id}")
def get_document(
    document_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    document = cloud_repository.get_document(authenticated.account.account_id, document_id)
    if document is None:
        raise ApiError(404, "CLOUD_DOCUMENT_NOT_FOUND", "没有找到该云文档。")
    return {"document": document}


@router.put("/documents/{document_id}")
def put_document(
    document_id: str,
    write: Annotated[DocumentWrite, Body()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    try:
        document = cloud_repository.put_document(
            authenticated.account.account_id,
            document_id,
            write.mutation_id,
            write.document_kind,
            write.contract_family,
            write.contract_version,
            write.base_revision,
            write.asset_ids,
            write.payload,
            write.force,
        )
    except CloudMediaNotReady as error:
        raise ApiError(422, "CLOUD_MEDIA_NOT_READY", "文档引用的媒体尚未准备完成。", [
            {"path": "/assetIds", "code": "CLOUD_MEDIA_NOT_READY", "message": asset_id}
            for asset_id in error.asset_ids
        ]) from error
    except CloudDocumentRevisionConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_REVISION_CONFLICT", "云端文档已发生变化。") from error
    except CloudDocumentPermissionDenied as error:
        raise ApiError(409, "CLOUD_DOCUMENT_ID_CONFLICT", "该文档 ID 已被占用。") from error
    except CloudDocumentStateConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_STATE_CONFLICT", "当前文档状态不允许该操作。") from error
    return {"document": document}


@router.post("/documents/{document_id}/trash")
def trash_document(
    document_id: str,
    write: Annotated[LifecycleWrite, Body()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    return {"document": _lifecycle(
        cloud_repository.trash_document,
        authenticated.account.account_id,
        document_id,
        write,
    )}


@router.post("/documents/{document_id}/restore")
def restore_document(
    document_id: str,
    write: Annotated[LifecycleWrite, Body()],
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> dict[str, object]:
    return {"document": _lifecycle(
        cloud_repository.restore_document,
        authenticated.account.account_id,
        document_id,
        write,
    )}


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    base_revision: Annotated[int, Query(alias="baseRevision", ge=1)],
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> Response:
    try:
        cloud_repository.delete_document(
            authenticated.account.account_id,
            document_id,
            base_revision,
        )
    except CloudDocumentNotFound as error:
        raise ApiError(404, "CLOUD_DOCUMENT_NOT_FOUND", "没有找到该云文档。") from error
    except CloudDocumentRevisionConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_REVISION_CONFLICT", "云端文档已发生变化。") from error
    except CloudDocumentStateConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_STATE_CONFLICT", "只有回收站里的云文档可以永久删除。") from error
    return Response(status_code=204)


def _lifecycle(
    operation: Any,
    account_id: str,
    document_id: str,
    write: LifecycleWrite,
) -> dict[str, Any]:
    try:
        return operation(account_id, document_id, write.mutation_id, write.base_revision)
    except CloudDocumentNotFound as error:
        raise ApiError(404, "CLOUD_DOCUMENT_NOT_FOUND", "没有找到该云文档。") from error
    except CloudDocumentRevisionConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_REVISION_CONFLICT", "云端文档已发生变化。") from error
    except CloudDocumentStateConflict as error:
        raise ApiError(409, "CLOUD_DOCUMENT_STATE_CONFLICT", "当前文档状态不允许该操作。") from error


@router.get("/documents/{document_id}/media/{asset_id}")
def get_document_media(
    document_id: str,
    asset_id: str,
    authenticated: AuthenticatedAccount = Depends(active_account),
    cloud_repository: CloudDocumentRepository = Depends(repository),
) -> Response:
    media = cloud_repository.get_media(authenticated.account.account_id, document_id, asset_id)
    if media is None:
        raise ApiError(404, "CLOUD_DOCUMENT_MEDIA_NOT_FOUND", "没有找到该云文档媒体。")
    return Response(media[1], media_type=media[0])
