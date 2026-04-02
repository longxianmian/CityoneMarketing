/**
 * agent-tool-router.js
 *
 * 将通过权限校验的意图，路由到对应工具并执行。
 */

import { execute as nearBySites } from "./agent-tools/tool-nearby-sites.js";
import { execute as couponList } from "./agent-tools/tool-coupon-list.js";
import { execute as couponRecommend } from "./agent-tools/tool-coupon-recommend.js";
import { execute as claimBenefits } from "./agent-tools/tool-claim-benefits.js";
import { execute as invitePoster } from "./agent-tools/tool-invite-poster.js";
import { execute as orderQuery } from "./agent-tools/tool-order-query.js";
import { execute as pointsQuery } from "./agent-tools/tool-points-query.js";

// 意图 → 工具映射
const TOOL_MAP = {
  nearby_sites_query: nearBySites,
  coupon_list_query: couponList,
  coupon_recommend: couponRecommend,
  benefit_claim_query: claimBenefits,
  invite_poster_generate: invitePoster,
  recent_orders_query: orderQuery,
  points_balance_query: pointsQuery
};

// 纯信息类意图，不需要工具
const INFO_ONLY_INTENTS = new Set([
  "borrow_help", "return_help", "invite_help", "points_redeem_help", "member_rights_query"
]);

/**
 * 路由并执行工具
 * @param {string} intentCode
 * @param {object} slots - 意图槽位参数
 * @param {object} identity - 身份信息（identity tier, line_user_id, etc.）
 * @returns {object|null} - 工具结果，纯信息类意图返回 null
 */
export async function routeAndExecute(intentCode, slots = {}, identity = {}) {
  if (INFO_ONLY_INTENTS.has(intentCode)) return null;
  if (!intentCode || intentCode === "unknown") return null;

  const toolFn = TOOL_MAP[intentCode];
  if (!toolFn) return null;

  try {
    return await toolFn(slots, identity);
  } catch (err) {
    return {
      success: false,
      tool_code: intentCode,
      error_message: err.message || "工具执行失败"
    };
  }
}
