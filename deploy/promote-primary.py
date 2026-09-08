"""切换两个公开入口；保留旧站制品和 Nginx 原配置，失败自动回退。"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys


def promoted_config(text):
    replacements = {
        "/var/www/pbdh-platform/current/pbdh_tools/": "/var/www/pbdh-legacy-tools/current/",
        "/var/www/pbdh-route/current/": "/var/www/pbdh-platform/current/pbdh/",
    }
    for source, target in replacements.items():
        if text.count("alias " + source) != 3:
            raise ValueError("线上入口配置与预期不符：" + source)
        text = text.replace("alias " + source, "alias " + target)
    # 旧站系统包没有 Platform 的版本查询参数，不能沿用预览站长期缓存。
    text = re.sub(
        r'(location /pbdh_tools/(?:assets|system-packages)/ \{[^}]*?)'
        r'add_header Cache-Control "[^"]+"',
        r'\1add_header Cache-Control "no-cache"', text,
    )
    return text


def main(mode):
    config = Path("/etc/nginx/sites-enabled/daggerheart.conf").resolve(strict=True)
    state = Path("/var/www/pbdh-route/promotion-backup")
    backup = state / "nginx.conf"
    if mode == "rollback":
        original = backup.read_bytes()
        config.write_bytes(original)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
        print("已恢复切换前的两个入口")
        return
    if mode != "new":
        raise ValueError("mode must be new or rollback")
    original = config.read_bytes()
    if "/var/www/pbdh-legacy-tools/current/" in original.decode():
        print("两个入口已切换")
        return
    updated = promoted_config(original.decode())
    primary = Path("/var/www/pbdh-platform/current/pbdh/index.html").read_text()
    if 'content="0.1.9"' not in primary:
        raise ValueError("必须先部署并验证 0.1.9")
    source = Path("/var/www/pbdh/current").resolve(strict=True)
    if not source.is_relative_to(Path("/var/www/pbdh/releases")):
        raise ValueError("旧站路径不在 Release 目录内")
    root = Path("/var/www/pbdh-legacy-tools")
    target = root / "releases" / source.name
    if target.exists():
        if not (target / ".rebased-from").is_file():
            raise ValueError("旧站迁移目录未完成，请检查后重试")
    else:
        shutil.copytree(source, target)
        # 仅修改部署副本的构建基路径，不修改旧仓库或原 Release。
        for path in [target / "index.html", *list((target / "assets").rglob("*"))]:
            if path.is_file() and path.suffix in {".html", ".js", ".css"}:
                data = path.read_text()
                path.write_text(data.replace("/pbdh/", "/pbdh_tools/"))
        (target / ".rebased-from").write_text(str(source))
    link = root / "current"
    if not link.exists():
        link.symlink_to(target)
    elif link.resolve() != target:
        raise ValueError("旧站迁移入口已指向其他版本")
    state.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        backup.write_bytes(original)
        (state / "metadata.json").write_text(json.dumps({"config": str(config), "legacy": str(source)}))
    try:
        config.write_text(updated)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
    except BaseException:
        config.write_bytes(original)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
        raise
    print("/pbdh/ -> Platform 0.1.9; /pbdh_tools/ -> Sheet " + source.name)


if __name__ == "__main__":
    main(sys.argv[1])
