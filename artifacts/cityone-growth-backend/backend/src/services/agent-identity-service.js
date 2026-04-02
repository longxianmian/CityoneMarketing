/**
 * agent-identity-service.js
 *
 * 复用 entry-resolver + a-system-bridge 的现有能力，
 * 将用户信息归一化为 Agent 四级身份层级：
 *   guest_unfollowed → oa_fan → identified_user → member
 */

import { resolveASystemBusinessContext } from "./a-system-bridge.js";
import { loadAgentConfig } from "./agent-config-service.js";

/**
 * 解析 Agent 身份层级
 * @param {object} params
 *   line_user_id, user_id, site_id, entry_type, entry_code,
 *   is_oa_followed, deposit_status (optional override), user_stage_code
 * @returns {object} identityResult
 */
export function resolveAgentIdentity(params = {}) {
  const {
    line_user_id = "",
    user_id = "",
    user_stage_code = "",
    is_oa_followed = false,
    deposit_status_override = "",
    first_borrow_done = false
  } = params;

  // 第一层：未关注 OA
  if (!line_user_id || (!is_oa_followed && user_stage_code === "visitor_unfollowed")) {
    return buildIdentityResult("guest_unfollowed", params, null);
  }

  // 尝试获取 A 系统桥接上下文
  const userStage = { code: user_stage_code || "oa_followed_registered" };
  let aCtx = null;
  try {
    aCtx = resolveASystemBusinessContext(
      { ...params, entry_type: params.entry_type || "site_qr", entry_code: params.entry_code || "" },
      userStage
    );
  } catch {
    // 桥接失败，降级处理
  }

  const depositStatus = deposit_status_override || aCtx?.deposit_status || "pending_a_system_check";
  const firstBorrowStatus = aCtx?.first_borrow_status || "unknown_before_identify";

  // 第二层：已关注但未识别业务身份
  if (!user_id && user_stage_code !== "identified_user") {
    return buildIdentityResult("oa_fan", params, aCtx);
  }

  // 第三层：已识别用户
  // 第四层：会员 = 押金已付 + 完成过首借
  const isMember =
    (depositStatus === "deposit_paid" || depositStatus === "available") &&
    (first_borrow_done || firstBorrowStatus === "returned");

  const tier = isMember ? "member" : "identified_user";
  return buildIdentityResult(tier, params, aCtx);
}

function buildIdentityResult(tier, params, aCtx) {
  const config = loadAgentConfig();
  const availableTools = getAvailableTools(tier, config);
  const capabilities = config.identity_rules?.[tier] || [];

  const TIER_LABELS = {
    guest_unfollowed: "未关注用户",
    oa_fan: "已关注 OA 粉丝",
    identified_user: "已识别用户",
    member: "会员用户"
  };

  return {
    identity_tier: tier,
    identity_label: TIER_LABELS[tier] || tier,
    line_user_id: params.line_user_id || "",
    user_id: params.user_id || "",
    member_level: tier === "member" ? "member" : tier === "identified_user" ? "user" : "fan",
    capabilities,
    available_tools: availableTools,
    a_system_context: aCtx,
    deposit_status: aCtx?.deposit_status || "unknown",
    first_borrow_status: aCtx?.first_borrow_status || "unknown",
    borrow_availability: aCtx?.borrow_availability || "unknown"
  };
}

function getAvailableTools(tier, config) {
  const INTENT_TOOL_MAP = {
    nearby_sites_query: "tool-nearby-sites",
    coupon_list_query: "tool-coupon-list",
    coupon_recommend: "tool-coupon-recommend",
    benefit_claim_query: "tool-claim-benefits",
    invite_poster_generate: "tool-invite-poster",
    recent_orders_query: "tool-order-query",
    points_balance_query: "tool-points-query",
    member_rights_query: "tool-member-rights",
    after_sale_apply: "tool-after-sale",
    activity_query: "tool-activity-query"
  };

  const intents = config.identity_rules?.[tier] || [];
  const switches = config.tool_switches || {};
  const tools = [];

  for (const intent of intents) {
    const tool = INTENT_TOOL_MAP[intent];
    if (tool && switches[tool] !== false) tools.push(tool);
  }

  return [...new Set(tools)];
}
