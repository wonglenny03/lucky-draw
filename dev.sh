#!/usr/bin/env bash
# 一键开发：同时启动后端 API（3001）和前端 Vite（3000）
# 使用: chmod +x dev.sh && ./dev.sh
#
# 前端访问 http://localhost:3000（/api 会代理到 3001）

set -e
cd "$(dirname "$0")"

cleanup() {
  echo ""
  echo ">>> 正在停止后端..."
  kill "$API_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ">>> 检查后端依赖..."
(cd server && npm install --silent 2>/dev/null || npm install)

echo ">>> 初始化数据库（建表 + 种子用户）..."
(cd server && npm run db:init --silent 2>/dev/null || npm run db:init)

echo ">>> 启动后端 API (http://localhost:3001)..."
(cd server && node index.js) &
API_PID=$!

sleep 1
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo ">>> 后端启动失败"
  exit 1
fi

echo ">>> 启动前端 (http://localhost:3000)..."
echo ">>> 按 Ctrl+C 停止前后端"
echo ""
npm run dev
