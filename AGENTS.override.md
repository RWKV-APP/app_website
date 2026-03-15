# AGENTS.override.md

## 本地项目路径

- flutter 前端仓库：`../rwkv_app`
- flutter_cpp 桥接层：`../rwkv_mobile_flutter`
- cpp 后端推理引擎：`../rwkv_mobile` (可能为空)
- app 下载页面与 http 服务器后端 ：`./` (本项目)

## 远程部署约定

- 线上访问域名：`rwkv.halowang.cloud`
- API 访问域名：`api.rwkv.halowang.cloud`
- 远程项目目录：`/root/repo/app_website`
- 前端部署方式：`nginx` 直接托管 `frontend/out`
- 后端部署方式：`pm2` 管理 `rwkv-backend`
