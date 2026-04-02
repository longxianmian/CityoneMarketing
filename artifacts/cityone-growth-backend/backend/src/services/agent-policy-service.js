/**
 * agent-policy-service.js
 *
 * 权限策略层：根据 identity_tier + intent_code 判断是否允许执行。
 */

import { loadAgentConfig } from "./agent-config-service.js";

const POLICY_RESULTS = {
  ALLOWED: "allowed",
  BLOCKED: "blocked",
  NEED_FOLLOW: "need_follow",
  NEED_UPGRADE: "need_upgrade",
  NEED_CONFIRM: "need_confirm",
  TOOL_DISABLED: "tool_disabled"
};

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
  activity_query: "tool-activity-query",
  borrow_help: null,
  return_help: null,
  invite_help: null,
  points_redeem_help: null
};

// 需要二次确认的意图
const CONFIRM_INTENTS = new Set(["after_sale_apply"]);

/**
 * 检查权限
 * @param {string} identityTier
 * @param {string} intentCode
 * @param {boolean} needConfirm - 来自 intent service
 * @returns {{ result, reason, block_message }}
 */
export function checkPolicy(identityTier, intentCode, needConfirm = false) {
  const config = loadAgentConfig();

  if (!config.enabled) {
    return {
      result: POLICY_RESULTS.BLOCKED,
      reason: "agent_disabled",
      block_message: "AI 助理暂时关闭，请稍后再试。"
    };
  }

  // 纯说明类意图（无工具），直接放行
  const toolCode = INTENT_TOOL_MAP[intentCode];
  const isInfoOnly = toolCode === null || toolCode === undefined;

  if (isInfoOnly) {
    // 说明类意图，任何层级都可访问
    return { result: POLICY_RESULTS.ALLOWED, reason: "info_intent_always_allowed" };
  }

  // 检查工具开关
  const toolSwitches = config.tool_switches || {};
  if (toolSwitches[toolCode] === false) {
    return {
      result: POLICY_RESULTS.TOOL_DISABLED,
      reason: "tool_disabled",
      block_message: "该功能暂时关闭，请稍后再试。"
    };
  }

  // 检查身份层级权限
  const allowedIntents = config.identity_rules?.[identityTier] || [];
  if (!allowedIntents.includes(intentCode)) {
    // 根据层级给出不同提示
    if (identityTier === "guest_unfollowed") {
      return {
        result: POLICY_RESULTS.NEED_FOLLOW,
        reason: "not_oa_follower",
        block_message: "该功能需要先关注公众号后才能使用。"
      };
    }
    return {
      result: POLICY_RESULTS.NEED_UPGRADE,
      reason: "insufficient_tier",
      block_message: "该功能需要更高的账号权限，完成首次借电后可解锁。"
    };
  }

  // 是否需要二次确认
  if (needConfirm || CONFIRM_INTENTS.has(intentCode)) {
    return {
      result: POLICY_RESULTS.NEED_CONFIRM,
      reason: "action_requires_confirm",
      block_message: null
    };
  }

  return { result: POLICY_RESULTS.ALLOWED, reason: "policy_passed" };
}

export { POLICY_RESULTS };
