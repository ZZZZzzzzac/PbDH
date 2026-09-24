from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import jwt

from pbdh_backend.api_errors import ApiError


@dataclass(frozen=True)
class VerifiedIdentity:
    subject: str


class TokenVerifier(Protocol):
    def verify(self, token: str, *, require_live_session: bool = False) -> VerifiedIdentity: ...


class SupabaseJwtVerifier:
    def __init__(
        self,
        supabase_url: str,
        audience: str = "authenticated",
        shared_secret: str | None = None,
        anon_key: str | None = None,
    ) -> None:
        self.issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        self.audience = audience
        self.shared_secret = shared_secret
        self.anon_key = anon_key
        self.jwks_client = (
            None
            if shared_secret
            else jwt.PyJWKClient(f"{self.issuer}/.well-known/jwks.json")
        )

    def verify(self, token: str, *, require_live_session: bool = False) -> VerifiedIdentity:
        try:
            if self.shared_secret:
                claims = jwt.decode(
                    token,
                    self.shared_secret,
                    algorithms=["HS256"],
                    audience=self.audience,
                    issuer=self.issuer,
                )
            else:
                key = self.jwks_client.get_signing_key_from_jwt(token)  # type: ignore[union-attr]
                claims = jwt.decode(
                    token,
                    key.key,
                    algorithms=["RS256", "ES256"],
                    audience=self.audience,
                    issuer=self.issuer,
                )
        except jwt.PyJWTError as error:
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效或已过期。") from error
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.strip():
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据缺少稳定账号标识。")
        if require_live_session:
            self._require_live_session(token, subject)
        return VerifiedIdentity(subject=subject)

    def _require_live_session(self, token: str, subject: str) -> None:
        # JWT 在全局退出后仍可能未过期；认领平台会话前让 Auth 检查 session_id。
        request = Request(
            f"{self.issuer}/user",
            headers={"Authorization": f"Bearer {token}", "apikey": self.anon_key or ""},
        )
        try:
            with urlopen(request, timeout=8) as response:
                user = json.load(response)
        except HTTPError as error:
            if error.code in (401, 403):
                raise ApiError(401, "AUTH_TOKEN_INVALID", "登录已失效，请使用当前密码重新登录。") from None
            raise ApiError(503, "AUTH_SERVICE_UNAVAILABLE", "暂时无法验证登录状态，请稍后重试。") from None
        except (URLError, TimeoutError, ValueError):
            raise ApiError(503, "AUTH_SERVICE_UNAVAILABLE", "暂时无法验证登录状态，请稍后重试。") from None
        if not isinstance(user, dict) or user.get("id") != subject:
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效，请重新登录。")
