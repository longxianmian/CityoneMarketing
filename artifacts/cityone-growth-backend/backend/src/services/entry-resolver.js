import { resolveASystemBusinessContext } from "./a-system-bridge.js";
import { resolveFeatureRoute } from "./feature-router.js";
import { buildOAFollowRedirect, buildReturnContext } from "./oa-router.js";
import { resolveRewardPlan } from "./reward-engine.js";
import { buildEntryEventContext } from "./event-tracker.js";
import { resolveStaffAttribution, buildStaffEntrySummary } from "./staff-attribution.js";
import { buildAutoRegistrationContext } from "./identity-register.js";
import { getEntryRoutingConfig } from "../config/entry-routing-config.js";

export function resolveEntryRoute(params) {
  const isOnsiteBusinessEntry = isOnsiteBusinessEntryType(params.entry_type);

  const featureRoute = resolveFeatureRoute(params);
  const feature = featureRoute.feature_name;

  const userStage = detectUserStage(params);
  const diversionContext = buildDiversionContext({
    params,
    userStage,
    isOnsiteBusinessEntry,
    feature
  });

  const needFollow = diversionContext.need_follow;
  const rewardPlan = resolveRewardPlan(params, userStage, feature);
  const eventContext = buildEntryEventContext({
    params,
    userStage,
    featureRoute,
    diversionContext,
    rewardPlan,
    isOnsiteBusinessEntry
  });
  const autoRegistration = buildAutoRegistrationContext(params, userStage);
  const staffAttribution = resolveStaffAttribution(params);
  const staffEntrySummary = buildStaffEntrySummary(params, feature);

  const routeDecision = resolveRouteDecision({
    params,
    needFollow,
    feature,
    isOnsiteBusinessEntry
  });

  const businessContext = isOnsiteBusinessEntry
    ? resolveASystemBusinessContext(params, userStage, autoRegistration)
    : null;

  const borrowDecision = isOnsiteBusinessEntry
    ? buildBorrowDecision({
        userStage,
        businessContext,
        routeDecision,
        rewardPlan
      })
    : null;

  return {
    route_type: routeDecision.routeType,
    route_target: routeDecision.routeTarget,
    feature_name: routeDecision.featureName,

    feature_route_context: {
      resolved_feature_name: feature,
      route_source: featureRoute.route_source,
      forced_feature_name: params.feature_name || ""
    },

    user_context: {
      user_id: params.user_id,
      line_user_id: params.line_user_id,
      user_stage: userStage.code,
      user_stage_name: userStage.name,
      is_new_user_candidate: userStage.isNewUserCandidate,
      is_old_user_candidate: userStage.isOldUserCandidate
    },

    diversion_context: diversionContext,

    attribution_context: {
      site_id: params.site_id,
      entry_type: params.entry_type,
      entry_code: params.entry_code,
      referrer_type: params.referrer_type,
      referrer_id: params.referrer_id,
      utm_source: params.utm_source,
      utm_campaign: params.utm_campaign
    },

    oa_flow: {
      need_follow: diversionContext.need_follow,
      follow_reason_code: diversionContext.follow_reason_code,
      follow_reason_name: diversionContext.follow_reason_name,
      oa_redirect_url: diversionContext.oa_redirect_url,
      follow_return_token: diversionContext.follow_return_token,
      return_path: diversionContext.return_path,
      return_context: diversionContext.return_context
    },

    reward_context: {
      reward_plan_code: rewardPlan.code,
      reward_plan_name: rewardPlan.name,
      reward_trigger: rewardPlan.trigger,
      reward_type: rewardPlan.reward_type,
      benefit_category: rewardPlan.benefit_category,
      grant_mode: rewardPlan.grant_mode,
      reward_status: "pending_rule_config"
    },

    auto_registration: autoRegistration,

    staff_attribution: staffAttribution,
    staff_entry_summary: staffEntrySummary,

    event_context: eventContext,

    business_context: businessContext,
    borrow_decision: borrowDecision,

    next_action: buildNextAction({
      userStage,
      needFollow,
      routeDecision
    }),

    next_step: isOnsiteBusinessEntry
      ? "下一步接入真实借电确认接口 + A系统真实桥接"
      : "下一步接入OA真实回跳、自动注册落库与活动后台配置"
  };
}

function isOnsiteBusinessEntryType(entryType) {
  const config = getEntryRoutingConfig();
  const onsiteEntryTypes = config.onsite_business_entry_types || [];
  return onsiteEntryTypes.includes(entryType);
}

