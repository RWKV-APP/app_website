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

run_ssh() {
  ssh -o StrictHostKeyChecking=no "${SSH_TARGET}" "$@"
}

run_scp() {
  scp -o StrictHostKeyChecking=no "$@"
}

shell_quote() {
  printf "%q" "$1"
}

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

copy_if_missing() {
  local source_path="$1"
  local target_path="$2"
  if [ ! -e "${target_path}" ] && [ -e "${source_path}" ]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -a "${source_path}" "${target_path}"
  fi
}

load_node_env
require_command node
require_command pnpm
require_command pm2
require_command nginx
require_command curl

RUNTIME_BACKEND="${APP_WEBSITE_REMOTE_RUNTIME_BASE}/backend"
CURRENT_LINK="${APP_WEBSITE_REMOTE_RELEASE_BASE}/current"
OLD_FRONTEND_ROOT="${APP_WEBSITE_REMOTE_OLD_REPO}/frontend/out"
NEW_FRONTEND_ROOT="${CURRENT_LINK}/frontend/out"

mkdir -p \
  "${APP_WEBSITE_REMOTE_RELEASE_BASE}/incoming" \
  "${APP_WEBSITE_REMOTE_RELEASE_BASE}/releases" \
  "${RUNTIME_BACKEND}/prisma" \
  "${RUNTIME_BACKEND}/logs"

rm -rf "${APP_WEBSITE_REMOTE_RELEASE_DIR}"
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

if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  pnpm exec prisma db push --accept-data-loss
else
  pnpm prisma:migrate:deploy
fi

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
  if curl --silent --fail http://127.0.0.1:3462/location >/dev/null; then
    break
  fi
  sleep 2
done

if ! curl --silent --fail http://127.0.0.1:3462/location >/dev/null; then
  echo "backend location endpoint did not become reachable"
  exit 1
fi

echo "deployed_release=${APP_WEBSITE_RELEASE_NAME}"
readlink "${CURRENT_LINK}"
cat "${CURRENT_LINK}/release.json"
REMOTE_SCRIPT

curl --silent --fail https://rwkv.halowang.cloud/build-info.json
printf "\n"
curl --silent --fail https://api.rwkv.halowang.cloud/location >/dev/null
echo "public_smoke=ok"
