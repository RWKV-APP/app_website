#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SSH_TARGET="${APP_WEBSITE_SSH_TARGET:-root@rwkv.halowang.cloud}"
REMOTE_RELEASE_BASE="${APP_WEBSITE_REMOTE_RELEASE_BASE:-/root/app_website-artifacts}"
REMOTE_RUNTIME_BASE="${APP_WEBSITE_REMOTE_RUNTIME_BASE:-/root/app_website-runtime}"
REMOTE_OLD_REPO="${APP_WEBSITE_REMOTE_OLD_REPO:-/root/repo/app_website}"
REMOTE_NGINX_CONFIG="${APP_WEBSITE_REMOTE_NGINX_CONFIG:-/etc/nginx/sites-available/halowang.cloud}"
REMOTE_NVM_DIR="${APP_WEBSITE_REMOTE_NVM_DIR:-/root/.nvm}"
REMOTE_NODE_VERSION="${APP_WEBSITE_REMOTE_NODE_VERSION:-24.18.0}"
REMOTE_RELEASE_KEEP="${APP_WEBSITE_REMOTE_RELEASE_KEEP:-5}"
REMOTE_INCOMING_KEEP="${APP_WEBSITE_REMOTE_INCOMING_KEEP:-3}"
DB_BACKUP_KEEP="${APP_WEBSITE_DB_BACKUP_KEEP:-5}"
ALLOW_DATA_LOSS="${APP_WEBSITE_ALLOW_DATA_LOSS:-0}"

run_ssh() {
  ssh -o StrictHostKeyChecking=no "${SSH_TARGET}" "$@"
}

run_scp() {
  scp -o StrictHostKeyChecking=no "$@"
}

shell_quote() {
  printf "%q" "$1"
}

require_nonnegative_integer() {
  local name="$1"
  local value="$2"
  case "${value}" in
    '' | *[!0-9]*)
      echo "${name} must be a non-negative integer, got: ${value}" >&2
      exit 1
      ;;
  esac
}

require_positive_integer() {
  local name="$1"
  local value="$2"
  require_nonnegative_integer "${name}" "${value}"
  if [ "${value}" -lt 1 ]; then
    echo "${name} must be at least 1, got: ${value}" >&2
    exit 1
  fi
}

require_nonnegative_integer APP_WEBSITE_REMOTE_RELEASE_KEEP "${REMOTE_RELEASE_KEEP}"
require_nonnegative_integer APP_WEBSITE_REMOTE_INCOMING_KEEP "${REMOTE_INCOMING_KEEP}"
require_positive_integer APP_WEBSITE_DB_BACKUP_KEEP "${DB_BACKUP_KEEP}"
if [ "${ALLOW_DATA_LOSS}" != "0" ] && [ "${ALLOW_DATA_LOSS}" != "1" ]; then
  echo "APP_WEBSITE_ALLOW_DATA_LOSS must be 0 or 1, got: ${ALLOW_DATA_LOSS}" >&2
  exit 1
fi

if [ $# -gt 0 ]; then
  ARCHIVE_PATH="$1"
else
  BUILD_OUTPUT="$("${PROJECT_ROOT}/scripts/build-prod-artifact.sh")"
  printf "%s\n" "${BUILD_OUTPUT}"
  ARCHIVE_PATH="$(printf "%s\n" "${BUILD_OUTPUT}" | awk -F= '/^artifact_path=/{print $2}' | tail -n 1)"
fi

if [ -z "${ARCHIVE_PATH}" ] || [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "artifact archive not found: ${ARCHIVE_PATH:-<empty>}"
  exit 1
fi

ARCHIVE_NAME="$(basename "${ARCHIVE_PATH}")"
case "${ARCHIVE_NAME}" in
  app-website-*.tar.gz) ;;
  *)
    echo "artifact archive must match app-website-*.tar.gz: ${ARCHIVE_NAME}" >&2
    exit 1
    ;;
esac
RELEASE_NAME="${ARCHIVE_NAME%.tar.gz}"
REMOTE_ARCHIVE="${REMOTE_RELEASE_BASE}/incoming/${ARCHIVE_NAME}"
REMOTE_RELEASE_DIR="${REMOTE_RELEASE_BASE}/releases/${RELEASE_NAME}"

