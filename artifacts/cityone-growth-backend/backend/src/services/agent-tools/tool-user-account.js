/**
 * tool-user-account.js
 *
 * 【用户私有数据层 - User Account Layer】
 *
 * 一次调用返回用户的完整账户状态：
 *   - 积分余额（真实 DB）
 *   - 已领到的钱包券（user-products.json）
 *
 * 覆盖原 tool-points-query + tool-coupon-list + tool-coupon-recommend（三个合并为一）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query as dbQuery } from "../../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

function loadJson(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return [];
  try {
    const p = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function pickText(v, lang = "zh") {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.zh || v.en || "";
}

export async function execute(slots = {}, identity = {}) {
  const userId     = identity.user_id     || identity.line_user_id || "";
  const lineUserId = identity.line_user_id || "";
  const lang       = identity.language    || "zh";

  if (!userId) {
    return {
      success: false,
      tool_code: "tool-user-account",
      error_message: "无法识别用户身份，请先关注公众号。",
    };
  }

  /* ── 1. 积分余额（DB，UPSERT 初始化）──────────────────────────────── */
  let pointsData = { available_points: 0, total_points: 0, pending_points: 0 };
  try {
    const res = await dbQuery(
      `INSERT INTO points_accounts
         (user_id, line_user_id, total_points, available_points, pending_points,
          consumed_points, revoked_points, updated_at)
       VALUES ($1, $2, 0, 0, 0, 0, 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = points_accounts.updated_at
       RETURNING available_points, total_points, pending_points`,
      [userId, lineUserId || userId]
    );
    const row = res.rows[0] || {};
    pointsData = {
      available_points: Number(row.available_points || 0),
      total_points:     Number(row.total_points     || 0),
      pending_points:   Number(row.pending_points   || 0),
    };
  } catch (err) {
    console.error("[tool-user-account] DB error:", err.message);
  }

  /* ── 2. 钱包券（user-products.json，当前可用的）──────────────────── */
  const now         = new Date();
  const userProducts = loadJson("user-products.json");
  const products    = loadJson("digital-products.json");

  const ownedCoupons = userProducts.filter((up) => {
    if (lineUserId && up.line_user_id !== lineUserId) return false;
    if (!lineUserId && userId && up.user_id !== userId) return false;
    if (!["claimed", "unused"].includes(up.product_status)) return false;
    if (up.expired_at && new Date(up.expired_at) < now) return false;
    return true;
  }).map((up) => {
    const prod = products.find((p) => p.product_id === up.product_id) || {};
    return {
      product_id:   up.product_id,
      name:         pickText(prod.product_name, lang) || up.product_id,
      product_type: prod.product_type || "",
      status:       up.product_status,
    };
  });

  /* ── 3. 最优推荐券（可用券里第一张）──────────────────────────────── */
  const recommended = ownedCoupons[0] || null;

  return {
    success: true,
    tool_code: "tool-user-account",
    tool_result: {
      points:      pointsData,
      wallet: {
        coupons:   ownedCoupons.slice(0, 5),
        count:     ownedCoupons.length,
      },
      recommended_coupon: recommended,
    },
    display_payload: {
      type:  "user_account",
      title: { zh: "我的账户", th: "บัญชีของฉัน", en: "My Account" }[lang] || "我的账户",
    },
  };
}
