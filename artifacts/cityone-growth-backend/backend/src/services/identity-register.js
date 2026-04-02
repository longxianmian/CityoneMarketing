export function buildAutoRegistrationContext(params, userStage) {
  if (!params.line_user_id) {
    return {
      should_auto_register: false,
      register_status: "not_ready",
      register_status_name: "未具备自动注册条件",
      register_mode: "none",
      register_channel: "oa_follow",
      powerbank_user_id: "",
      line_user_id: "",
      source_site_id: params.site_id,
      source_entry_type: params.entry_type,
      source_entry_code: params.entry_code,
      register_time: null,
      bridge_status: "waiting_for_oa_follow",
      next_action: "follow_oa_first"
    };
  }

  if (userStage.code === "identified_user") {
    return {
      should_auto_register: true,
      register_status: "already_registered",
      register_status_name: "已存在可识别业务身份",
      register_mode: "oa_auto_register",
      register_channel: "oa_follow",
      powerbank_user_id: params.user_id || "",
      line_user_id: params.line_user_id,
      source_site_id: params.site_id,
      source_entry_type: params.entry_type,
      source_entry_code: params.entry_code,
      register_time: new Date().toISOString(),
      bridge_status: "identified_in_a_system",
      next_action: "enter_business"
    };
  }

  return {
    should_auto_register: true,
    register_status: "auto_registered_minimal",
    register_status_name: "已按OA关注自动注册最小用户",
    register_mode: "oa_auto_register",
    register_channel: "oa_follow",
    powerbank_user_id: buildMinimalPowerbankUserId(params.line_user_id),
    line_user_id: params.line_user_id,
    source_site_id: params.site_id,
    source_entry_type: params.entry_type,
    source_entry_code: params.entry_code,
    register_time: new Date().toISOString(),
    bridge_status: "pending_a_system_bind",
    next_action: "continue_borrow"
  };
}

function buildMinimalPowerbankUserId(lineUserId) {
  const safe = String(lineUserId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  return `PB_MIN_${safe || "UNKNOWN"}`;
}