run_ssh "mkdir -p $(shell_quote "${REMOTE_RELEASE_BASE}/incoming") $(shell_quote "${REMOTE_RELEASE_BASE}/releases")"
run_scp "${ARCHIVE_PATH}" "${SSH_TARGET}:${REMOTE_ARCHIVE}"

REMOTE_ENV=(
  "APP_WEBSITE_RELEASE_NAME=$(shell_quote "${RELEASE_NAME}")"
  "APP_WEBSITE_REMOTE_ARCHIVE=$(shell_quote "${REMOTE_ARCHIVE}")"
  "APP_WEBSITE_REMOTE_RELEASE_BASE=$(shell_quote "${REMOTE_RELEASE_BASE}")"
  "APP_WEBSITE_REMOTE_RELEASE_DIR=$(shell_quote "${REMOTE_RELEASE_DIR}")"
  "APP_WEBSITE_REMOTE_RUNTIME_BASE=$(shell_quote "${REMOTE_RUNTIME_BASE}")"
  "APP_WEBSITE_REMOTE_OLD_REPO=$(shell_quote "${REMOTE_OLD_REPO}")"
  "APP_WEBSITE_REMOTE_NGINX_CONFIG=$(shell_quote "${REMOTE_NGINX_CONFIG}")"
  "APP_WEBSITE_REMOTE_NVM_DIR=$(shell_quote "${REMOTE_NVM_DIR}")"
  "APP_WEBSITE_REMOTE_NODE_VERSION=$(shell_quote "${REMOTE_NODE_VERSION}")"
  "APP_WEBSITE_REMOTE_RELEASE_KEEP=$(shell_quote "${REMOTE_RELEASE_KEEP}")"
  "APP_WEBSITE_REMOTE_INCOMING_KEEP=$(shell_quote "${REMOTE_INCOMING_KEEP}")"
  "APP_WEBSITE_DB_BACKUP_KEEP=$(shell_quote "${DB_BACKUP_KEEP}")"
  "APP_WEBSITE_ALLOW_DATA_LOSS=$(shell_quote "${ALLOW_DATA_LOSS}")"
)

run_ssh "${REMOTE_ENV[*]} bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

