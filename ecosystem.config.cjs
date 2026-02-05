/**
 * PM2 进程配置文件
 * 用于在服务器上以生产模式运行抽奖应用
 *
 * 使用前请先执行: npm run build
 * 启动: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'lucky-draw',
      script: 'npx',
      args: 'serve -s dist -l 1168',
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
