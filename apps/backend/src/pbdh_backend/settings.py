from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def read_environment_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if not separator or not name.strip():
            continue
        cleaned = value.strip()
        if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in "\"'":
            cleaned = cleaned[1:-1]
        values[name.strip()] = cleaned
    return values


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
    publication_mode: str = "development"
    account_media_quota_bytes: int | None = None

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    def is_admin_subject(self, subject: str) -> bool:
        return bool(self.admin_auth_subject and subject == self.admin_auth_subject)

    @classmethod
    def from_environment(cls, environment_file: Path | None = None) -> "Settings":
        local = read_environment_file(environment_file or project_root() / ".env.local")

        def value(name: str, default: str | None = None) -> str | None:
            return os.environ.get(name, local.get(name, default))

        return cls(
            database_path=Path(value("PBDH_DATABASE_PATH") or default_database_path()),
            migrations_path=Path(
                value("PBDH_MIGRATIONS_PATH") or backend_root() / "migrations"
            ),
            supabase_url=clean_optional(value("SUPABASE_URL")),
            supabase_anon_key=clean_optional(value("SUPABASE_ANON_KEY")),
            supabase_jwt_secret=clean_optional(value("SUPABASE_JWT_SECRET")),
            supabase_audience=value("SUPABASE_AUDIENCE", "authenticated") or "authenticated",
            admin_auth_subject=clean_optional(value("PBDH_ADMIN_AUTH_SUBJECT")),
            publication_mode=value("PBDH_PUBLICATION_MODE", "development") or "development",
            account_media_quota_bytes=positive_int_or_none(value("PBDH_ACCOUNT_MEDIA_QUOTA_BYTES")),
        )


def clean_optional(value: str | None) -> str | None:
    cleaned = value.strip() if value else ""
    return cleaned or None


def positive_int_or_none(value: str | None) -> int | None:
    cleaned = clean_optional(value)
    if cleaned is None:
        return None
    parsed = int(cleaned)
    if parsed <= 0:
        raise ValueError("PBDH_ACCOUNT_MEDIA_QUOTA_BYTES must be a positive integer")
    return parsed