function resolveRouteDecision({
  params,
  needFollow,
  feature,
  isOnsiteBusinessEntry
}) {
  if (needFollow) {
    return {
      routeType: isOnsiteBusinessEntry
        ? "oa_follow_then_business"
        : "oa_follow_then_feature",
      routeTarget: isOnsiteBusinessEntry
        ? buildBusinessRouteTarget(params)
        : `/activity/${feature}`,
      featureName: isOnsiteBusinessEntry ? null : feature
    };
  }

  if (isOnsiteBusinessEntry) {
    return {
      routeType: "business",
      routeTarget: buildBusinessRouteTarget(params),
      featureName: null
    };
  }

  return {
    routeType: "feature",
    routeTarget: `/activity/${feature}`,
    featureName: feature
  };
}

function buildBusinessRouteTarget(params) {
  const query = new URLSearchParams({
    site_id: params.site_id,
    entry_type: params.entry_type,
    entry_code: params.entry_code
  });

  return `/borrow/confirm?${query.toString()}`;
}

function detectUserStage(params) {
  const config = getEntryRoutingConfig();
  const labels = config.user_stage_labels || {};

  if (!params.line_user_id && !params.user_id) {
    return {
      code: "visitor_unfollowed",
      name: labels.visitor_unfollowed || "访客未关注",
      isNewUserCandidate: true,
      isOldUserCandidate: false
    };
  }

  if (params.line_user_id && !params.user_id) {
    return {
      code: "oa_followed_registered",
      name: labels.oa_followed_registered || "已关注并自动注册",
      isNewUserCandidate: false,
      isOldUserCandidate: true
    };
  }

  return {
    code: "identified_user",
    name: labels.identified_user || "已识别用户",
    isNewUserCandidate: false,
    isOldUserCandidate: true
  };
}

function buildDiversionContext({
  params,
  userStage,
  isOnsiteBusinessEntry,
  feature
}) {
  const returnContext = buildReturnContext({
    params,
    feature,
    isOnsiteBusinessEntry
  });

  if (userStage.code === "visitor_unfollowed") {
    const oaRedirect = buildOAFollowRedirect({
      params,
      feature,
      isOnsiteBusinessEntry
    });

    return {
      diversion_stage: "follow_required",
      diversion_stage_name: "需先关注OA",
      need_follow: true,
      follow_reason_code: "USER_NOT_FOLLOWED",
      follow_reason_name: "用户尚未关注OA",
      bind_required: false,
      bind_reason_code: "",
      bind_reason_name: "",
      oa_redirect_url: oaRedirect.oa_redirect_url,
      follow_return_token: oaRedirect.follow_return_token,
      return_path: oaRedirect.return_path,
      return_context: oaRedirect.return_context_payload
    };
  }

  if (userStage.code === "oa_followed_registered") {
    return {
      diversion_stage: "direct_pass",
      diversion_stage_name: "已关注即自动注册，可直接进入下一流程",
      need_follow: false,
      follow_reason_code: "",
      follow_reason_name: "",
      bind_required: false,
      bind_reason_code: "",
      bind_reason_name: "",
      oa_redirect_url: null,
      follow_return_token: "",
      return_path: "",
      return_context: returnContext
    };
  }

  return {
    diversion_stage: "direct_pass",
    diversion_stage_name: "可直接进入下一流程",
    need_follow: false,
    follow_reason_code: "",
    follow_reason_name: "",
    bind_required: false,
    bind_reason_code: "",
    bind_reason_name: "",
    oa_redirect_url: null,
    follow_return_token: "",
    return_path: "",
    return_context: returnContext
  };
}

