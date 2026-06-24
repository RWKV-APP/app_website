# Publish Production

Use this file when the user mentions or attaches `docs/deploy.md`, asks to publish to production, or says the latest app website changes should go live.

This is an agent runbook, not a user-facing shell command. Execute the steps below from the repository root.

## Goal

Publish the current `app_website` state to production while keeping release notes, Git history, and the live artifact release in sync.

## Preconditions

- Confirm the environment first: print `✅ os: _OS_NAME_, user: _USER_NAME_`.
- Work from `/Users/wangce/docs/repo/app_website` unless the user explicitly gives another checkout.
- Do not write secrets to tracked files.
- Do not add new `*.spec.ts` files.
- Treat `backend/data/release-notes/zh-Hans/` as the release-note source of truth.

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

6. After the commit succeeds, start these two tasks in parallel when possible:

```bash
git push
```

```bash
pnpm deploy:prod
```

`pnpm deploy:prod` is the low-level artifact publish path. It builds locally, uploads the artifact to `rwkv.halowang.cloud`, switches `/root/app_website-artifacts/current`, prepares Prisma on the server, reloads nginx when needed, and restarts `rwkv-backend`.

7. Verify production.

```bash
ssh root@rwkv.halowang.cloud 'readlink /root/app_website-artifacts/current && cat /root/app_website-artifacts/current/release.json'
ssh root@rwkv.halowang.cloud 'source /root/.nvm/nvm.sh && pm2 describe rwkv-backend'
curl -f https://rwkv.halowang.cloud/build-info.json
curl -f https://api.rwkv.halowang.cloud/location
```

8. Verify release notes for the latest source file.

Find the latest source file:

```bash
node tools/sync-release-notes.mjs --print-source
```

For `<build>-<version>.md`, verify:

```bash
curl -f 'https://api.rwkv.halowang.cloud/distributions/release-notes?build=<build>&version=<version>&locale=zh-Hans'
```

The response should have the same `build`, the same `version`, and non-empty `content` that includes the newest section.

9. Final report.

Tell the user:

- commit SHA
- whether `git push` succeeded
- deployed release name from `/root/app_website-artifacts/current/release.json`
- production build marker result
- release notes API result
- any warnings that remain, especially existing lint warnings

## Notes

- The production server does not use `git pull/fetch/checkout` for the standard path.
- Git is used locally for history and for build metadata.
- Server runtime data stays in `/root/app_website-runtime/backend`.
- The old server-side source build path remains available through `pnpm deploy:prod:server-build`, but do not use it for the standard flow unless the user explicitly asks.
