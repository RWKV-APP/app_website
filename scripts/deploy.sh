#!/bin/bash

# Deployment script: Copy frontend build output to backend
# Note: Frontend should be built before running this script

set -e

echo "🚀 Starting deployment..."

# Copy frontend build output to backend/public
echo "📋 Copying frontend build to backend/public..."
if [ ! -d "frontend/out" ]; then
  echo "❌ Error: frontend/out directory not found!"
  echo "   Please run 'pnpm build:frontend' first."
  exit 1
fi

rm -rf backend/public
mkdir -p backend/public
cp -r frontend/out/* backend/public/

echo "✅ Deployment complete!"
echo "   Frontend build output is now in backend/public"
echo "   You can now build and start the backend server"

