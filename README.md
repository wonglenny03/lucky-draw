# 年会抽奖 Lucky Draw

年会/活动抽奖 Web 应用，支持奖项配置、人员名单、背景音乐与音效、全屏背景图等。

## 本地开发

**环境要求：** Node.js

1. 安装依赖：`npm install`
2. 如需 Gemini 相关功能，在 [.env.local](.env.local) 中配置 `GEMINI_API_KEY`
3. 启动开发服务器：`npm run dev`

## 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可用任意静态服务器托管。

## 使用 PM2 在服务器运行

在服务器上以后台进程方式运行，使用 PM2 管理。

### 方式一：一键脚本（推荐）

项目提供 `pm2-start.sh`，自动完成「安装依赖 → 构建 → PM2 启动/重启」。

**前置条件：** 已安装 Node.js 和 PM2（`npm install -g pm2`）

在项目根目录执行：

```bash
chmod +x pm2-start.sh
./pm2-start.sh
```

- 每次运行都会依次执行：`npm install` → `npm run build` → PM2 启动或重启。
- 若应用已在 PM2 中运行，会执行 `pm2 restart lucky-draw`；否则执行 `pm2 start ecosystem.config.cjs`。

启动成功后，访问 **http://localhost:1168**（或服务器 IP:1168）。

### 方式二：手动分步执行

#### 1. 安装 PM2（若未安装）

```bash
npm install -g pm2
```

#### 2. 安装依赖并构建

```bash
npm install
npm run build
```

#### 3. 使用 PM2 启动

项目已包含 PM2 配置文件 `ecosystem.config.cjs`，在项目根目录执行：

```bash
pm2 start ecosystem.config.cjs
```

应用将监听 **1168** 端口。如需修改端口，可编辑 `ecosystem.config.cjs` 中 `args` 的 `-l 1168`。

### 常用 PM2 命令

| 命令 | 说明 |
|------|------|
| `pm2 list` | 查看进程列表 |
| `pm2 logs lucky-draw` | 查看日志 |
| `pm2 restart lucky-draw` | 重启应用 |
| `pm2 stop lucky-draw` | 停止应用 |
| `pm2 delete lucky-draw` | 从 PM2 中移除 |

### 开机自启（可选）

```bash
pm2 startup   # 按提示执行生成的命令
pm2 save      # 保存当前进程列表
```

重新部署时：可再次执行 `./pm2-start.sh`（会先构建再重启），或先 `npm run build`，再 `pm2 restart lucky-draw`。
