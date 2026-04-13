/**
 * tool-points-query.js
 * 查积分余额 — 直接查 points_accounts，与个人中心数据一致
 */

import { query } from "../../db/pool.js";

export async function execute(slots = {}, identity = {}) {
  const userId = identity.user_id || identity.line_user_id || "";

  if (!userId) {
    return {
      success: false,
      tool_code: "tool-points-query",
      error_message: "无法识别用户身份，无法查询积分。",
    };
  }

  try {
    // UPSERT：首次访问自动初始化账户（与个人中心 /growth/user/points/summary 逻辑一致）
    const result = await query(
      `INSERT INTO points_accounts
         (user_id, line_user_id, total_points, available_points, pending_points,
          consumed_points, revoked_points, updated_at)
       VALUES ($1, $2, 0, 0, 0, 0, 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = points_accounts.updated_at
       RETURNING *`,
      [userId, userId]
    );

    const row = result.rows[0] || {};

    return {
      success: true,
      tool_code: "tool-points-query",
      tool_result: {
        available_points: Number(row.available_points || 0),
        total_points:     Number(row.total_points     || 0),
        pending_points:   Number(row.pending_points   || 0),
        data_source:      "db",
      },
      display_payload: { type: "points_card", title: "我的积分" },
    };
  } catch (err) {
    console.error("[tool-points-query] DB error:", err.message);
    return {
      success: false,
      tool_code: "tool-points-query",
      error_message: "积分查询暂时不可用，请稍后再试。",
    };
  }
}
