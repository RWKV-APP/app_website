# Publish Production

Use this file when the user mentions or attaches `docs/deploy.md`, asks to publish to production, or says the latest app website changes should go live.

This is an agent runbook, not a user-facing shell command. Execute the steps below from the repository root.

## Goal

Publish the current `app_website` state to production while keeping release notes, Git history, and the live artifact release in sync.

## Preconditions

- Confirm the environment first: print `✅ os: _OS_NAME_, user: _USER_NAME_`.
- Work from `/Users/wangce/docs/repo/app_website` unless the user explicitly gives another checkout.
- Do not write secrets to tracked files.
- Keep the repository free of `*.spec.ts` files. Do not add, restore, or commit
  them; `.gitignore` and `pnpm check:no-specs` enforce this Git boundary.
- Treat `backend/data/release-notes/zh-Hans/` as the release-note source of truth.
- Write public release notes for ordinary users: describe the benefit or visible
  behavior in plain language. Do not expose API wiring, credentials/configuration,
  package formats, build numbers or rollout mechanics unless the user explicitly
  requests them for this audience. Use the user-approved wording and meaning in
  every locale; keep engineering and deployment details in internal records.
- The website selects one file per `major.minor` series. Its latest file must
  contain all published version sections in that series, newest first. A request
  to write only a short description for the new version does not remove history.
  Each version's highest-build file owns its original section; corrections belong
  there after review. Never carry sections from another minor series.

## Steps

1. Inspect the working tree.

```bash
git status --short --branch
```

2. Sync release notes.

```bash
node tools/sync-release-notes.mjs
node tools/sync-release-notes.mjs --check
```

If the sync script reports missing translations, translate the latest `zh-Hans` file into the missing locale files manually, preserving locale labels and style:

- `zh-Hant`: `[新增] / [優化] / [修復]`
- `en`: `[New] / [Improved] / [Fix]`
- `ja`: `[新規] / [改善] / [修正]`
- `ko`: `[신규] / [개선] / [수정]`
- `ru`: `[Новое] / [Улучшено] / [Исправлено]`

Then run `node tools/sync-release-notes.mjs --check` again.

The sync command restores missing same-series history in the latest Chinese
file and all five translations. It rejects changed historical sections and
cross-series content instead of silently replacing them. It validates every
locale before writing. `pnpm check:release-notes` checks the regression case and
completeness without modifying files; it is also required by `pnpm check` and
the production artifact build. Never bypass a missing-history failure.

3. Run validation.

```bash
pnpm check
```

4. Review the final changed files.

```bash
git status --short --branch
git diff --stat
git diff --check
```

5. Commit all intended changes.

Use a concise message that describes the user-visible change. If the change is mostly release/publish plumbing, use:

```bash
git add -A
git commit -m "chore: publish app website update"
```

If the user asked for a more specific title, use that.

6. After the commit succeeds, push it first and verify that the upstream branch has the same commit:

```bash
git push
test "$(git rev-parse HEAD)" = "$(git rev-parse '@{upstream}')"
```

Only after both commands succeed, deploy the artifact:

```bash
pnpm deploy:prod
```

`pnpm deploy:prod` is the low-level artifact publish path. It builds locally, uploads the artifact to `rwkv.halowang.cloud`, creates and verifies an online SQLite backup before schema operations, switches `/root/app_website-artifacts/current`, reloads nginx when needed, restarts `rwkv-backend`, and requires `/health/ready` to pass.

By default Prisma refuses schema changes that require data loss. Only use `APP_WEBSITE_ALLOW_DATA_LOSS=1 pnpm deploy:prod` when the destructive change has been reviewed and an explicit data-loss deployment is intended.

7. Verify production.

```bash
ssh root@rwkv.halowang.cloud 'readlink /root/app_website-artifacts/current && cat /root/app_website-artifacts/current/release.json'
ssh root@rwkv.halowang.cloud 'source /root/.nvm/nvm.sh && pm2 describe rwkv-backend'
curl -f https://rwkv.halowang.cloud/build-info.json
curl -f https://api.rwkv.halowang.cloud/health/live
curl -f https://api.rwkv.halowang.cloud/health/ready
```

Verify the production transport policy without changing nginx:

```bash
STATIC_ASSET="$(find frontend/out/_next/static -type f \( -name '*.js' -o -name '*.css' \) -print | head -n 1 | sed 's#^frontend/out##')"
test -n "${STATIC_ASSET}"
curl --http2 --compressed -sS -D - -o /dev/null https://rwkv.halowang.cloud/
curl --http2 --compressed -sS -D - -o /dev/null https://rwkv.halowang.cloud/build-info.json
curl --http2 --compressed -sS -D - -o /dev/null "https://rwkv.halowang.cloud${STATIC_ASSET}"
```

The expected result is HTTP/2 for all three requests, `Cache-Control: no-cache` plus gzip for HTML, `Cache-Control: no-store` for `build-info.json`, and one-year immutable caching plus gzip for hashed JS/CSS.

8. Verify the complete release-note history in all locales.

```bash
node tools/sync-release-notes.mjs --verify-live
```

This read-only check requires both the exact-build endpoint and the series-list
endpoint to match the complete local content, version and build for all six
locales. Non-empty latest content alone is insufficient.

Find the latest source file:

```bash
node tools/sync-release-notes.mjs --print-source
```

For `<build>-<version>.md`, verify:

```bash
curl -f 'https://api.rwkv.halowang.cloud/distributions/release-notes?build=<build>&version=<version>&locale=zh-Hans'
```

The response should have the same `build`, the same `version`, and non-empty `content` that includes the newest section.

Open `/release-notes` and `/changelog` in a browser. Confirm the newest section
and retained historical sections are visible in the same series card, with
the previous minor series in its own card. Capture the result; an API 200 or a
successful build does not prove the visible history survived publication.

9. Final report.

Tell the user:

- commit SHA
- whether `git push` succeeded
- deployed release name from `/root/app_website-artifacts/current/release.json`
- production build marker result
- liveness and readiness results
- HTTP/2, cache policy, and compression verification result
- release notes API result
- any warnings that remain, especially existing lint warnings

## Notes

- The production server does not use `git pull/fetch/checkout` for the standard path.
- Git is used locally for history and for build metadata.
- Server runtime data stays in `/root/app_website-runtime/backend`.
- SQLite backups are stored under `/root/app_website-runtime/backend/backups`; the default retention is 5.
- Local artifacts keep the newest 5 archives and no unpacked staging directories by default. Remote retention keeps `current` unconditionally, plus the newest 5 non-current releases and 3 incoming archives.
- Override retention with `APP_WEBSITE_LOCAL_RELEASE_KEEP`, `APP_WEBSITE_LOCAL_STAGING_KEEP`, `APP_WEBSITE_REMOTE_RELEASE_KEEP`, `APP_WEBSITE_REMOTE_INCOMING_KEEP`, and `APP_WEBSITE_DB_BACKUP_KEEP`. Archive and database-backup retention must be at least 1; the other values may be 0.
- The deploy script installs `/etc/logrotate.d/app-website` when system `logrotate` is available; logs rotate daily or at 20 MiB and keep 7 compressed generations. A missing `logrotate` command produces a warning without downloading anything.
- The old server-side source build path remains available through `pnpm deploy:prod:server-build`, but do not use it for the standard flow unless the user explicitly asks.
