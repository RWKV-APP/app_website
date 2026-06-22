# App Website

RWKV App 下载站与配套后端 API 的公开 monorepo。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![README: English](https://img.shields.io/badge/README-English-blue.svg)](./README.md)
[![README: 简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red.svg)](./README.zh-hans.md)

## 快速命令

```bash
# 本地开发
pnpm dev
```

生产发布时，把 [`docs/ai/publish-prod.md`](./docs/ai/publish-prod.md) 提给 Agent。

## 文档

- Eval Run Zip 格式说明：[`docs/eval-run-zip-format.md`](./docs/eval-run-zip-format.md)
- 生产发布 Agent Runbook：[`docs/ai/publish-prod.md`](./docs/ai/publish-prod.md)

## 仓库结构

```text
app_website/
├── backend/          # NestJS 后端 API 与管理端接口
├── frontend/         # Next.js 前端
├── tools/            # 维护脚本
└── package.json      # workspace 脚本入口
```

## 技术栈

### 后端

- NestJS
- Prisma
- TypeScript
- SQLite

### 前端

- Next.js
- React
- Jotai
- TypeScript

## 生产拓扑

当前生产环境采用如下架构：

- 前端在本地以静态导出方式构建到 `frontend/out`
- `nginx` 直接托管前端静态文件
- 后端由 `PM2` 独立运行
- `nginx` 将 API 请求反向代理到后端，后端默认监听 `3462` 端口

生产发布使用本地构建出的 release artifact。服务器运行
`/root/app_website-artifacts/current`，并把 `.env`、SQLite 数据库和日志保存在
`/root/app_website-runtime/backend`。

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 安装

```bash
pnpm install
cp backend/.env.example backend/.env.local
cp frontend/.env.local.example frontend/.env.local
```

然后根据你的本地环境修改复制后的配置文件。

本地开发时，建议优先使用 `backend/.env.local` 与 `frontend/.env.local`。如果 `backend/.env` 也存在，那么应当在 `.env.local` 中写入本地覆盖项，例如本地后端端口。

## 开发

推荐的本地开发默认值：

- 前端：`http://localhost:3010`
- 后端：`http://localhost:3001`

```bash
pnpm dev
```

说明：

- `pnpm dev` 会同时启动前端和后端
- 浏览器只需要访问 `http://localhost:3010`
- Next.js 开发服务器会把 API 请求 rewrite 到 `frontend/.env.local` 中配置的后端地址
- 这样可以避免本地开发时出现浏览器跨域问题
- 如果你想单独启动某一侧，可以使用 `pnpm --filter backend dev` 或 `pnpm --filter frontend dev`

## 构建

```bash
pnpm build
```

该命令会同时构建前端静态产物 `frontend/out` 与后端应用。

## 生产部署说明

典型的生产职责划分如下：

- 本地开发机：执行检查，构建前后端，并上传 release artifact
- 服务器：安装 Linux 运行依赖，准备 Prisma，切换 `current`，重启 PM2

推荐的生产发布入口是 Agent Runbook：

[`docs/ai/publish-prod.md`](./docs/ai/publish-prod.md)

想发布时, 直接把这个文件提给 Agent。该 runbook 会要求 Agent：

- 将最新 `zh-Hans` 更新日志同步到 `zh-Hant`、`en`、`ja`、`ko`、`ru`
- 在有本地改动时创建 Git commit
- 将 commit 推送到已配置的 Git 远端
- 执行 `pnpm check`
- 构建 `frontend/out` 和 `backend/dist`
- 生成 `.release/app-website-<git-sha>-<timestamp>.tar.gz`
- 上传 artifact 到 `rwkv.halowang.cloud`
- 将 `/root/app_website-artifacts/current` 指向新 release
- 在 Linux 上准备 Prisma，并重启 `rwkv-backend` 这个 PM2 进程

artifact 构建会使用已提交的本地 `HEAD` 生成 `release.json` 和
`build-info.json` 的版本标识。正常生产发布不再要求服务器通过 Git 拉取源码。

runbook 内部使用的底层 artifact 上传命令是：

```bash
pnpm deploy:prod
```

如果需要临时使用旧的服务器源码构建路径，可以执行：

```bash
pnpm deploy:prod:server-build
```

每次前端构建时，还会额外生成一份 `frontend/public/build-info.json`，最终会随静态站点一起发布为 `/build-info.json`。这份文件就是前端构建标识，用来确认当前线上页面到底来自哪一次 build。

你可以这样查看：

```bash
curl https://rwkv.halowang.cloud/build-info.json
```

你也可以直接打开页面源码或浏览器开发者工具，查看这些 meta 标签：

- `rwkv-build-summary`
- `rwkv-build-time`
- `rwkv-build-source`
- `rwkv-build-commit-short`

生产环境应优先使用真实环境变量，或者在服务器本地使用 `backend/.env` / `backend/.env.local`。不要把生产密钥提交进仓库。

## 环境变量

本仓库是公开项目，因此不会提交任何真实密钥。

本仓库推荐的最佳实践：

- 可以提交示例文件，例如 `backend/.env.example` 和 `frontend/.env.local.example`
- 不要提交真实的 `.env`、`.env.local`、`.env.development.local` 或生产密钥文件
- 不要额外发明 `.develop` 这样的自定义命名，优先使用标准的 `.env.local` / `.env.development` 体系

请使用 `backend/.env.example` 与 `frontend/.env.local.example` 作为模板，并仅在本地或部署环境中填入真实值。

常见变量包括：

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

## 公开项目说明

请不要把真实凭据、访问令牌、服务器私密信息或本地环境文件提交到这个仓库中。