load_node_env() {
  export NVM_DIR="${APP_WEBSITE_REMOTE_NVM_DIR}"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "${NVM_DIR}/nvm.sh"
    nvm use "${APP_WEBSITE_REMOTE_NODE_VERSION}" >/dev/null 2>&1 || true
  fi

  if ! command -v node >/dev/null 2>&1; then
    for bin_dir in "${NVM_DIR}"/versions/node/*/bin; do
      if [ -d "${bin_dir}" ]; then
        export PATH="${bin_dir}:${PATH}"
      fi
    done
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing command on remote: $1"
    exit 1
  fi
}

require_nonnegative_integer() {
  local name="$1"
  local value="$2"
  case "${value}" in
    '' | *[!0-9]*)
      echo "${name} must be a non-negative integer, got: ${value}" >&2
      exit 1
      ;;
  esac
}

require_positive_integer() {
  local name="$1"
  local value="$2"
  require_nonnegative_integer "${name}" "${value}"
  if [ "${value}" -lt 1 ]; then
    echo "${name} must be at least 1, got: ${value}" >&2
    exit 1
  fi
}

copy_if_missing() {
  local source_path="$1"
  local target_path="$2"
  if [ ! -e "${target_path}" ] && [ -e "${source_path}" ]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -a "${source_path}" "${target_path}"
  fi
}

prune_database_backups() {
  local kept=0
  local backup_path

  while IFS= read -r backup_path; do
    [ -f "${backup_path}" ] || continue
    kept=$((kept + 1))
    if [ "${kept}" -le "${APP_WEBSITE_DB_BACKUP_KEEP}" ]; then
      continue
    fi

    case "${backup_path}" in
      "${DB_BACKUP_DIR}"/rwkv.app-*.db)
        if ! rm -f -- "${backup_path}"; then
          echo "warning: failed to remove old database backup: ${backup_path}" >&2
        fi
        ;;
      *)
        echo "warning: skipped unexpected database backup path: ${backup_path}" >&2
        ;;
    esac
  done < <(ls -1dt "${DB_BACKUP_DIR}"/rwkv.app-*.db 2>/dev/null || true)
}

backup_database() {
  if [ ! -f "${DATABASE_PATH}" ]; then
    echo "database_backup=skipped_no_existing_database"
    return
  fi

  require_command sqlite3
  mkdir -p "${DB_BACKUP_DIR}"

  local backup_name
  local backup_path
  local quick_check
  backup_name="rwkv.app-${APP_WEBSITE_RELEASE_NAME}-$(date -u +%Y%m%dT%H%M%SZ).db"
  backup_path="${DB_BACKUP_DIR}/${backup_name}"

  (
    cd "${DB_BACKUP_DIR}"
    sqlite3 "${DATABASE_PATH}" <<SQLITE_BACKUP
.timeout 10000
.backup '${backup_name}'
SQLITE_BACKUP
  )

  quick_check="$(sqlite3 "${backup_path}" 'PRAGMA quick_check;')"
  if [ "${quick_check}" != "ok" ]; then
    echo "database backup failed quick_check: ${backup_path}" >&2
    exit 1
  fi

  echo "database_backup=${backup_path}"
  prune_database_backups
}

configure_logrotate() {
  if ! command -v logrotate >/dev/null 2>&1; then
    echo "warning: logrotate is not installed; rwkv-backend logs will not be rotated automatically" >&2
    return
  fi

  local logrotate_config="/etc/logrotate.d/app-website"
  local logrotate_tmp="${logrotate_config}.tmp"

  cat >"${logrotate_tmp}" <<LOGROTATE_CONFIG
"${RUNTIME_BACKEND}/logs/rwkv-backend-*.log" {
    daily
    maxsize 20M
    rotate 7
    missingok
    notifempty
    compress
    delaycompress
    dateext
    copytruncate
    su root root
}
LOGROTATE_CONFIG
  chmod 0644 "${logrotate_tmp}"

  if ! logrotate --debug "${logrotate_tmp}" >/dev/null 2>&1; then
    rm -f "${logrotate_tmp}"
    echo "invalid logrotate configuration for rwkv-backend" >&2
    exit 1
  fi

  mv "${logrotate_tmp}" "${logrotate_config}"
  echo "logrotate_config=${logrotate_config}"
}

prune_remote_incoming() {
  local kept=0
  local archive_path

  while IFS= read -r archive_path; do
    [ -f "${archive_path}" ] || continue
    kept=$((kept + 1))
    if [ "${kept}" -le "${APP_WEBSITE_REMOTE_INCOMING_KEEP}" ]; then
      continue
    fi

    case "${archive_path}" in
      "${APP_WEBSITE_REMOTE_RELEASE_BASE}"/incoming/app-website-*.tar.gz)
        if ! rm -f -- "${archive_path}"; then
          echo "warning: failed to remove old incoming artifact: ${archive_path}" >&2
        fi
        ;;
      *)
        echo "warning: skipped unexpected incoming artifact path: ${archive_path}" >&2
        ;;
    esac
  done < <(ls -1dt "${APP_WEBSITE_REMOTE_RELEASE_BASE}"/incoming/app-website-*.tar.gz 2>/dev/null || true)
}

prune_remote_releases() {
  local current_target
  local kept=0
  local release_path
  local resolved_release_path

  current_target="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"

  while IFS= read -r release_path; do
    [ -d "${release_path}" ] || continue
    resolved_release_path="$(readlink -f "${release_path}" 2>/dev/null || true)"
    if [ "${release_path}" = "${APP_WEBSITE_REMOTE_RELEASE_DIR}" ]; then
      continue
    fi
    if [ -n "${current_target}" ] && [ "${resolved_release_path}" = "${current_target}" ]; then
      continue
    fi

    kept=$((kept + 1))
    if [ "${kept}" -le "${APP_WEBSITE_REMOTE_RELEASE_KEEP}" ]; then
      continue
    fi

    case "${release_path}" in
      "${APP_WEBSITE_REMOTE_RELEASE_BASE}"/releases/app-website-*)
        if ! rm -rf -- "${release_path}"; then
          echo "warning: failed to remove old remote release: ${release_path}" >&2
        fi
        ;;
      *)
        echo "warning: skipped unexpected remote release path: ${release_path}" >&2
        ;;
    esac
  done < <(ls -1dt "${APP_WEBSITE_REMOTE_RELEASE_BASE}"/releases/app-website-* 2>/dev/null || true)
}

load_node_env
require_command node
require_command pnpm
require_command pm2
require_command nginx
require_command curl
require_nonnegative_integer APP_WEBSITE_REMOTE_RELEASE_KEEP "${APP_WEBSITE_REMOTE_RELEASE_KEEP}"
require_nonnegative_integer APP_WEBSITE_REMOTE_INCOMING_KEEP "${APP_WEBSITE_REMOTE_INCOMING_KEEP}"
require_positive_integer APP_WEBSITE_DB_BACKUP_KEEP "${APP_WEBSITE_DB_BACKUP_KEEP}"
if [ "${APP_WEBSITE_ALLOW_DATA_LOSS}" != "0" ] && [ "${APP_WEBSITE_ALLOW_DATA_LOSS}" != "1" ]; then
  echo "APP_WEBSITE_ALLOW_DATA_LOSS must be 0 or 1, got: ${APP_WEBSITE_ALLOW_DATA_LOSS}" >&2
  exit 1
fi

RUNTIME_BACKEND="${APP_WEBSITE_REMOTE_RUNTIME_BASE}/backend"
CURRENT_LINK="${APP_WEBSITE_REMOTE_RELEASE_BASE}/current"
OLD_FRONTEND_ROOT="${APP_WEBSITE_REMOTE_OLD_REPO}/frontend/out"
NEW_FRONTEND_ROOT="${CURRENT_LINK}/frontend/out"
DATABASE_PATH="${RUNTIME_BACKEND}/prisma/rwkv.app.db"
DB_BACKUP_DIR="${RUNTIME_BACKEND}/backups"

mkdir -p \
  "${APP_WEBSITE_REMOTE_RELEASE_BASE}/incoming" \
  "${APP_WEBSITE_REMOTE_RELEASE_BASE}/releases" \
  "${DB_BACKUP_DIR}" \
  "${RUNTIME_BACKEND}/prisma" \
  "${RUNTIME_BACKEND}/logs"

current_target_before_extract="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
requested_release_target="$(readlink -m "${APP_WEBSITE_REMOTE_RELEASE_DIR}")"
if [ -n "${current_target_before_extract}" ] && [ "${requested_release_target}" = "${current_target_before_extract}" ]; then
  echo "refusing to replace the release currently referenced by ${CURRENT_LINK}" >&2
  exit 1
fi

rm -rf -- "${APP_WEBSITE_REMOTE_RELEASE_DIR}"
tar -xzf "${APP_WEBSITE_REMOTE_ARCHIVE}" -C "${APP_WEBSITE_REMOTE_RELEASE_BASE}/releases"
test -d "${APP_WEBSITE_REMOTE_RELEASE_DIR}"

copy_if_missing "${APP_WEBSITE_REMOTE_OLD_REPO}/backend/.env" "${RUNTIME_BACKEND}/.env"
copy_if_missing "${APP_WEBSITE_REMOTE_OLD_REPO}/backend/prisma/rwkv.app.db" "${RUNTIME_BACKEND}/prisma/rwkv.app.db"
if [ -d "${APP_WEBSITE_REMOTE_OLD_REPO}/backend/logs" ] && [ -z "$(find "${RUNTIME_BACKEND}/logs" -mindepth 1 -maxdepth 1 2>/dev/null || true)" ]; then
  cp -a "${APP_WEBSITE_REMOTE_OLD_REPO}/backend/logs/." "${RUNTIME_BACKEND}/logs/" || true
fi

test -f "${RUNTIME_BACKEND}/.env"

cd "${APP_WEBSITE_REMOTE_RELEASE_DIR}/backend"
mkdir -p prisma
rm -f .env prisma/rwkv.app.db
rm -rf logs
ln -s "${RUNTIME_BACKEND}/.env" .env
ln -s "${RUNTIME_BACKEND}/prisma/rwkv.app.db" prisma/rwkv.app.db
ln -s "${RUNTIME_BACKEND}/logs" logs

cd "${APP_WEBSITE_REMOTE_RELEASE_DIR}"
pnpm install --frozen-lockfile --filter backend...

cd "${APP_WEBSITE_REMOTE_RELEASE_DIR}/backend"
pnpm prisma:generate

backup_database

if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  if [ "${APP_WEBSITE_ALLOW_DATA_LOSS}" = "1" ]; then
    echo "warning: APP_WEBSITE_ALLOW_DATA_LOSS=1; Prisma may apply destructive schema changes" >&2
    pnpm exec prisma db push --accept-data-loss
  else
    pnpm exec prisma db push
  fi
else
  pnpm prisma:migrate:deploy
fi

configure_logrotate

ln -sfnT "${APP_WEBSITE_REMOTE_RELEASE_DIR}" "${CURRENT_LINK}"

if grep -Fq "root ${OLD_FRONTEND_ROOT};" "${APP_WEBSITE_REMOTE_NGINX_CONFIG}"; then
  old_root_escaped="$(printf "%s\n" "${OLD_FRONTEND_ROOT}" | sed 's/[\/&]/\\&/g')"
  new_root_escaped="$(printf "%s\n" "${NEW_FRONTEND_ROOT}" | sed 's/[\/&]/\\&/g')"
  sed -i.app-website-artifact-backup "s/root ${old_root_escaped};/root ${new_root_escaped};/" "${APP_WEBSITE_REMOTE_NGINX_CONFIG}"
elif grep -Fq "root ${NEW_FRONTEND_ROOT};" "${APP_WEBSITE_REMOTE_NGINX_CONFIG}"; then
  true
else
  echo "nginx root did not match expected old or new path"
  exit 1
fi

nginx -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

cd "${CURRENT_LINK}/backend"
desired_pm2_cwd="${CURRENT_LINK}/backend"
export APP_WEBSITE_BACKEND_CWD="${desired_pm2_cwd}"
export NODE_INTERPRETER="$(command -v node)"
current_pm2_cwd="$(
  pm2 jlist | node -e "
let input = '';
process.stdin.on('data', (chunk) => input += chunk);
process.stdin.on('end', () => {
  try {
    const apps = JSON.parse(input);
    const app = apps.find((entry) => entry.name === 'rwkv-backend');
    process.stdout.write(app?.pm2_env?.pm_cwd || '');
  } catch {
    process.stdout.write('');
  }
});
"
)"

if [ "${current_pm2_cwd}" ] && [ "${current_pm2_cwd}" != "${desired_pm2_cwd}" ]; then
  pm2 delete rwkv-backend
fi

if pm2 describe rwkv-backend >/dev/null 2>&1; then
  pm2 restart ecosystem.prod.config.js --only rwkv-backend --update-env
else
  pm2 start ecosystem.prod.config.js --only rwkv-backend
fi
pm2 save

for attempt in {1..30}; do
  if curl --silent --fail --max-time 2 http://127.0.0.1:3462/health/ready >/dev/null; then
    break
  fi
  sleep 2
done

if ! curl --silent --fail --max-time 2 http://127.0.0.1:3462/health/ready >/dev/null; then
  echo "backend readiness endpoint did not become healthy"
  exit 1
fi

prune_remote_incoming
prune_remote_releases

echo "deployed_release=${APP_WEBSITE_RELEASE_NAME}"
readlink "${CURRENT_LINK}"
cat "${CURRENT_LINK}/release.json"
REMOTE_SCRIPT

curl --silent --fail https://rwkv.halowang.cloud/build-info.json
printf "\n"
curl --silent --fail https://api.rwkv.halowang.cloud/health/live >/dev/null
curl --silent --fail https://api.rwkv.halowang.cloud/health/ready >/dev/null
echo "public_smoke=ok"
