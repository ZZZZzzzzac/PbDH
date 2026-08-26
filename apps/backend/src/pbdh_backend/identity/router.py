from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, ConfigDict

from pbdh_backend.api_errors import ApiError
from pbdh_backend.identity.repository import Account, IdentityRepository
from pbdh_backend.identity.tokens import TokenVerifier, VerifiedIdentity
from pbdh_backend.settings import Settings


router = APIRouter(prefix="/api/auth", tags=["identity"])


class SessionClaimRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentSessionId: str | None = None
    replaceExisting: bool = False


class UsernameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str


@dataclass(frozen=True)
class AuthenticatedAccount:
    account: Account
    session_id: str


def settings(request: Request) -> Settings:
    return request.app.state.settings


def repository(request: Request) -> IdentityRepository:
    return request.app.state.identity_repository


def verifier(request: Request) -> TokenVerifier:
    configured = request.app.state.token_verifier
    if configured is None:
        raise ApiError(
            503,
            "AUTH_NOT_CONFIGURED",
            "平台尚未配置登录服务，匿名功能仍可使用。",
        )
    return configured


def verified_identity(
    authorization: Annotated[str | None, Header()] = None,
    token_verifier: TokenVerifier = Depends(verifier),
) -> VerifiedIdentity:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "AUTH_REQUIRED", "请先登录。")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise ApiError(401, "AUTH_REQUIRED", "请先登录。")
    return token_verifier.verify(token)


def active_account(
    identity: VerifiedIdentity = Depends(verified_identity),
    identity_repository: IdentityRepository = Depends(repository),
    session_id: Annotated[str | None, Header(alias="X-PbDH-Session")] = None,
) -> AuthenticatedAccount:
    if not session_id:
        raise ApiError(401, "AUTH_SESSION_REQUIRED", "缺少平台会话，请重新登录。")
    account = identity_repository.get_or_create_account(identity.subject)
    identity_repository.require_active_session(account.account_id, session_id)
    return AuthenticatedAccount(account, session_id)


def optional_active_account(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    session_id: Annotated[str | None, Header(alias="X-PbDH-Session")] = None,
    identity_repository: IdentityRepository = Depends(repository),
) -> AuthenticatedAccount | None:
    if not authorization and not session_id:
        return None
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "AUTH_REQUIRED", "请先登录。")
    if not session_id:
        raise ApiError(401, "AUTH_SESSION_REQUIRED", "缺少平台会话，请重新登录。")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise ApiError(401, "AUTH_REQUIRED", "请先登录。")
    identity = verifier(request).verify(token)
    account = identity_repository.get_or_create_account(identity.subject)
    identity_repository.require_active_session(account.account_id, session_id)
    return AuthenticatedAccount(account, session_id)


@router.get("/config")
def auth_config(resolved: Settings = Depends(settings)) -> dict[str, object]:
    return {
        "configured": resolved.auth_configured,
        **(
            {
                "supabaseUrl": resolved.supabase_url,
                "supabaseAnonKey": resolved.supabase_anon_key,
            }
            if resolved.auth_configured
            else {}
        ),
    }


@router.get("/session/status")
def session_status(
    identity: VerifiedIdentity = Depends(verified_identity),
    identity_repository: IdentityRepository = Depends(repository),
    resolved: Settings = Depends(settings),
    current_session_id: Annotated[str | None, Header(alias="X-PbDH-Session")] = None,
) -> dict[str, object]:
    account = identity_repository.get_or_create_account(identity.subject)
    active = identity_repository.get_active_session(account.account_id)
    current_active = bool(active and current_session_id == active.session_id)
    return {
        "profile": public_profile(account, resolved),
        "currentSessionActive": current_active,
        "replacementRequired": bool(active and not current_active),
    }


@router.post("/session/claim")
def claim_session(
    body: SessionClaimRequest,
    identity: VerifiedIdentity = Depends(verified_identity),
    identity_repository: IdentityRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    account = identity_repository.get_or_create_account(identity.subject)
    claimed, replaced = identity_repository.claim_session(
        account.account_id,
        body.currentSessionId,
        body.replaceExisting,
        f"session_{uuid4().hex}",
    )
    return {
        "sessionId": claimed.session_id,
        "profile": public_profile(account, resolved),
        "replacedExisting": replaced,
    }


@router.delete("/session")
def release_session(
    authenticated: AuthenticatedAccount = Depends(active_account),
    identity_repository: IdentityRepository = Depends(repository),
) -> dict[str, bool]:
    identity_repository.release_session(
        authenticated.account.account_id, authenticated.session_id
    )
    return {"released": True}


@router.get("/me")
def me(
    authenticated: AuthenticatedAccount = Depends(active_account),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    return {"profile": public_profile(authenticated.account, resolved)}


@router.put("/profile/username")
def set_username(
    body: UsernameRequest,
    authenticated: AuthenticatedAccount = Depends(active_account),
    identity_repository: IdentityRepository = Depends(repository),
    resolved: Settings = Depends(settings),
) -> dict[str, object]:
    username = normalize_username(body.username)
    account = identity_repository.set_username(
        authenticated.account.account_id, username
    )
    return {"profile": public_profile(account, resolved)}


def normalize_username(value: str) -> str:
    username = unicodedata.normalize("NFKC", value).strip()
    if not re.fullmatch(r"[\w\u4e00-\u9fff-]{2,24}", username, flags=re.UNICODE):
        raise ApiError(
            422,
            "USERNAME_INVALID",
            "用户名需为 2–24 个中文、字母、数字、下划线或连字符。",
            [{"path": "/username", "code": "USERNAME_INVALID", "message": "请检查用户名格式。"}],
        )
    return username


def public_profile(account: Account, resolved: Settings) -> dict[str, object]:
    return {
        "accountId": account.account_id,
        "username": account.username,
        "isAdmin": resolved.is_admin_subject(account.auth_subject),
    }
