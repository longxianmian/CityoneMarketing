/**
 * tool-user-account.js
 *
 * 【用户私有数据层 - User Account Layer】
 *
 * 一次调用返回用户的完整账户状态：
 *   - 积分余额（真实 DB）
 *   - 已领到的钱包券（user_coupons + coupons，和个人中心同源）
 *
 * 覆盖原 tool-points-query + tool-coupon-list + tool-coupon-recommend（三个合并为一）
 */

import { query as dbQuery } from "../../db/pool.js";

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

  /* ── 2. 钱包券（DB，和个人中心 user_coupons 同源）────────────────── */
  let ownedCoupons = [];
  try {
    const res = await dbQuery(
      `SELECT
         uc.id            AS user_product_id,
         uc.coupon_id     AS product_id,
         c.name           AS product_name,
         c.coupon_type    AS product_type,
         c.discount_type,
         c.discount_value,
         c.valid_to       AS expire_at,
         uc.product_status
       FROM user_coupons uc
       LEFT JOIN coupons c ON c.id = uc.coupon_id
       WHERE (uc.user_id = $1 OR uc.line_user_id = $1 OR uc.user_id = $2 OR uc.line_user_id = $2)
         AND uc.product_status = 'claimed'
       ORDER BY uc.claimed_at DESC NULLS LAST
       LIMIT 20`,
      [userId, lineUserId || userId]
    );

    function buildBenefitText(discountType, discountValue) {
      const val = Number(discountValue || 0);
      if (discountType === "percentage_off") return val ? `${val}% off` : "";
      if (discountType === "free_minutes" || discountType === "free_time") return val ? `免费充电 ${val} 分钟` : "";
      if (discountType === "fixed_off") return val ? `减 ฿${val}` : "";
      if (discountType === "free_order") return val ? `免费商品 (价值 ฿${val})` : "";
      return "";
    }

    ownedCoupons = (res.rows || []).map((row) => ({
      user_product_id: row.user_product_id,
      product_id: row.product_id,
      product_name: pickText(row.product_name, lang) || row.product_id || "权益卡券",
      name: pickText(row.product_name, lang) || row.product_id || "权益卡券",
      product_type: row.product_type || "coupon",
      status: row.product_status || "claimed",
      expire_at: row.expire_at ? new Date(row.expire_at).toISOString() : "",
      short_benefit_text: buildBenefitText(row.discount_type, row.discount_value),
    }));
  } catch (err) {
    console.error("[tool-user-account] coupon DB error:", err.message);
  }

  /* ── 3. 活动奖品（当前先不混入“我的卡券”口径）────────────────────── */
  const userPrizes = [];

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
