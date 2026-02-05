#!/usr/bin/env bash
# 一键安装依赖、构建并用 PM2 启动抽奖应用（端口 1168）
# 使用: chmod +x pm2-start.sh && ./pm2-start.sh

set -e
cd "$(dirname "$0")"

echo ">>> 安装依赖..."
npm install

echo ">>> 构建生产包..."
npm run build

if pm2 describe lucky-draw &>/dev/null; then
  echo ">>> 应用已在 PM2 中，执行重启..."
  pm2 restart lucky-draw
else
  echo ">>> 使用 PM2 启动..."
  pm2 start ecosystem.config.cjs
fi

echo ""
echo ">>> 完成。应用已运行在 http://localhost:1168"
echo ">>> 查看状态: pm2 list"
echo ">>> 查看日志: pm2 logs lucky-draw"
