from pathlib import Path

from pbdh_backend.settings import Settings


def test_settings_load_local_environment_file(
    tmp_path: Path,
    monkeypatch,
) -> None:
    for name in (
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "PBDH_ADMIN_AUTH_SUBJECT",
        "PBDH_DATABASE_PATH",
    ):
        monkeypatch.delenv(name, raising=False)
    environment_file = tmp_path / ".env.local"
    environment_file.write_text(
        "SUPABASE_URL=https://example.supabase.co\n"
        "SUPABASE_ANON_KEY=publishable-key\n"
        "PBDH_ADMIN_AUTH_SUBJECT=admin-subject\n"
        f"PBDH_DATABASE_PATH={tmp_path.as_posix()}/local.sqlite3\n",
        encoding="utf-8",
    )

    settings = Settings.from_environment(environment_file)

    assert settings.auth_configured is True
    assert settings.admin_auth_subject == "admin-subject"
    assert settings.database_path == tmp_path / "local.sqlite3"


def test_process_environment_overrides_local_file(tmp_path: Path, monkeypatch) -> None:
    environment_file = tmp_path / ".env.local"
    environment_file.write_text("PBDH_PUBLICATION_MODE=production\n", encoding="utf-8")
    monkeypatch.setenv("PBDH_PUBLICATION_MODE", "development")

    assert Settings.from_environment(environment_file).publication_mode == "development"
