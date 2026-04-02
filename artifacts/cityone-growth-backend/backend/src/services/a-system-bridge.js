import { resolveMockPatch } from "./a-system-mock-provider.js";
import { resolveLivePatch } from "./a-system-live-provider.js";

const A_SYSTEM_BRIDGE_MODE = process.env.A_SYSTEM_BRIDGE_MODE || "mock";

export function resolveASystemBusinessContext(params, userStage, autoRegistration = null) {
  const entryIdentity = buildEntryIdentity(params);

  const baseContext = {
    ...entryIdentity,

    biz_identity_status:
      userStage.code === "identified_user"
        ? "identified"
        : userStage.code === "oa_followed_registered"
          ? "registered_minimal"
          : "pending_identify",

    deposit_status: resolveDepositStatus(userStage),
    first_borrow_status: resolveFirstBorrowStatus(userStage),
    borrow_availability: resolveBorrowAvailability(userStage),
    suggested_borrow_action: resolveSuggestedBorrowAction(userStage),

    device_match_status: resolveDeviceMatchStatus(params),
    site_match_status: resolveSiteMatchStatus(params),

    a_system_bridge_status: "pending_bridge",

    auto_register_status: autoRegistration?.register_status || "not_ready",
    auto_register_status_name: autoRegistration?.register_status_name || "未触发自动注册",
    minimal_powerbank_user_id: autoRegistration?.powerbank_user_id || "",
    auto_register_bridge_status: autoRegistration?.bridge_status || "waiting_for_oa_follow"
  };

  if (userStage.code !== "identified_user") {
    return baseContext;
  }

  const providerPatch =
    A_SYSTEM_BRIDGE_MODE === "live"
      ? resolveLivePatch(params)
      : resolveMockPatch(params);

  const mergedContext = {
    ...baseContext,
    ...providerPatch
  };

  mergedContext.bridge_mode = A_SYSTEM_BRIDGE_MODE;
  mergedContext.suggested_borrow_action = resolveSuggestedBorrowActionByContext(
    mergedContext
  );

  return mergedContext;
}

function buildEntryIdentity(params) {
  return {
    device_code: params.entry_type === "device_qr" ? params.entry_code : "",
    cabinet_code: params.entry_type === "cabinet_qr" ? params.entry_code : "",
    site_code: params.entry_type === "site_qr" ? params.entry_code : "",
    raw_entry_code: params.entry_code
  };
}

function resolveDepositStatus(userStage) {
  if (userStage.code === "visitor_unfollowed") {
    return "unknown_before_identify";
  }

  return "pending_a_system_check";
}

function resolveFirstBorrowStatus(userStage) {
  if (userStage.code !== "identified_user") {
    return "unknown_before_identify";
  }

  return "pending_a_system_check";
}

function resolveBorrowAvailability(userStage) {
  if (userStage.code === "visitor_unfollowed") {
    return "blocked_before_follow";
  }

  if (userStage.code === "oa_followed_registered") {
    return "pending_a_system_check";
  }

  return "pending_a_system_check";
}

function resolveSuggestedBorrowAction(userStage) {
  if (userStage.code === "visitor_unfollowed") {
    return "follow_oa_first";
  }

  if (userStage.code === "oa_followed_registered") {
    return "continue_and_auto_register";
  }

  return "check_a_system_and_prepare_borrow";
}

function resolveSuggestedBorrowActionByContext(context) {
  if (context.borrow_availability === "blocked_device_not_found") {
    return "show_device_not_found";
  }

  if (context.borrow_availability === "blocked_need_deposit") {
    return "go_deposit_first";
  }

  if (context.borrow_availability === "pending_cabinet_resolution") {
    return "resolve_cabinet_mapping_first";
  }

  if (context.borrow_availability === "pending_site_entry_resolution") {
    return "resolve_site_entry_first";
  }

  if (context.borrow_availability === "available") {
    if (context.first_borrow_status === "first_borrow") {
      return "prepare_first_borrow_flow";
    }

    return "prepare_normal_borrow_flow";
  }

  return "check_a_system_and_prepare_borrow";
}

function resolveDeviceMatchStatus(params) {
  if (params.entry_type === "device_qr") {
    return "pending_a_system_check";
  }

  if (params.entry_type === "cabinet_qr") {
    return "cabinet_entry_no_device_check";
  }

  return "site_entry_no_device_check";
}

function resolveSiteMatchStatus(params) {
  if (params.entry_type === "site_qr") {
    return "pending_a_system_check";
  }

  return "pending_mapping_check";
}
