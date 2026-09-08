import runpy
from pathlib import Path

import pytest


promoted_config = runpy.run_path(str(Path(__file__).parents[2] / "deploy/promote-primary.py"))["promoted_config"]


def test_promote_only_changes_the_two_public_frontends():
    text = "location /api/ { proxy_pass http://127.0.0.1:8001; }\n"
    for route, root in [("pbdh_tools", "pbdh-platform/current/pbdh_tools"), ("pbdh", "pbdh-route/current")]:
        for suffix in ["", "assets/", "system-packages/"]:
            text += f'location /{route}/{suffix} {{ alias /var/www/{root}/{suffix}; add_header Cache-Control "public, max-age=31536000, immutable"; }}\n'
    result = promoted_config(text)
    assert result.startswith("location /api/ { proxy_pass http://127.0.0.1:8001; }")
    assert result.count("alias /var/www/pbdh-legacy-tools/current/") == 3
    assert result.count("alias /var/www/pbdh-platform/current/pbdh/") == 3
    assert result.count('Cache-Control "no-cache"') == 2


def test_unexpected_config_fails_before_writing():
    with pytest.raises(ValueError, match="线上入口配置"):
        promoted_config("location /pbdh/ { alias /somewhere/; }")
