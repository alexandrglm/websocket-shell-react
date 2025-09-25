#!/bin/bash
set -e

echo "========================================================="
echo "🚀 Devel.run Builder & Deploy
echo "========================================================="

export NODE_ENV=production
export PORT=${PORT:-3001}
export NODE_OPTIONS="--max-old-space-size=2048"

echo "📦 Installing dependencies..."
npm install --prefer-offline --no-audit --no-fund --include=dev

echo "🧹 Cleaning previous builds..."
rm -rf dist

echo "🏗️ Building frontend with Vite..."
npm run build

echo "📁 Copying essential folders..."
# Copy public and src just in case
cp -r public dist/
cp -r src dist/src/



echo "🌐 Starting backend in background..."
# Run server in background so Render can finalize deploy
nohup node server.js &

echo "✅ Deploy script finished. Backend running in background."
echo ""
echo "========================================================="
