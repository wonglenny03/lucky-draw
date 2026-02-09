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

- 会依次执行：前端依赖安装（会先清理 `node_modules` 与 `package-lock.json` 再安装，避免 Linux 上 Rollup 原生依赖缺失）→ 后端 `cd server && npm install` → 数据库初始化 → `npm run build`（可设置 `VITE_API_URL`）→ PM2 启动或重启 **lucky-draw-api**（1167）和 **lucky-draw**（1168）。
- 若两个应用已在 PM2 中，会执行 `pm2 restart lucky-draw-api lucky-draw`；否则执行 `pm2 start ecosystem.config.cjs`。

**可选环境变量：**

| 变量 | 说明 | 默认 |
|------|------|------|
| `VITE_API_URL` | 前端请求的 API 地址（构建时写入） | 脚本默认 `http://16.162.3.49:1167`，可设 `PUBLIC_API_BASE` 覆盖 |
| `API_PORT` | 后端 API 监听端口（生产） | `1167` |
| `FRONTEND_PORT` | 前端静态服务端口（生产） | `1168` |
| `CORS_ORIGIN` | 允许的前端来源（CORS），需与浏览器地址栏一致（含端口，如 `http://IP:1168`）；多个用逗号分隔。不设时自动允许与 API 同 hostname 的任意端口 | 同机部署可不设 |

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

### 故障排除：Linux 上构建报错 `Cannot find module @rollup/rollup-linux-x64-gnu`

这是 npm 对可选依赖的已知问题：若项目在 Mac/Windows 上安装过依赖，在 Linux（如 EC2）上直接 `npm run build` 可能缺少 Rollup 的 Linux 原生包。处理方式：

- **用一键脚本部署**：`./pm2-start.sh` 已改为在安装前端依赖前清理 `node_modules` 与 `package-lock.json`，再执行 `npm install`，可避免该问题。
- **手动构建**：在服务器项目根目录执行 `rm -rf node_modules package-lock.json && npm install`，再执行 `npm run build`。

### 故障排除：访问接口超时

后端 API 默认监听 `0.0.0.0`（接受所有网卡请求）。若仍超时，请检查：

1. **防火墙 / 安全组**：确保 API 端口（默认 1167）对访问方开放。例如 EC2 安全组需添加入站规则放行 TCP 1167。
2. **前端请求地址**：构建时设置的 `VITE_API_URL` 必须是浏览器能访问到的地址（例如公网 IP 或域名 + 端口）。若写成了内网地址或 localhost，浏览器会连不上或超时。
3. **API 进程是否存活**：在服务器上执行 `pm2 list` 和 `pm2 logs lucky-draw-api`，确认 API 进程在运行且无报错。

### 故障排除：浏览器报 CORS 错误

前端与 API 不同源（不同域名或端口）时，后端会校验请求的 `Origin`。默认会**自动允许与 API 同 hostname 的任意端口**（例如前端 `http://服务器IP:1168`、API `http://服务器IP:1167` 可正常访问，**此时无需设置 CORS_ORIGIN**）。若前端通过其他域名访问（如 CDN、反向代理后的域名），需在启动 API 时设置 `CORS_ORIGIN` 为前端访问地址（必须与浏览器地址栏一致，含端口），多个用逗号分隔，例如：

```bash
CORS_ORIGIN=https://your-frontend-domain.com pm2 start ecosystem.config.cjs
# 若前端是 http://公网IP:1168，则：export CORS_ORIGIN=http://16.162.3.49:1168
# 或在 pm2-start.sh 前：export CORS_ORIGIN=https://your-frontend-domain.com
```
