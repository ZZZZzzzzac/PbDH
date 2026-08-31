"""生成可重复的二进制 conformance 归档；不处理用户文件。"""

import json
import sys
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
    resource_root = ROOT / "contracts/conformance/resource-package/1.0.0"
    write_resource_archive(resource_root, "daggerheart-core-primary-weapon")
    write_resource_archive(resource_root, "minotaur-wrecker")


if __name__ == "__main__":
    main()
