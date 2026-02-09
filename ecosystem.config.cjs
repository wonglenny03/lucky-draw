/**
 * PM2 进程配置文件（生产环境）
 * 前端静态: 1168，后端 API: 1167
 *
 * 一键部署: ./pm2-start.sh
 */

const path = require('path');

const API_PORT = process.env.API_PORT || 1167;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 1168;

module.exports = {
  apps: [
    {
      name: 'lucky-draw-api',
      script: path.join(__dirname, 'server', 'index.js'),
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: API_PORT,
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://16.162.3.49:1168',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
    },
    {
      name: 'lucky-draw',
      script: 'npx',
      args: `serve -s dist -l ${FRONTEND_PORT}`,
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
    },
  ],
};
