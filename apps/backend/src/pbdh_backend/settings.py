from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_database_path() -> Path:
    configured_root = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME")
    root = Path(configured_root) if configured_root else Path.home() / ".local" / "share"
    return root / "PbDH" / "pbdh.sqlite3"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    migrations_path: Path
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_audience: str = "authenticated"
    admin_auth_subject: str | None = None

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    def is_admin_subject(self, subject: str) -> bool:
        return bool(self.admin_auth_subject and subject == self.admin_auth_subject)

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("PBDH_DATABASE_PATH", default_database_path())),
            migrations_path=Path(
                os.environ.get("PBDH_MIGRATIONS_PATH", backend_root() / "migrations")
            ),
            supabase_url=clean_optional(os.environ.get("SUPABASE_URL")),
            supabase_anon_key=clean_optional(os.environ.get("SUPABASE_ANON_KEY")),
            supabase_jwt_secret=clean_optional(os.environ.get("SUPABASE_JWT_SECRET")),
            supabase_audience=os.environ.get("SUPABASE_AUDIENCE", "authenticated"),
            admin_auth_subject=clean_optional(os.environ.get("PBDH_ADMIN_AUTH_SUBJECT")),
        )


def clean_optional(value: str | None) -> str | None:
    cleaned = value.strip() if value else ""
    return cleaned or None
