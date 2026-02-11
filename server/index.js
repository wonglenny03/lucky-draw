import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getOrCreateDrawState,
  saveDrawState,
  getUserByUsername,
  getDefaultState,
} from "./db.js";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "uploads");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uid = req.session?.userId;
    if (!uid) return cb(new Error("unauthorized"), null);
    const dir = path.join(UPLOADS_DIR, String(uid));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const base = path.basename(file.originalname || "image", ext).replace(/[^a-zA-Z0-9.-]/g, "_") || "image";
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!ok);
  },
});

const app = express();
const PORT = process.env.PORT || 3001;

// cors 委托写法：传入 (req, cb) 以便拿到 req.headers.host 做同 hostname 判断
app.use(
  cors((req, callback) => {
    const origin = req?.headers?.origin;
    const host = req?.headers?.host || "";
    const corsOriginEnv = process.env.CORS_ORIGIN || "";
    const allowed = corsOriginEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let result = false;
    if (allowed.length > 0) {
      if (origin && allowed.includes(origin)) result = origin;
    } else {
      // 未配置 CORS_ORIGIN 时：允许与 API 同 hostname 的任意端口（前后端同机部署）
      if (origin) {
        try {
          const apiHost = host.split(":")[0].replace(/^\[|\]$/g, "");
          const originHost = new URL(origin).hostname.replace(/^\[|\]$/g, "");
          if (apiHost && originHost && apiHost === originHost) result = origin;
        } catch (_) {}
      }
      if (result === false && process.env.NODE_ENV !== "production")
        result = "http://localhost:3000";
    }
    if (origin) {
      console.log(
        "[CORS] origin=%s host=%s CORS_ORIGIN=%s allowed=%s result=%s",
        origin,
        host,
        corsOriginEnv || "(empty)",
        allowed.length ? allowed.join(",") : "(same-host)",
        result === false ? "deny" : result
      );
    }
    callback(null, { origin: result, credentials: true });
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "luck-draw-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // 不设置 maxAge，使用 session cookie（关闭浏览器后失效）；若需长期有效可设极大值如 10 年
      sameSite: "lax",
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
    return;
  }
  res.status(401).json({ error: "未登录" });
}

// 登录
app.post("/api/login", (req, res) => {
  const raw = req.body || {};
  const username = typeof raw.username === "string" ? raw.username.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  console.log(username, password);
  if (!username || !password) {
    return res.status(400).json({ error: "请输入用户名和密码" });
  }
  const user = getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true, username: user.username });
});

// 登出
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

// 当前用户
app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "未登录" });
  }
  res.json({ userId: req.session.userId, username: req.session.username });
});

// 图片静态访问（按用户目录）
app.use("/api/uploads", express.static(UPLOADS_DIR));

// 图片上传（登录后，按用户存到 uploads/userId/）
app.post("/api/upload", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "图片大小不能超过 5MB" });
      if (err.message === "unauthorized") return res.status(401).json({ error: "未登录" });
      return res.status(400).json({ error: "仅支持 JPG/PNG/GIF/WebP 图片" });
    }
    if (!req.file) return res.status(400).json({ error: "请选择图片文件" });
    const url = `/api/uploads/${req.session.userId}/${req.file.filename}`;
    res.json({ url });
  });
});

// 获取当前用户的抽奖状态（含奖项配置，按用户存库）
app.get("/api/draw-state", requireAuth, (req, res) => {
  const state = getOrCreateDrawState(req.session.userId);
  res.json(state);
});

// 获取默认配置（服务端定义的默认奖项与人员，供“恢复默认”使用）
app.get("/api/default-config", requireAuth, (req, res) => {
  res.json(getDefaultState());
});

// 恢复为默认配置：奖项、人员等全部重置为默认，中奖记录清空
app.post("/api/draw-reset-to-default", requireAuth, (req, res) => {
  const defaultState = getDefaultState();
  saveDrawState(req.session.userId, defaultState);
  res.json(defaultState);
});

// 保存抽奖状态（设置、重置等）
app.put("/api/draw-state", requireAuth, (req, res) => {
  const state = req.body;
  if (!state || typeof state !== "object") {
    return res.status(400).json({ error: "无效的状态数据" });
  }
  saveDrawState(req.session.userId, state);
  res.json({ ok: true });
});

// 洗牌（Fisher-Yates），服务端随机抽奖用
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 执行一次抽奖（服务端随机选出中奖者并更新状态）
app.post("/api/draw", requireAuth, (req, res) => {
  const { currentPrizeId, isExtraMode } = req.body || {};
  if (!currentPrizeId) {
    return res.status(400).json({ error: "参数错误" });
  }
  let state = getOrCreateDrawState(req.session.userId);
  const activePrizes = state.isExtraMode ? state.extraPrizes : state.prizes;
  const currentPrize = activePrizes.find((p) => p.id === currentPrizeId);
  if (!currentPrize) {
    return res.status(400).json({ error: "奖项不存在" });
  }
  const pool = state.isExtraMode ? state.allParticipants : state.participants;
  const countToDraw = Math.min(currentPrize.remaining, pool.length);
  if (countToDraw <= 0) {
    return res.status(400).json({ error: "该奖项无可抽名额或候选池为空" });
  }
  const shuffled = shuffle(pool);
  const selectedParticipants = shuffled.slice(0, countToDraw);
  const drawTime = new Date().toLocaleTimeString();
  const prizeSnapshot = { ...currentPrize };
  const newWinners = selectedParticipants.map((p) => ({
    participant: p,
    prize: prizeSnapshot,
    drawTime,
    isExtra: !!state.isExtraMode,
  }));

  const updatePrizeList = (list) =>
    list.map((p) =>
      p.id === currentPrizeId
        ? { ...p, remaining: p.remaining - selectedParticipants.length }
        : p
    );
  const winnerIds = selectedParticipants.map((p) => p.id);

  state = {
    ...state,
    winners: [...newWinners, ...state.winners],
    prizes: state.isExtraMode ? state.prizes : updatePrizeList(state.prizes),
    extraPrizes: state.isExtraMode ? updatePrizeList(state.extraPrizes) : state.extraPrizes,
    participants: state.isExtraMode
      ? state.participants
      : state.participants.filter((p) => !winnerIds.includes(p.id)),
  };
  saveDrawState(req.session.userId, state);
  res.json({ winners: newWinners, state });
});

// 重置抽奖
app.post("/api/draw-reset", requireAuth, (req, res) => {
  let state = getOrCreateDrawState(req.session.userId);
  const resetPrizes = state.prizes.map((p) => ({ ...p, remaining: p.count }));
  const resetExtraPrizes = state.extraPrizes.map((p) => ({ ...p, remaining: p.count }));
  const targetPrizes = state.isExtraMode ? resetExtraPrizes : resetPrizes;
  state = {
    ...state,
    winners: [],
    prizes: resetPrizes,
    extraPrizes: resetExtraPrizes,
    participants: [...state.allParticipants],
    currentPrizeId: targetPrizes[0]?.id ?? null,
  };
  saveDrawState(req.session.userId, state);
  res.json(state);
});

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Luck Draw API http://${HOST}:${PORT}`);
});
