# AI Project Map

This repository is the public RWKV app website and supporting backend API.

## Safe Commands

- Local development: `pnpm dev`
- Production publish runbook: `docs/deploy.md`
- Low-level artifact deploy: `pnpm deploy:prod`
- Legacy server-side source deploy: `pnpm deploy:prod:server-build`
- Full read-only verification: `pnpm check`
- Type-only verification: `pnpm type-check`
- Read-only lint: `pnpm lint:check`
- Auto-fix lint: `pnpm lint:fix`

Do not use `pnpm deploy:prod` directly unless the task is explicitly only an artifact deployment. For normal production publishing, follow `docs/deploy.md`.

## Repository Shape

- `frontend/`: Next.js static-export frontend.
- `backend/`: NestJS backend API, PM2 production target.
- `packages/contracts/`: shared frontend/backend enums and stable constants.
- `docs/`: operational docs and handoff notes.
- `docs/deploy.md`: standard Agent-run production publish workflow.
- `tools/`: maintenance scripts and build metadata generation.
- `tools/sync-release-notes.mjs`: syncs latest `zh-Hans` release notes into other locales.
- `scripts/build-prod-artifact.sh`: builds local production release artifacts.
- `scripts/deploy-prod-artifact.sh`: low-level artifact upload and remote restart script.
- `scripts/start-prod.sh`: legacy server-side source build fallback.

## Shared Contracts

Use `@app/contracts` for values that must stay consistent across frontend and backend:

- distribution enum: `DistributionType`
- remote config constants: `REMOTE_CONFIG_TYPES`, `REMOTE_CONFIG_ACTIONS`, `APP_CONFIG_SECTIONS`
- telemetry ordering constants: `TELEMETRY_*`

Avoid re-creating these constants inside feature pages or services.

## Backend Modules

`backend/src/app.module.ts` should stay a thin assembly module. Feature ownership lives in:

- `admin-auth/`: admin login, session parsing, auth guard.
- `distribution/`: app distribution sync, release notes, webhook refresh.
- `remote-config/`: app config upload, publish, archive, public config endpoints.
- `eval/`: eval run import and public/admin eval views.
- `telemetry/`: performance telemetry ingest, leaderboard, admin records.
- `prisma/`: shared Prisma service/module.

When adding a backend feature, prefer a feature module over registering everything directly in `AppModule`.

## Frontend Feature Areas

- `frontend/src/app/page.tsx`: download page UI and state.
- `frontend/src/features/download/downloadRules.ts`: pure download selection/version/source rules.
- `frontend/src/app/labs/model-fit-preview/page.tsx`: telemetry leaderboard UI.
- `frontend/src/features/telemetry/telemetryRules.ts`: pure telemetry labels, grouping, filtering, and metric rules.
- `frontend/src/utils/api.ts`: frontend API client functions.
- `frontend/src/utils/apiBase.ts`: API origin resolution.

Do not add a second API base URL helper inside pages. Add API calls to `frontend/src/utils/api.ts`.

## Public Repo Rules

- Do not commit real `.env`, `.env.local`, tokens, passwords, private keys, or server-local secrets.
- Only example env files should be tracked, such as `backend/.env.example` and `frontend/.env.local.example`.
- Do not add new `*.spec.ts` files. `pnpm check:no-new-specs` guards against newly added spec files.
- For `/evals` and `/admin` pages, do not constrain the main UI shell to narrow `1200px`-style desktop containers.

## Local Runtime

- Frontend dev URL: `http://localhost:3010`
- Backend dev port: `3001`
- Browser should use the frontend dev URL; Next.js rewrites proxy API requests to the backend.

## Production Runtime

- Frontend static output: `frontend/out`
- Public frontend: `https://rwkv.halowang.cloud`
- Backend API: `https://api.rwkv.halowang.cloud`
- Backend PM2 process: `rwkv-backend`
- Production backend port: `3462`
- Build marker: `https://rwkv.halowang.cloud/build-info.json`
- Runtime release symlink: `/root/app_website-artifacts/current`
- Runtime persistent data: `/root/app_website-runtime/backend`

## Refactor Preference

Prefer this order:

1. Move duplicated constants to `packages/contracts`.
2. Move pure frontend rules to `frontend/src/features/*`.
3. Move API calls to `frontend/src/utils/api.ts`.
4. Split backend behavior by feature module.
5. Only then consider deeper service extraction.

Keep each refactor behavior-preserving and verify with `pnpm type-check` at minimum.
