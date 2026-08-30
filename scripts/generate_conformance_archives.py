"""生成可重复的二进制 conformance 归档；不处理用户文件。"""

import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "apps/backend/src"))

from pbdh_backend.contracts import write_pbres  # noqa: E402


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_resource_archive(resource_root: Path, name: str) -> bytes:
    document = read_json(resource_root / "valid" / f"{name}.json")
    media = {
        asset["id"]: (
            resource_root / "media" / f"{asset['id'].removeprefix('sha256:')}.webp"
        ).read_bytes()
        for asset in document["assets"]
    }
    archive = write_pbres(
        document,
        media,
        compression_level=6,
        export_time=datetime(2000, 1, 1),
    )
    (resource_root / "valid" / f"{name}.pbres").write_bytes(archive)
    return archive


def main() -> None:
    resource_root = ROOT / "contracts/conformance/resource-package/1.0.0-alpha.1"
    current_resource_root = ROOT / "contracts/conformance/resource-package/1.0.0"
    system_root = ROOT / "contracts/conformance/system-package/1.0.0-alpha.1"
    system_directory = system_root / "valid/daggerheart"
    embedded_path = system_directory / "resources/daggerheart-core-primary-weapon.pbres"
    embedded_path.parent.mkdir(parents=True, exist_ok=True)

    archive = write_resource_archive(resource_root, "daggerheart-core-primary-weapon")
    write_resource_archive(resource_root, "minotaur-wrecker")
    write_resource_archive(current_resource_root, "daggerheart-core-primary-weapon")
    write_resource_archive(current_resource_root, "minotaur-wrecker")
    embedded_path.write_bytes(archive)

    pbsys_path = system_root / "daggerheart.pbsys"
    with zipfile.ZipFile(pbsys_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for source, archive_path in [
            (embedded_path, "resources/daggerheart-core-primary-weapon.pbres"),
            (system_directory / "system.json", "system.json"),
        ]:
            info = zipfile.ZipInfo(archive_path, (2000, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            output.writestr(info, source.read_bytes())


if __name__ == "__main__":
    main()
