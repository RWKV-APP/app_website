# 部署指南

## 部署流程

当你需要将前端页面部署到远程服务器时，需要执行以下步骤：

### 1. 构建并部署前端到 Backend

```bash
# 方式一：使用部署脚本（推荐）
pnpm deploy

# 方式二：完整构建流程
pnpm build:deploy
```

这个命令会：
1. 构建前端（Next.js 静态导出）
2. 将构建产物复制到 `backend/public/` 目录
3. 构建后端

### 2. 构建 Backend

```bash
pnpm build:backend
```

### 3. 启动生产服务器

```bash
cd backend
pnpm start:prod
```

或者使用 PM2 等进程管理器：

```bash
pm2 start dist/main.js --name app-website
```

## 部署到远程服务器

### 步骤

1. **在本地构建并部署前端**
   ```bash
   pnpm build:deploy
   ```

2. **将整个 backend 目录上传到服务器**
   - 包括 `dist/`（构建后的代码）
   - 包括 `public/`（前端构建产物）
   - 包括 `prisma/`（数据库 schema）
   - 包括 `package.json` 和 `node_modules/`（或运行 `pnpm install --prod`）

3. **在服务器上安装依赖并启动**
   ```bash
   cd backend
   pnpm install --prod
   pnpm prisma:generate
   pnpm start:prod
   ```

## 目录结构说明

部署后的 backend 目录结构：

```
backend/
├── dist/              # 构建后的 NestJS 代码
├── public/            # 前端构建产物（由 deploy 脚本生成）
│   ├── index.html
│   ├── _next/
│   └── ...
├── prisma/
│   └── schema.prisma
├── package.json
└── node_modules/
```

## 注意事项

1. **环境变量**：确保在服务器上配置了 `.env` 文件
   ```
   DATABASE_URL="file:./dev.db"
   PORT=3000
   ```

2. **数据库迁移**：首次部署时需要运行数据库迁移
   ```bash
   pnpm prisma:migrate deploy
   ```

3. **静态文件**：`backend/public/` 目录会在每次运行 `pnpm deploy` 时被覆盖

4. **API 路由**：所有 API 端点都有 `/api` 前缀
   - 健康检查：`http://your-server/api/health`
   - 前端页面：`http://your-server/`（根路径）

## 开发 vs 生产

- **开发环境**：前端和后端分别运行在不同端口
  - Frontend: http://localhost:3001
  - Backend API: http://localhost:3000/api

- **生产环境**：前端由后端提供，统一端口
  - 前端页面: http://your-server/
  - Backend API: http://your-server/api

