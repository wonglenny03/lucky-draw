# 年会抽奖 Lucky Draw

年会/活动抽奖 Web 应用，支持奖项配置、人员名单、背景音乐与音效、全屏背景图等。抽奖数据存放在 Node 服务与 SQLite 数据库中，需登录后进入抽奖页，不同用户使用各自的数据。

## 登录账号（默认）

| 用户名 | 密码 |
|--------|------|
| fenix  | qwer1234 |
| fenix2 | qwer1234 |

## 本地开发

**环境要求：** Node.js

### 一键开发（推荐）

```bash
chmod +x dev.sh
./dev.sh
```

会同时启动后端 API（3001）和前端 Vite（3000），前端会代理 `/api` 到 3001。按 Ctrl+C 停止前后端。

### 分步启动

1. 安装依赖：`npm install`，后端：`cd server && npm install`
2. 初始化数据库（建表 + 默认用户）：`cd server && npm run db:init`（首次或清空后执行）
3. 启动后端：`npm run dev:server`（端口 **3001**）
4. 启动前端：`npm run dev`（端口 **3000**）
5. 打开 http://localhost:3000，使用上表账号登录后即可抽奖

**说明**：`./dev.sh` 与 `./pm2-start.sh` 会自动执行数据库初始化；单独启动服务时，首次需先执行一次 `npm run db:init`（数据库文件为 `server/luck_draw.db`）。

**查看数据库**：在 `server` 目录执行 `npm run db:view` 可查看用户列表和抽奖状态摘要；或使用系统自带的 `sqlite3 server/luck_draw.db` 执行任意 SQL（如 `SELECT * FROM users;`）。

## 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可用任意静态服务器托管。

## 使用 PM2 在服务器运行

在服务器上以后台进程方式运行，使用 PM2 管理。

### 方式一：一键脚本（推荐）

项目提供 `pm2-start.sh`，自动完成「安装前后端依赖 → 构建前端 → PM2 启动/重启前端 + 后端 API」。

**前置条件：** 已安装 Node.js 和 PM2（`npm install -g pm2`）

在项目根目录执行：

```bash
chmod +x pm2-start.sh
./pm2-start.sh
```

- 会依次执行：前端 `npm install` → 后端 `cd server && npm install` → 数据库初始化 → `npm run build`（可设置 `VITE_API_URL`）→ PM2 启动或重启 **lucky-draw-api**（1167）和 **lucky-draw**（1168）。
- 若两个应用已在 PM2 中，会执行 `pm2 restart lucky-draw-api lucky-draw`；否则执行 `pm2 start ecosystem.config.cjs`。

**可选环境变量：**

| 变量 | 说明 | 默认 |
|------|------|------|
| `VITE_API_URL` | 前端请求的 API 地址（构建时写入） | `http://localhost:1167` |
| `API_PORT` | 后端 API 监听端口（生产） | `1167` |
| `FRONTEND_PORT` | 前端静态服务端口（生产） | `1168` |

部署到公网服务器时，建议先设置 `VITE_API_URL` 为实际 API 地址再执行脚本，例如：

```bash
VITE_API_URL=http://你的域名:1167 ./pm2-start.sh
```

启动成功后：
- **前端：** http://localhost:1168（或服务器 IP:1168）
- **后端 API：** http://localhost:1167

### 方式二：手动分步执行

#### 1. 安装 PM2（若未安装）

```bash
npm install -g pm2
```

#### 2. 安装依赖并构建

```bash
npm install
cd server && npm install && cd ..
VITE_API_URL=http://localhost:1167 npm run build   # 或你的 API 地址
```

#### 3. 使用 PM2 启动

项目已包含 PM2 配置文件 `ecosystem.config.cjs`（含 **lucky-draw-api** 与 **lucky-draw** 两个应用），在项目根目录执行：

```bash
pm2 start ecosystem.config.cjs
```

- 前端监听 **1168** 端口（可通过环境变量 `FRONTEND_PORT` 修改）
- 后端 API 监听 **1167** 端口（可通过环境变量 `API_PORT` 修改）

### 常用 PM2 命令

| 命令 | 说明 |
|------|------|
| `pm2 list` | 查看进程列表 |
| `pm2 logs` | 查看所有应用日志 |
| `pm2 logs lucky-draw-api` / `pm2 logs lucky-draw` | 查看指定应用日志 |
| `pm2 restart lucky-draw-api lucky-draw` | 重启前后端 |
| `pm2 stop lucky-draw-api lucky-draw` | 停止应用 |
| `pm2 delete lucky-draw-api lucky-draw` | 从 PM2 中移除 |

### 开机自启（可选）

```bash
pm2 startup   # 按提示执行生成的命令
pm2 save      # 保存当前进程列表
```

重新部署时：可再次执行 `./pm2-start.sh`（会先构建再重启），或先 `npm run build`，再 `pm2 restart lucky-draw`。
