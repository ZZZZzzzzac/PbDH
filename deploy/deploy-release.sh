#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
version="${2:-}"
artifact_sha256="${3:-}"
deploy_root="${4:-}"
run_key="${5:-}"
environment_file="/etc/pbdh-platform.env"
data_root="/var/lib/pbdh-platform"

fail() {
  echo "deploy-release: $*" >&2
  exit 1
}

[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail "invalid version"
[[ "$artifact_sha256" =~ ^[0-9a-f]{64}$ ]] || fail "invalid SHA-256"
[[ "$deploy_root" =~ ^/var/www/[A-Za-z0-9._/-]+$ ]] || fail "unsafe deploy root"
[[ "$run_key" =~ ^[0-9]+-[0-9]+$ ]] || fail "invalid run key"

releases_root="$deploy_root/releases"
staging_root="$deploy_root/.staging"
release_path="$releases_root/$version"
staging_path="$staging_root/$version-$run_key"

verify_release() {
  local path="$1"
  [[ -f "$path/pbdh_tools/index.html" ]] || fail "release has no preview frontend"
  [[ -f "$path/pbdh/index.html" ]] || fail "release has no primary frontend"
  grep -Fq "<meta name=\"pbdh-version\" content=\"$version\">" "$path/pbdh_tools/index.html" || fail "preview version marker mismatch"
  grep -Fq "<meta name=\"pbdh-version\" content=\"$version\">" "$path/pbdh/index.html" || fail "primary version marker mismatch"
  [[ -f "$path/requirements-prod.txt" ]] || fail "release has no backend requirements"
  [[ -d "$path/python-packages" ]] || fail "release has no bundled Python packages"
  [[ -f "$path/deploy/pbdh-platform.service" ]] || fail "release has no systemd unit"
  [[ -f "$path/.release-sha256" ]] || fail "release has no checksum marker"
  [[ "$(cat "$path/.release-sha256")" == "$artifact_sha256" ]] || fail "immutable release checksum mismatch"
}

activate_link() {
  local next_link="$deploy_root/.current-$run_key"
  ln -sfn "releases/$version" "$next_link"
  mv -Tf "$next_link" "$deploy_root/current"
}

prepare_backend() {
  [[ -f "$environment_file" ]] || fail "$environment_file is missing"
  # 在切换链接或触碰数据库前确认新机可加载制品中的二进制依赖。
  PYTHONPATH="$release_path/python-packages:$release_path/apps/backend/src" \
    /usr/bin/python3.11 -c 'import PIL._imaging, pydantic_core, uvicorn, pbdh_backend.app'
  if ! id -u pbdh-platform >/dev/null 2>&1; then
    useradd --system --home-dir "$data_root" --shell /usr/sbin/nologin pbdh-platform
  fi
  install -d -o pbdh-platform -g pbdh-platform "$data_root" "$data_root/backups"

  if systemctl is-active --quiet pbdh-platform && [[ -f "$data_root/pbdh.sqlite3" ]]; then
    runuser -u pbdh-platform -- \
      /usr/bin/python3.11 \
      /var/www/pbdh-platform/current/deploy/backup_sqlite.py \
      "$data_root/pbdh.sqlite3" "$data_root/backups"
  fi

  install -m 0644 "$release_path/deploy/pbdh-platform.service" \
    /etc/systemd/system/pbdh-platform.service
  systemctl daemon-reload
}

restart_backend() {
  systemctl enable pbdh-platform >/dev/null
  systemctl restart pbdh-platform
  curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-all-errors \
    "http://127.0.0.1:8001/api/health" >/dev/null
}

restore_previous_release() {
  local previous_target="$1"
  [[ -n "$previous_target" ]] || return 0
  local rollback_link="$deploy_root/.rollback-$run_key"
  ln -s "$previous_target" "$rollback_link"
  mv -Tf "$rollback_link" "$deploy_root/current"
  systemctl restart pbdh-platform
}

case "$mode" in
  prepare)
    install -d "$releases_root" "$staging_root"
    if [[ -d "$release_path" ]]; then
      verify_release "$release_path"
      echo "reuse"
      exit 0
    fi
    [[ ! -e "$staging_path" ]] || fail "staging path already exists; inspect it manually"
    install -d "$staging_path"
    echo "upload"
    ;;
  activate)
    if [[ ! -d "$release_path" ]]; then
      [[ -d "$staging_path" ]] || fail "staging path does not exist"
      [[ -f "$staging_path/pbdh_tools/index.html" ]] || fail "staged preview is missing"
      printf '%s\n' "$artifact_sha256" > "$staging_path/.release-sha256"
      mv "$staging_path" "$release_path"
    fi
    verify_release "$release_path"
    prepare_backend
    previous_target="$(readlink "$deploy_root/current" 2>/dev/null || true)"
    activate_link
    if ! restart_backend; then
      restore_previous_release "$previous_target"
      fail "backend health check failed; restored previous release"
    fi
    echo "activated release $version"
    ;;
  *)
    fail "mode must be prepare or activate"
    ;;
esac
