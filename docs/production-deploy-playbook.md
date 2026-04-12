# Linux 线上机改动后的发布流程（Deploy Playbook）

本文档把本仓库在 Linux 公网服务器上的标准发布流程整理成一份可重复执行的操作手册。

它不是 Codex 内置 skill，但可以把它当作本仓库自己的 deploy playbook 来使用。

## 适用场景

- 当前环境是 Linux，且工作目录是本仓库
- 当前机器承载真实线上服务
- 你刚修改了会影响线上行为的代码，并希望改动立刻生效

根据项目约定：

- macOS / Windows 视为本地开发环境，优先使用 `pnpm dev`
- Linux 视为公网服务器环境，线上发布以 `pnpm deploy:prod` 为准

## 硬规则

如果改动会影响线上真实行为，只改文件不够，必须继续执行：

```bash
pnpm deploy:prod
```

否则常见结果就是：

- `src/` 已经是新逻辑
- 磁盘上的 `dist/` 可能还是旧产物
- `PM2` 中正在运行的 `rwkv-backend` 仍然是旧进程
- 最终外部请求看到的仍是旧行为

## 什么情况下必须部署

出现以下任一情况，就应执行 `pnpm deploy:prod`：

- 改了 `backend/src/` 下会影响 API 返回值、鉴权、数据库读写、任务调度的代码
- 改了 `frontend/` 下会影响线上页面、静态资源、meta、路由或 API 调用行为的代码
- 改了 Prisma schema、构建流程、环境加载方式，且希望线上服务切到新逻辑
- 改动完成后，你要验证 `rwkv.halowang.cloud` 或 `api.rwkv.halowang.cloud` 的真实线上结果

## 什么情况下通常不需要部署

以下情况通常不需要执行 `pnpm deploy:prod`：

- 只修改了仓库文档，例如 `README.md`、`docs/*.md`
- 只做了思路排查、日志分析、代码阅读，没有实际改动线上运行代码
- 只改了不会被当前线上构建和运行链路读取的本地辅助文件

如果不确定是否会影响线上行为，默认按“需要部署”处理更稳妥。

## 标准入口命令

线上发布统一入口：

```bash
pnpm deploy:prod
```

它实际会执行：

```bash
bash scripts/start-prod.sh
```

## 这条命令实际会做什么

`pnpm deploy:prod` 当前会串起整条正式发布链路：

1. 构建前端，并生成 `frontend/out`
2. 生成 Prisma Client
3. 在没有迁移文件时执行 `prisma db push --accept-data-loss`
4. 构建后端产物
5. 通过 PM2 重启 `rwkv-backend`
6. 保存 PM2 当前进程配置

对当前线上拓扑来说，这一步不是“可选优化”，而是“让改动真正生效”的必要步骤。

## 当前真实线上拓扑

- `nginx` 对外监听 `80/443`
- `rwkv.halowang.cloud` 直接托管 `frontend/out`
- `api.rwkv.halowang.cloud` 反向代理到 `http://127.0.0.1:3462`
- PM2 管理的后端进程名是 `rwkv-backend`
- 后端实际启动文件是 `backend/dist/main.js`

因此：

- 前端改动最终是否生效，要看 `frontend/out` 是否更新
- 后端改动最终是否生效，要看 `backend/dist/main.js` 对应的新构建是否已被 PM2 重启加载

## 推荐执行流程

### 1. 先确认自己所在环境

- 如果是 macOS / Windows：按本地开发处理，优先 `pnpm dev`
- 如果是 Linux：按线上服务器处理，发布入口使用 `pnpm deploy:prod`

### 2. 完成代码修改

- 确认本次改动确实属于要上线的范围
- 避免把无关改动混进同一次发布

### 3. 做最小必要验证

- 至少确认改动没有明显语法、类型或路由错误
- 如果有局部验证命令，先在发布前跑一遍

### 4. 执行正式发布

```bash
pnpm deploy:prod
```

### 5. 发布后立即核验

至少核对以下一项或多项：

- 直接请求线上 API，确认返回值已变化
- 检查 `pm2 status`
- 检查 `pm2 logs rwkv-backend`
- 检查前端 `build-info.json`
- 在浏览器 DevTools 中确认新的 build meta 已出现

## 发布后核验清单

后端改动建议至少做：

```bash
curl -sS http://127.0.0.1:3462/health
```

如果没有专门 `health` 路由，就直接请求本次改动涉及的真实接口。

前端改动建议至少做：

- 打开 `https://rwkv.halowang.cloud/build-info.json`
- 核对 `rwkv-build-summary`、`rwkv-build-time`、`rwkv-build-source` 等 meta

## 常见误区

### 误区 1：改了 `src/` 就等于线上生效

不是。当前线上后端实际跑的是 `backend/dist/main.js`，不是 `backend/src/**/*.ts`。

### 误区 2：只要构建过就可以，不一定要重启 PM2

在当前拓扑下不成立。新的后端构建产物如果没有被 `rwkv-backend` 重新加载，外部请求仍可能命中旧进程。

### 误区 3：看到仓库里代码对了，就说明线上一定对

不成立。需要同时确认：

- 代码已经改对
- 产物已经重建
- PM2 进程已经重启
- 线上请求已经命中新版本

## 一个典型判断模板

当需求是“我刚改了后端接口返回值，现在希望客户端立刻拿到新结果”时，默认流程应是：

1. 改代码
2. 验证本次修改
3. 执行 `pnpm deploy:prod`
4. 重新请求线上接口确认结果

如果缺少第 3 步，就不能把“代码已修改”当作“线上已生效”。

## 相关文件

- `AGENTS.md`
- `package.json`
- `scripts/start-prod.sh`
- `backend/ecosystem.prod.config.js`
