# 本地启动指南

## 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## 启动步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 Backend 环境变量

在 `backend/` 目录下创建 `.env` 文件：

```bash
cd backend
cat > .env << EOF
DATABASE_URL="file:./dev.db"
PORT=3000
EOF
cd ..
```

或者手动创建 `backend/.env` 文件，内容如下：

```
DATABASE_URL="file:./dev.db"
PORT=3000
```

### 3. 初始化数据库

```bash
cd backend
pnpm prisma:generate
pnpm prisma:migrate dev --name init
cd ..
```

### 4. 启动服务

#### 方式一：分别启动（推荐用于开发）

打开两个终端窗口：

**终端 1 - 启动 Backend:**

```bash
pnpm dev:backend
```

Backend 将在 http://localhost:3000 运行

**终端 2 - 启动 Frontend:**

```bash
pnpm dev:frontend
```

Frontend 将在 http://localhost:3001 运行（Next.js 默认端口）

#### 方式二：使用并发工具（需要额外安装）

如果你安装了 `concurrently`，可以在根目录的 `package.json` 中添加：

```json
"dev": "concurrently \"pnpm dev:backend\" \"pnpm dev:frontend\""
```

然后运行：

```bash
pnpm dev
```

## 验证

- Backend: 访问 http://localhost:3000 应该看到 "Hello World!"
- Frontend: 访问 http://localhost:3001 应该看到 "App Download Page"

## 常见问题

### Prisma 迁移失败

如果 `prisma:migrate` 失败，可以尝试：

```bash
cd backend
pnpm prisma migrate dev --name init --create-only
pnpm prisma migrate deploy
```

### 端口冲突

如果 3000 或 3001 端口被占用，可以：

- Backend: 修改 `backend/.env` 中的 `PORT` 值
- Frontend: 修改 `frontend/package.json` 中的 dev 脚本为 `next dev -p 3002`
