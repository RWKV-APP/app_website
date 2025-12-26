#!/bin/bash

# Deployment script: Build frontend and copy to backend

set -e

echo "🚀 Starting deployment..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
pnpm build
cd ..

# Copy frontend build output to backend/public
echo "📋 Copying frontend build to backend/public..."
rm -rf backend/public
mkdir -p backend/public
cp -r frontend/out/* backend/public/

echo "✅ Deployment complete!"
echo "   Frontend build output is now in backend/public"
echo "   You can now build and start the backend server"

