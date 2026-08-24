from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import jwt

from pbdh_backend.api_errors import ApiError


@dataclass(frozen=True)
class VerifiedIdentity:
    subject: str


class TokenVerifier(Protocol):
    def verify(self, token: str) -> VerifiedIdentity: ...


class SupabaseJwtVerifier:
    def __init__(
        self,
        supabase_url: str,
        audience: str = "authenticated",
        shared_secret: str | None = None,
    ) -> None:
        self.issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        self.audience = audience
        self.shared_secret = shared_secret
        self.jwks_client = (
            None
            if shared_secret
            else jwt.PyJWKClient(f"{self.issuer}/.well-known/jwks.json")
        )

    def verify(self, token: str) -> VerifiedIdentity:
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
        return VerifiedIdentity(subject=subject)
