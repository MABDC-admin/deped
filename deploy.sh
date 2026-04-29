#!/bin/bash
# DepEd SMS - One-command deployment
# Usage: ./deploy.sh

set -e
echo "🚀 DepEd SMS Deployment Starting..."
echo "=================================="

cd /root/sms-app

echo "📦 Installing dependencies..."
npm install --production=false 2>&1 | tail -3

echo ""
echo "🔨 Building production bundle..."
npm run build 2>&1 | tail -10

echo ""
echo "🔄 Reloading Nginx..."
nginx -t && nginx -s reload

echo ""
echo "✅ Deployment complete!"
echo "📊 Build stats:"
ls -lh dist/assets/
echo ""
echo "🌐 App live at: http://204.168.164.242:3000"
