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

  /**
   * 判断某条记录是否属于当前用户（user_id OR line_user_id 任一匹配即可）
   * 避免因 line_user_id 与设备 user_id 不同而漏查
   */
  function isOwned(record) {
    if (userId && (record.user_id === userId || record.line_user_id === userId)) return true;
    if (lineUserId && (record.user_id === lineUserId || record.line_user_id === lineUserId)) return true;
    return false;
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
  const now          = new Date();
  const userProducts = loadJson("user-products.json");
  const products     = loadJson("digital-products.json");

  const ownedCoupons = userProducts.filter((up) => {
    if (!isOwned(up)) return false;
    if (!["claimed", "unused"].includes(up.product_status)) return false;
    if (up.expired_at && new Date(up.expired_at) < now) return false;
    return true;
  }).map((up) => {
    const prod = products.find((p) => p.product_id === up.product_id) || {};
    return {
      product_id:   up.product_id,
      name:         pickText(prod.product_name || up.product_name, lang) || up.product_id,
      product_type: prod.product_type || "coupon",
      status:       up.product_status,
    };
  });

  /* ── 3. 活动奖品（activity-interactions.json，result_type=prize）── */
  const interactions  = loadJson("activity-interactions.json");
  const actPrizes     = loadJson("activity-prizes.json");

  const userPrizes = interactions
    .filter((ia) => isOwned(ia) && ia.result_type === "prize")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map((ia) => {
      const prize = actPrizes.find((p) => p.prize_id === ia.action_result_id) || {};
      return {
        prize_id:   ia.action_result_id || "",
        prize_name: prize.prize_name || ia.prize_name || "活动奖品",
        prize_type: prize.prize_type || "coupon",
        status:     ia.prize_status || "granted",
        created_at: ia.created_at,
      };
    });

  /* ── 4. 最优推荐（钱包券优先，其次奖品）─────────────────────────── */
  const recommended = ownedCoupons[0] || (userPrizes[0] ? { name: userPrizes[0].prize_name, product_type: userPrizes[0].prize_type, status: userPrizes[0].status } : null);

  return {
    success: true,
    tool_code: "tool-user-account",
    tool_result: {
      points:      pointsData,
      wallet: {
        coupons:   ownedCoupons.slice(0, 5),
        count:     ownedCoupons.length,
      },
      prizes: {
        items: userPrizes,
        count: userPrizes.length,
      },
      recommended_coupon: recommended,
    },
    display_payload: {
      type:  "user_account",
      title: { zh: "我的账户", th: "บัญชีของฉัน", en: "My Account" }[lang] || "我的账户",
    },
  };
}
