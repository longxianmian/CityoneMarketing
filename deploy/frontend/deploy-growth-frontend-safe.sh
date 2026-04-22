#!/usr/bin/env bash
set -euo pipefail

# 安全发布 growth 前端静态站：
# - 覆盖新的 index.html / 公开资源
# - 保留历史 hash assets，避免旧页面立即 404
# - 生成备份目录，便于快速回滚
#
# 用法：
#   ./deploy/frontend/deploy-growth-frontend-safe.sh /tmp/cityone-growth.tgz

ARCHIVE_PATH="${1:?archive path required}"
STAMP="${2:-$(date +%Y%m%d-%H%M%S)}"

LIVE_DIR="${LIVE_DIR:-/home/docker/www/growth}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/docker/www_backups}"
RELEASE_ROOT="${RELEASE_ROOT:-/home/docker/www_releases}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

STAGE_DIR="${RELEASE_ROOT}/growth-${STAMP}"
BACKUP_DIR="${BACKUP_ROOT}/growth-${STAMP}"

mkdir -p "${BACKUP_ROOT}" "${RELEASE_ROOT}"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${STAGE_DIR}"

if [[ -d "${LIVE_DIR}" ]]; then
  rm -rf "${BACKUP_DIR}"
  cp -a "${LIVE_DIR}" "${BACKUP_DIR}"
else
  mkdir -p "${LIVE_DIR}"
fi

# 关键策略：不要删除 LIVE_DIR 里的旧 assets。
# 直接覆盖新文件，旧 hash 资源继续保留，降低 WebView / LINE 旧页面 404 风险。
cp -a "${STAGE_DIR}/." "${LIVE_DIR}/"

printf '%s\n' "${STAMP}" > "${LIVE_DIR}/.release-version"

# 只清理旧备份目录，live assets 不做即时删除。
mapfile -t backups < <(find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -name 'growth-*' | sort)
if (( ${#backups[@]} > KEEP_BACKUPS )); then
  remove_count=$(( ${#backups[@]} - KEEP_BACKUPS ))
  for ((i=0; i<remove_count; i++)); do
    rm -rf "${backups[$i]}"
  done
fi

echo "SAFE_DEPLOY_OK stamp=${STAMP}"
echo "live_dir=${LIVE_DIR}"
echo "backup_dir=${BACKUP_DIR}"
