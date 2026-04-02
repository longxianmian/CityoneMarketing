export function resolveRewardPlan(params, userStage, feature) {
  if (userStage.code === "visitor_unfollowed") {
    return {
      code: "FOLLOW_REWARD_PENDING",
      name: "关注后自动注册奖励待配置",
      trigger: "oa_follow_success",
      reward_type: "coupon",
      benefit_category: "follow_reward",
      grant_mode: "after_follow"
    };
  }

  if (userStage.code === "oa_followed_registered") {
    return {
      code: "OA_REGISTER_REWARD_PENDING",
      name: "关注即注册奖励待配置",
      trigger: "oa_follow_auto_register_success",
      reward_type: "coupon",
      benefit_category: "auto_register_reward",
      grant_mode: "after_auto_register"
    };
  }

  if (isOnsiteBusinessEntryType(params.entry_type)) {
    return {
      code: "ONSITE_BORROW_REWARD_PENDING",
      name: "现场借电奖励待配置",
      trigger: "borrow_success",
      reward_type: "coupon",
      benefit_category: "onsite_borrow_reward",
      grant_mode: "after_borrow"
    };
  }

  const mapping = {
    shake: {
      code: "SHAKE_REWARD_PENDING",
      name: "一起摇奖励待配置",
      trigger: "activity_success",
      reward_type: "coupon",
      benefit_category: "interactive_activity_reward",
      grant_mode: "after_activity"
    },
    flash_coupon: {
      code: "FLASH_COUPON_PENDING",
      name: "闪券奖励待配置",
      trigger: "coupon_claim_success",
      reward_type: "coupon",
      benefit_category: "flash_coupon",
      grant_mode: "instant_claim"
    },
    battery_sos: {
      code: "BATTERY_SOS_PENDING",
      name: "应急电量奖励待配置",
      trigger: "borrow_success",
      reward_type: "coupon",
      benefit_category: "emergency_power_reward",
      grant_mode: "after_borrow"
    },
    blessing_draw: {
      code: "BLESSING_DRAW_PENDING",
      name: "祝福抽奖奖励待配置",
      trigger: "draw_success",
      reward_type: "coupon",
      benefit_category: "draw_reward",
      grant_mode: "after_draw"
    },
    benefit_center: {
      code: "BENEFIT_CENTER_PENDING",
      name: "权益中心奖励待配置",
      trigger: "benefit_claim_success",
      reward_type: "coupon",
      benefit_category: "benefit_center_reward",
      grant_mode: "instant_claim"
    }
  };

  return (
    mapping[feature] || {
      code: "DEFAULT_REWARD_PENDING",
      name: "默认奖励待配置",
      trigger: "activity_success",
      reward_type: "coupon",
      benefit_category: "default_reward",
      grant_mode: "after_activity"
    }
  );
}

function isOnsiteBusinessEntryType(entryType) {
  return ["device_qr", "cabinet_qr", "site_qr"].includes(entryType);
}
