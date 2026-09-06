# App Website

Public monorepo for the RWKV app download website and its supporting backend API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![README: English](https://img.shields.io/badge/README-English-blue.svg)](./README.md)
[![README: 简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red.svg)](./README.zh-hans.md)

## Quick Commands

```bash
# local development
pnpm dev
```

For production publishing, mention [`docs/deploy.md`](./docs/deploy.md) to the agent.

## Documentation

- Eval run zip format: [`docs/eval-run-zip-format.md`](./docs/eval-run-zip-format.md)
- Production publish agent runbook: [`docs/deploy.md`](./docs/deploy.md)

## Repository Layout

```text
app_website/
├── backend/          # NestJS backend API and admin endpoints
├── frontend/         # Next.js frontend
├── tools/            # maintenance scripts
└── package.json      # workspace scripts
```

## Tech Stack

### Backend

- NestJS
- Prisma
- TypeScript
- SQLite

### Frontend

- Next.js
- React
- Jotai
- TypeScript

## Production Topology

The current production architecture is:

- the frontend is built locally as a static export into `frontend/out`
- `nginx` serves the static frontend
- the backend runs separately under `PM2`
- `nginx` proxies API traffic to the backend, which listens on port `3462` by default

Production publishes use local-built release artifacts. The server runs
`/root/app_website-artifacts/current` and keeps `.env`, SQLite data, and logs in
`/root/app_website-runtime/backend`.

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Installation

```bash
pnpm install
cp backend/.env.example backend/.env.local
cp frontend/.env.local.example frontend/.env.local
```

Then edit the copied files and replace placeholder values with your local configuration.

For local development, prefer `backend/.env.local` and `frontend/.env.local`. If `backend/.env` also exists, `.env.local` should contain your local overrides such as the local backend port.

## Development

Recommended local development defaults:

- frontend: `http://localhost:3010`
- backend: `http://localhost:3001`

```bash
pnpm dev
```

Notes:

- `pnpm dev` starts both frontend and backend together
- the browser talks only to `http://localhost:3010`
- the Next.js dev server rewrites API requests to the backend origin configured in `frontend/.env.local`
- this avoids browser-side cross-origin requests during local development
- if you need to run the services separately, use `pnpm --filter backend dev` or `pnpm --filter frontend dev`

## Remote Model Config Validation

Authenticated uploads to `POST /admin-api/remote-configs/upload` accept
`modelScopeOnly: true` alongside `fileName`, JSON-string `content`, and optional
`publishNow`. Use this explicit mode when Hugging Face verification is deferred.
It applies to `latest.json` and numbered App configs, makes only ModelScope
metadata requests, and records the selected source in the upload activity.

Direct ModelScope URLs must use `HaloWang1991/rwkv-weights-tmp` or
`HaloWang1991/rwkv-weights`, a 40-hex commit revision, an `artifacts/` path,
`availableIn: ["modelscope"]`, and matching file size and SHA-256. Legacy Hugging
Face URLs must map to an approved ModelScope mirror; their file size is
synchronized, any declared SHA-256 is checked, and their existing date is kept.
Omitting the option retains dual-source checks for legacy URLs and permits only
the temporary repository for direct ModelScope URLs. This mode does not claim
Hugging Face availability or change the config's source declarations.

Run the offline regression check with `node tools/check-modelscope-config.cjs`.

To defer automatic Hugging Face distribution refreshes as well, explicitly set
`HF_DATASETS_ID=` in the backend's private runtime environment before restarting.
This disables Hugging Face and its mirror refreshes without removing cached
download records. An unset variable retains the default repository; restoring
its repository ID re-enables refreshes. Catalog uploads still require the
explicit `modelScopeOnly` option to defer their independent Hugging Face checks.

App update responses continue to link to the download page, but select version
metadata independently for macOS, Linux, Windows x64, Windows ARM64, Android,
and iOS. Publishing one platform does not announce an update for another.
The latest distribution snapshot is capped at version 4.7.2. Newer packages
remain in distribution history and cannot advance the website or App update
response until `LATEST_PUBLISHED_APP_VERSION` is deliberately raised.
Requests without App headers return the original per-channel records within
that cap, including older mirrors and store metadata.

## Build

```bash
pnpm build
```

This builds the frontend static export into `frontend/out` and also builds the backend application.

## Production Deployment Notes

Typical production responsibilities are split as follows:

- local machine: run checks, build frontend/backend, and upload a release artifact
- server: install Linux runtime dependencies, prepare Prisma, switch `current`, and restart PM2

The preferred production publish entry is the agent runbook:

[`docs/deploy.md`](./docs/deploy.md)

Mention that file to the agent when you want to publish. The runbook asks the agent to:

- syncs the latest `zh-Hans` release note into `zh-Hant`, `en`, `ja`, `ko`, and `ru`
- commits local changes when needed
- pushes the commit to the configured Git remote
- runs `pnpm check`
- builds `frontend/out` and `backend/dist`
- writes `.release/app-website-<git-sha>-<timestamp>.tar.gz`
- uploads the artifact to `rwkv.halowang.cloud`
- points `/root/app_website-artifacts/current` at the new release
- prepares Prisma on Linux and restarts `rwkv-backend` under `PM2`

The artifact build uses the committed local `HEAD` for `release.json` and
`build-info.json`. The server no longer needs to pull source code with Git for
normal production publishes.

The lower-level artifact upload command used by the runbook is:

```bash
pnpm deploy:prod
```

If you need the old server-side source build path for emergency maintenance,
run:

```bash
pnpm deploy:prod:server-build
```

Each frontend build also writes deployment metadata into `frontend/public/build-info.json`, which is exported as `/build-info.json` in the final site. This is used as a build marker so you can verify which frontend build is currently online.

You can check it with:

```bash
curl https://rwkv.halowang.cloud/build-info.json
```

You can also inspect the page source or DevTools and look for these meta tags:

- `rwkv-build-summary`
- `rwkv-build-time`
- `rwkv-build-source`
- `rwkv-build-commit-short`

For production, prefer real environment variables or a server-local `backend/.env` or `backend/.env.local` file on the host. Do not commit production secrets.

## Environment Variables

The repository is public, so no real secrets are committed here.

Best practice in this repository:

- commit example files such as `backend/.env.example` and `frontend/.env.local.example`
- do not commit real `.env`, `.env.local`, `.env.development.local`, or production secret files
- do not introduce a custom `.develop` file name; use the standard `.env.local` / `.env.development` conventions instead

Use `backend/.env.example` and `frontend/.env.local.example` as templates and provide real values only in your local or deployment environment.

Common variables:

- `HOST`
- `PORT`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN_SECRET`
- `ADMIN_TOKEN_TTL_HOURS`
- `HF_DATASETS_ID`
- `HF_TOKEN`
- `HF_ENDPOINT`
- `GITHUB_REPO`
- `GITHUB_TOKEN`
- `GITHUB_WEBHOOK_SECRET`
- `PGYER_API_KEY`
- `PGYER_APP_KEY`
- `BACKEND_ORIGIN`

## Public Project Note

Please do not commit real credentials, tokens, private server-specific secrets, or private environment files to this repository.
