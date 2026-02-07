#!/usr/bin/env node
/**
 * 单独初始化数据库：建表 + 种子用户（fenix / "test1", "test2", "test3", "test4", "test5", "test6", "test7", "test8", "test9", "test10", 密码 qwer1234）
 * 使用: node server/init-db.js  或  npm run db:init
 */
import "./db.js";

console.log("数据库已初始化：表已创建，默认用户 已就绪。");
process.exit(0);
