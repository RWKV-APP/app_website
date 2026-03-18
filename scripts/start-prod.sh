#!/bin/bash

# 一键构建并发布当前仓库到线上
# 真实拓扑: nginx 直接托管 frontend/out, PM2 管理 backend/dist/main.js

set -euo pipefail

echo "🚀 开始构建和部署..."

# 1. 构建前端
echo "📦 构建前端..."
APP_BUILD_SOURCE=deploy:prod pnpm --filter frontend build

# 2. 确认前端静态产物已生成
echo "📁 检查前端静态产物..."
if [ ! -d "frontend/out" ]; then
  echo "❌ Error: frontend/out 目录不存在，前端构建失败"
  exit 1
fi
echo "   ✅ frontend/out 已生成，nginx 会直接读取该目录"

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
pnpm --filter backend build

# 5. 确保日志目录存在
echo "📁 创建日志目录..."
mkdir -p backend/logs

# 6. 重启或启动 PM2 进程
echo "🔄 重新加载 PM2 进程..."
cd backend
if pm2 describe rwkv-backend >/dev/null 2>&1; then
  pm2 restart ecosystem.prod.config.js --only rwkv-backend --update-env
else
  pm2 start ecosystem.prod.config.js --only rwkv-backend
fi

# 7. 保存 PM2 配置
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 前端静态目录: frontend/out"
echo "🔌 后端服务端口: 3462"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs rwkv-backend"
echo "🔄 重启服务: pm2 restart rwkv-backend"
echo "🛑 停止服务: pm2 stop rwkv-backend"
echo ""
echo "📂 日志文件位置:"
echo "   - 输出日志: backend/logs/rwkv-backend-out*.log"
echo "   - 错误日志: backend/logs/rwkv-backend-error*.log"
echo ""
