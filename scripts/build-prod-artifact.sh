#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_ROOT="${APP_WEBSITE_RELEASE_DIR:-${PROJECT_ROOT}/.release}"
LOCAL_RELEASE_KEEP="${APP_WEBSITE_LOCAL_RELEASE_KEEP:-5}"
LOCAL_STAGING_KEEP="${APP_WEBSITE_LOCAL_STAGING_KEEP:-0}"

cd "${PROJECT_ROOT}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_FULL_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
GIT_DIRTY="false"
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  GIT_DIRTY="true"
fi

BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RELEASE_NAME="app-website-${GIT_SHA}-$(date -u +%Y%m%dT%H%M%SZ)"
STAGING_DIR="${RELEASE_ROOT}/${RELEASE_NAME}"
ARCHIVE_PATH="${RELEASE_ROOT}/${RELEASE_NAME}.tar.gz"
TSC_BUILDINFO="frontend/tsconfig.tsbuildinfo"
TSC_BUILDINFO_BACKUP=""

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

prune_local_archives() {
  local kept=0
  local archive_path

  while IFS= read -r archive_path; do
    [ -f "${archive_path}" ] || continue
    kept=$((kept + 1))
    if [ "${kept}" -le "${LOCAL_RELEASE_KEEP}" ]; then
      continue
    fi

    case "${archive_path}" in
      "${RELEASE_ROOT}"/app-website-*.tar.gz)
        if ! rm -f -- "${archive_path}"; then
          echo "warning: failed to remove old local artifact: ${archive_path}" >&2
        fi
        ;;
      *)
        echo "warning: skipped unexpected local artifact path: ${archive_path}" >&2
        ;;
    esac
  done < <(ls -1dt "${RELEASE_ROOT}"/app-website-*.tar.gz 2>/dev/null || true)
}

prune_local_staging_dirs() {
  local kept=0
  local staging_path

  while IFS= read -r staging_path; do
    [ -d "${staging_path}" ] || continue
    kept=$((kept + 1))
    if [ "${kept}" -le "${LOCAL_STAGING_KEEP}" ]; then
      continue
    fi

    case "${staging_path}" in
      "${RELEASE_ROOT}"/app-website-*)
        if ! rm -rf -- "${staging_path}"; then
          echo "warning: failed to remove old local staging directory: ${staging_path}" >&2
        fi
        ;;
      *)
        echo "warning: skipped unexpected local staging path: ${staging_path}" >&2
        ;;
    esac
  done < <(ls -1dt "${RELEASE_ROOT}"/app-website-* 2>/dev/null || true)
}

restore_buildinfo() {
  if [ -n "${TSC_BUILDINFO_BACKUP}" ] && [ -f "${TSC_BUILDINFO_BACKUP}" ]; then
    cp "${TSC_BUILDINFO_BACKUP}" "${TSC_BUILDINFO}"
    rm -f "${TSC_BUILDINFO_BACKUP}"
  fi
}

if git ls-files --error-unmatch "${TSC_BUILDINFO}" >/dev/null 2>&1 && [ -f "${TSC_BUILDINFO}" ]; then
  TSC_BUILDINFO_BACKUP="$(mktemp)"
  cp "${TSC_BUILDINFO}" "${TSC_BUILDINFO_BACKUP}"
  trap restore_buildinfo EXIT
fi

require_positive_integer APP_WEBSITE_LOCAL_RELEASE_KEEP "${LOCAL_RELEASE_KEEP}"
require_nonnegative_integer APP_WEBSITE_LOCAL_STAGING_KEEP "${LOCAL_STAGING_KEEP}"

echo "release_name=${RELEASE_NAME}"
echo "git_sha=${GIT_SHA}"

pnpm check
APP_BUILD_SOURCE=deploy:prod pnpm --filter frontend build
pnpm --filter backend build

if [ ! -d "frontend/out" ]; then
  echo "frontend/out not found after frontend build"
  exit 1
fi

if [ ! -f "backend/dist/main.js" ]; then
  echo "backend/dist/main.js not found after backend build"
  exit 1
fi

if [ ! -d "packages/contracts/dist" ]; then
  echo "packages/contracts/dist not found after build"
  exit 1
fi

rm -rf "${STAGING_DIR}"
mkdir -p \
  "${STAGING_DIR}/backend/data" \
  "${STAGING_DIR}/backend/prisma" \
  "${STAGING_DIR}/frontend" \
  "${STAGING_DIR}/packages/contracts" \
  "${RELEASE_ROOT}"

cp package.json pnpm-lock.yaml pnpm-workspace.yaml "${STAGING_DIR}/"
cp backend/package.json backend/ecosystem.prod.config.js "${STAGING_DIR}/backend/"
cp frontend/package.json "${STAGING_DIR}/frontend/package.json"
cp backend/prisma/schema.prisma "${STAGING_DIR}/backend/prisma/schema.prisma"
cp packages/contracts/package.json "${STAGING_DIR}/packages/contracts/package.json"

cp -R backend/dist "${STAGING_DIR}/backend/dist"
cp -R frontend/out "${STAGING_DIR}/frontend/out"
cp -R packages/contracts/dist "${STAGING_DIR}/packages/contracts/dist"

if [ -d "backend/data/release-notes" ]; then
  cp -R backend/data/release-notes "${STAGING_DIR}/backend/data/release-notes"
fi

RELEASE_NAME="${RELEASE_NAME}" \
GIT_FULL_SHA="${GIT_FULL_SHA}" \
GIT_SHA="${GIT_SHA}" \
GIT_BRANCH="${GIT_BRANCH}" \
GIT_DIRTY="${GIT_DIRTY}" \
BUILD_TIME="${BUILD_TIME}" \
RELEASE_JSON="${STAGING_DIR}/release.json" \
node -e "
const fs = require('fs');
const release = {
  name: process.env.RELEASE_NAME,
  gitSha: process.env.GIT_FULL_SHA,
  gitShortSha: process.env.GIT_SHA,
  gitBranch: process.env.GIT_BRANCH,
  gitDirty: process.env.GIT_DIRTY === 'true',
  builtAt: process.env.BUILD_TIME,
  buildSource: 'deploy:prod',
  contents: [
    'backend/dist',
    'backend/data/release-notes',
    'backend/prisma/schema.prisma',
    'backend/ecosystem.prod.config.js',
    'frontend/package.json',
    'frontend/out',
    'packages/contracts/dist'
  ]
};
fs.writeFileSync(process.env.RELEASE_JSON, JSON.stringify(release, null, 2) + '\n');
"

TAR_OPTIONS=()
if tar --no-xattrs -cf /dev/null --files-from /dev/null >/dev/null 2>&1; then
  TAR_OPTIONS+=(--no-xattrs)
fi

COPYFILE_DISABLE=1 tar "${TAR_OPTIONS[@]}" -C "${RELEASE_ROOT}" -czf "${ARCHIVE_PATH}" "${RELEASE_NAME}"
tar -tzf "${ARCHIVE_PATH}" >/dev/null

rm -rf -- "${STAGING_DIR}"
prune_local_archives
prune_local_staging_dirs

echo "artifact_path=${ARCHIVE_PATH}"
