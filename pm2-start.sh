#!/usr/bin/env bash
# 生产环境一键部署：安装依赖、构建、初始化数据库，并用 PM2 启动
# 前端端口 1168，后端 API 端口 1167
#
# 使用: chmod +x pm2-start.sh && ./pm2-start.sh
#
# 公网 API 地址（构建时写入前端）
PUBLIC_API_BASE="${PUBLIC_API_BASE:-http://10.180.4.176:1167}"
#
# 环境变量（可选）:
#   API_PORT         - 后端 API 端口，默认 1167
#   FRONTEND_PORT    - 前端静态服务端口，默认 1168
#   VITE_API_URL     - 前端请求的 API 地址（构建时写入），默认使用 PUBLIC_API_BASE
#   PUBLIC_API_BASE  - 公网 API 根地址，默认 http://10.180.4.176:1167

set -e
cd "$(dirname "$0")"

API_PORT="${API_PORT:-1167}"
FRONTEND_PORT="${FRONTEND_PORT:-1168}"
export VITE_API_URL="${VITE_API_URL:-${PUBLIC_API_BASE}}"

echo ">>> 安装前端依赖（清理后重装，避免 Rollup 可选原生依赖未安装）..."
rm -rf node_modules package-lock.json
npm install

echo ">>> 安装后端依赖..."
(cd server && npm install)

echo ">>> 初始化数据库（建表 + 种子用户）..."
(cd server && npm run db:init)

echo ">>> 构建生产包（API: ${VITE_API_URL}）..."
npm run build

echo ">>> 使用 PM2 启动（API: ${API_PORT}，前端: ${FRONTEND_PORT}）..."
export API_PORT
export FRONTEND_PORT
if pm2 describe lucky-draw-api &>/dev/null && pm2 describe lucky-draw &>/dev/null; then
  echo ">>> 应用已在 PM2 中，执行重启..."
  pm2 restart lucky-draw-api lucky-draw
else
  pm2 start ecosystem.config.cjs
fi

echo ""
echo ">>> 部署完成。"
echo ">>> 前端: http://localhost:${FRONTEND_PORT}"
echo ">>> 后端 API: http://localhost:${API_PORT}"
echo ">>> 查看状态: pm2 list"
echo ">>> 查看日志: pm2 logs"
