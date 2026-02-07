import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "luck_draw.db");

// 确保目录存在
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draw_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

const SEED_PASSWORD = "qwer1234";

function ensureSeedUsers() {
  const hash = bcrypt.hashSync(SEED_PASSWORD, 10);
  for (const name of ["fenix", "test1", "test2", "test3", "test4", "test5", "test6", "test7", "test8", "test9", "test10"]) {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(name);
    if (!existing) {
      db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(name, hash);
    } else {
      // 已存在也更新密码，保证默认账号密码一定是 qwer1234
      db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, name);
    }
  }
}

/** 初始化数据库：建表 + 种子用户，启动时或单独运行 init-db.js 时调用 */
function initDb() {
  initSchema();
  ensureSeedUsers();
}

initDb();

// 默认奖项（与前端 INITIAL_PRIZES 一致）
const DEFAULT_PRIZES = [
  { id: "p1", name: "一等奖 (iPhone 16 Pro Max)", rank: 1, count: 1, remaining: 1, image: "https://picsum.photos/seed/iphone/400/400" },
  { id: "p2", name: "二等奖 (iPad Air)", rank: 2, count: 3, remaining: 3, image: "https://picsum.photos/seed/ipad/400/400" },
  { id: "p3", name: "三等奖 (AirPods Pro)", rank: 3, count: 5, remaining: 5, image: "https://picsum.photos/seed/airpods/400/400" },
  { id: "p4", name: "参与奖 (幸运礼盒)", rank: 4, count: 10, remaining: 10, image: "https://picsum.photos/seed/box/400/400" },
];

const DEFAULT_PARTICIPANTS = Array.from({ length: 60 }, (_, i) => ({
  id: `user-${i}`,
  name: `员工 ${i + 1}`,
  avatar: `https://picsum.photos/seed/user${i}/100/100`,
}));

function getDefaultState() {
  return {
    participants: [...DEFAULT_PARTICIPANTS],
    allParticipants: [...DEFAULT_PARTICIPANTS],
    prizes: DEFAULT_PRIZES.map((p) => ({ ...p })),
    extraPrizes: [],
    winners: [],
    currentPrizeId: DEFAULT_PRIZES[0].id,
    isExtraMode: false,
    extraModeEnabled: false,
    backgroundImage: undefined,
    backgroundMusic: undefined,
    drawMusic: undefined,
    winnerSound: undefined,
  };
}

function getOrCreateDrawState(userId) {
  let row = db.prepare("SELECT state_json FROM draw_state WHERE user_id = ?").get(userId);
  if (!row) {
    const defaultState = getDefaultState();
    db.prepare("INSERT INTO draw_state (user_id, state_json) VALUES (?, ?)").run(
      userId,
      JSON.stringify(defaultState)
    );
    return defaultState;
  }
  return JSON.parse(row.state_json);
}

function saveDrawState(userId, state) {
  const stateJson = JSON.stringify(state);
  db.prepare(
    "INSERT INTO draw_state (user_id, state_json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = datetime('now')"
  ).run(userId, stateJson);
}

function getUserByUsername(username) {
  return db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(username);
}

export { db, initDb, getOrCreateDrawState, saveDrawState, getUserByUsername, ensureSeedUsers, getDefaultState };
