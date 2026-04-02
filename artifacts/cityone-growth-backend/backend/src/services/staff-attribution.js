export function resolveStaffAttribution(params) {
  const isStaffEntry =
    params.referrer_type === "staff" && Boolean(params.referrer_id);

  if (!isStaffEntry) {
    return {
      is_staff_entry: false,
      staff_id: "",
      staff_entry_code: "",
      attribution_mode: "normal_entry",
      incentive_status: "not_applicable"
    };
  }

  return {
    is_staff_entry: true,
    staff_id: params.referrer_id,
    staff_entry_code: buildStaffEntryCode(params),
    attribution_mode: "staff_referral",
    incentive_status: "pending_stat"
  };
}

export function buildStaffEntrySummary(params, featureName) {
  const staffAttribution = resolveStaffAttribution(params);

  if (!staffAttribution.is_staff_entry) {
    return null;
  }

  return {
    staff_id: staffAttribution.staff_id,
    staff_entry_code: staffAttribution.staff_entry_code,
    current_feature_name: featureName,
    site_id: params.site_id,
    entry_type: params.entry_type,
    entry_code: params.entry_code,
    next_goal: "统计店员带来的关注、绑定、活动参与、借电订单"
  };
}

function buildStaffEntryCode(params) {
  return [
    "staff",
    params.referrer_id,
    params.site_id,
    params.entry_type,
    params.entry_code
  ].join(":");
}
