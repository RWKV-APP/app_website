#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_ROOT="${APP_WEBSITE_RELEASE_DIR:-${PROJECT_ROOT}/.release}"

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

echo "artifact_path=${ARCHIVE_PATH}"
