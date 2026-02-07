#!/usr/bin/env node
/**
 * 查看数据库数据（用户列表 + 各用户抽奖状态摘要）
 * 使用: node server/view-db.js  或  npm run db:view
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "luck_draw.db");
const db = new Database(dbPath, { readonly: true });

console.log("========== users ==========");
const users = db.prepare("SELECT id, username, created_at FROM users ORDER BY id").all();
if (users.length === 0) {
  console.log("(无用户)");
} else {
  console.table(users);
}

console.log("\n========== draw_state 摘要 ==========");
const states = db.prepare("SELECT user_id, updated_at, length(state_json) AS state_size FROM draw_state ORDER BY user_id").all();
if (states.length === 0) {
  console.log("(无抽奖状态，登录后首次进入抽奖页会自动创建)");
} else {
  const rows = states.map((row) => {
    const state = db.prepare("SELECT state_json FROM draw_state WHERE user_id = ?").get(row.user_id);
    let info = "-";
    if (state) {
      try {
        const data = JSON.parse(state.state_json);
        const winners = data.winners?.length ?? 0;
        const prizes = data.prizes?.length ?? 0;
        info = `奖项 ${prizes} 个，已中奖 ${winners} 条`;
      } catch (e) {
        info = "(解析失败)";
      }
    }
    const username = users.find((u) => u.id === row.user_id)?.username ?? row.user_id;
    return { user_id: row.user_id, username, updated_at: row.updated_at, 摘要: info };
  });
  console.table(rows);
}

db.close();
console.log("\n提示: 使用 sqlite3 可执行任意 SQL，例如:");
console.log("  sqlite3 server/luck_draw.db");
console.log("  .tables          # 列出表");
console.log("  SELECT * FROM users;");
console.log("  SELECT user_id, updated_at FROM draw_state;");
