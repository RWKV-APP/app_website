#!/bin/bash

# 一键构建+运行脚本（生产环境）
# 使用 PM2 管理进程，确保日志隔离

set -e

echo "🚀 开始构建和部署..."

# 1. 构建前端
echo "📦 构建前端..."
pnpm build:frontend

# 2. 复制前端构建产物到后端
echo "📋 复制前端构建产物到后端..."
bash scripts/deploy.sh

# 3. 初始化 Prisma 数据库
echo "🗄️  初始化数据库..."
cd backend

# 生成 Prisma Client
echo "   📦 生成 Prisma Client..."
pnpm prisma:generate

# 检查是否有迁移文件。没有迁移时，直接同步 schema，避免在生产环境创建开发迁移。
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "   📐 未检测到迁移文件，使用 prisma db push 同步 schema..."
  pnpm exec prisma db push --accept-data-loss
else
  # 如果有迁移文件，使用 deploy 应用迁移（生产环境推荐）
  echo "   🚀 应用数据库迁移..."
  pnpm prisma:migrate:deploy
fi

# 验证数据库是否已创建
if [ -f ".env" ]; then
  DB_PATH=$(grep DATABASE_URL .env | cut -d '=' -f2 | tr -d '"' | sed 's/file://')
  if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ]; then
    echo "   ✅ 数据库文件已创建: $DB_PATH"
  fi
fi

cd ..

# 4. 构建后端
echo "🔨 构建后端..."
pnpm build:backend

# 5. 确保日志目录存在
echo "📁 创建日志目录..."
mkdir -p backend/logs

# 6. 停止已存在的进程（如果存在）
echo "🛑 停止已存在的进程..."
cd backend
pm2 stop rwkv-backend 2>/dev/null || true
pm2 delete rwkv-backend 2>/dev/null || true

# 7. 使用 PM2 启动生产服务器
echo "▶️  启动生产服务器..."
pm2 start ecosystem.prod.config.js

# 8. 保存 PM2 配置
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs rwkv-backend"
echo "🔄 重启服务: pm2 restart rwkv-backend"
echo "🛑 停止服务: pm2 stop rwkv-backend"
echo ""
echo "📂 日志文件位置:"
echo "   - 输出日志: backend/logs/rwkv-backend-out.log"
echo "   - 错误日志: backend/logs/rwkv-backend-error.log"
echo ""