function buildBorrowDecision({
  userStage,
  businessContext,
  routeDecision,
  rewardPlan
}) {
  if (!businessContext) {
    return null;
  }

  if (userStage.code === "visitor_unfollowed") {
    return {
      decision_code: "follow_oa_first",
      decision_name: "先关注OA",
      page_mode: "follow_gate",
      primary_button: {
        text: "去关注",
        action: "follow_oa",
        target: "oa_follow"
      },
      secondary_tip: "关注后再进入借电流程",
      block_reason: "USER_NOT_FOLLOWED",
      reward_hint: "关注后可继续参与现场借电奖励",
      route_target: routeDecision.routeTarget
    };
  }

  if (userStage.code === "oa_followed_registered") {
    return {
      decision_code: "continue_after_oa_register",
      decision_name: "已关注并自动注册，可继续借电",
      page_mode: "borrow_confirm",
      primary_button: {
        text: "继续借电",
        action: "continue_borrow",
        target: routeDecision.routeTarget
      },
      secondary_tip: "系统已按OA关注自动注册，将在借电流程中继续完成主系统识别",
      block_reason: null,
      reward_hint: "你已完成最小注册，可继续进入现场借电流程",
      route_target: routeDecision.routeTarget
    };
  }

  if (businessContext.borrow_availability === "blocked_device_not_found") {
    return {
      decision_code: "device_not_found",
      decision_name: "设备不存在",
      page_mode: "error_state",
      primary_button: {
        text: "返回重试",
        action: "retry_scan",
        target: "scan_again"
      },
      secondary_tip: "未找到对应设备，请核对二维码或联系现场人员",
      block_reason: "DEVICE_NOT_FOUND",
      reward_hint: null,
      route_target: routeDecision.routeTarget
    };
  }

  if (businessContext.borrow_availability === "blocked_need_deposit") {
    return {
      decision_code: "need_deposit_first",
      decision_name: "需先缴押金",
      page_mode: "deposit_gate",
      primary_button: {
        text: "去缴押金",
        action: "go_deposit",
        target: "/deposit/pay"
      },
      secondary_tip: "完成押金后可继续借电",
      block_reason: "DEPOSIT_REQUIRED",
      reward_hint: "完成押金后可继续参与现场借电奖励",
      route_target: routeDecision.routeTarget
    };
  }

  if (businessContext.borrow_availability === "pending_cabinet_resolution") {
    return {
      decision_code: "cabinet_mapping_pending",
      decision_name: "柜机映射待确认",
      page_mode: "cabinet_pending",
      primary_button: {
        text: "联系站点处理",
        action: "contact_staff",
        target: "site_staff"
      },
      secondary_tip: "当前柜机入口仍需确认站点映射关系",
      block_reason: "CABINET_MAPPING_PENDING",
      reward_hint: null,
      route_target: routeDecision.routeTarget
    };
  }

  if (businessContext.borrow_availability === "pending_site_entry_resolution") {
    return {
      decision_code: "site_entry_pending",
      decision_name: "站点入口待解析",
      page_mode: "site_pending",
      primary_button: {
        text: "刷新重试",
        action: "refresh_entry",
        target: routeDecision.routeTarget
      },
      secondary_tip: "当前站点入口仍在等待进一步解析",
      block_reason: "SITE_ENTRY_PENDING",
      reward_hint: null,
      route_target: routeDecision.routeTarget
    };
  }

  if (
    businessContext.borrow_availability === "available" &&
    businessContext.first_borrow_status === "first_borrow"
  ) {
    return {
      decision_code: "first_borrow_ready",
      decision_name: "首借可进行",
      page_mode: "first_borrow_confirm",
      primary_button: {
        text: "立即借电",
        action: "confirm_borrow",
        target: routeDecision.routeTarget
      },
      secondary_tip: "你当前命中首借流程，可展示首借奖励",
      block_reason: null,
      reward_hint: `命中奖励计划：${rewardPlan.name}`,
      route_target: routeDecision.routeTarget
    };
  }

  if (businessContext.borrow_availability === "available") {
    return {
      decision_code: "normal_borrow_ready",
      decision_name: "可直接借电",
      page_mode: "normal_borrow_confirm",
      primary_button: {
        text: "立即借电",
        action: "confirm_borrow",
        target: routeDecision.routeTarget
      },
      secondary_tip: "当前设备与用户状态正常，可继续借电",
      block_reason: null,
      reward_hint: `命中奖励计划：${rewardPlan.name}`,
      route_target: routeDecision.routeTarget
    };
  }

  return {
    decision_code: "pending_a_system_check",
    decision_name: "等待主系统确认",
    page_mode: "pending_check",
    primary_button: {
      text: "刷新状态",
      action: "refresh_status",
      target: routeDecision.routeTarget
    },
    secondary_tip: "当前正在等待主系统返回借电状态",
    block_reason: "A_SYSTEM_CHECK_PENDING",
    reward_hint: null,
    route_target: routeDecision.routeTarget
  };
}

function buildNextAction({ userStage, needFollow, routeDecision }) {
  if (needFollow) {
    return {
      action_code: "follow_oa",
      action_name: "先关注OA再进入下一流程",
      action_target: "oa_follow"
    };
  }

  if (userStage.code === "oa_followed_registered") {
    return {
      action_code: "continue_borrow",
      action_name: "已关注即自动注册，直接进入下一流程",
      action_target: routeDecision.routeTarget
    };
  }

  if (routeDecision.routeType === "business") {
    return {
      action_code: "enter_business",
      action_name: "直接进入借电业务流程",
      action_target: routeDecision.routeTarget
    };
  }

  return {
    action_code: "enter_feature",
    action_name: "直接进入活动",
    action_target: routeDecision.routeTarget
  };
}
