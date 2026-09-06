import sqlite3
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def load_backup_module():
    path = Path(__file__).parents[2] / "deploy" / "backup_sqlite.py"
    spec = spec_from_file_location("backup_sqlite", path)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_create_backup_copies_a_consistent_database(tmp_path: Path) -> None:
    source = tmp_path / "source.sqlite3"
    with sqlite3.connect(source) as connection:
        connection.execute("CREATE TABLE records (value TEXT NOT NULL)")
        connection.execute("INSERT INTO records VALUES ('kept')")

    backup = load_backup_module().create_backup(source, tmp_path / "backups")

    with sqlite3.connect(backup) as connection:
        assert connection.execute("SELECT value FROM records").fetchone() == ("kept",)
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)


def test_create_backup_rejects_a_missing_database(tmp_path: Path) -> None:
    module = load_backup_module()

    try:
        module.create_backup(tmp_path / "missing.sqlite3", tmp_path / "backups")
    except FileNotFoundError as error:
        assert "database does not exist" in str(error)
    else:
        raise AssertionError("missing database should be rejected")
