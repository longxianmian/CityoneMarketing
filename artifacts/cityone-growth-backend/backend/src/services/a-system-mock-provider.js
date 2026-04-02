const DEVICE_MOCKS = {
  D001: {
    device_match_status: "matched",
    site_match_status: "matched",
    deposit_status: "paid",
    first_borrow_status: "first_borrow",
    borrow_availability: "available",
    a_system_bridge_status: "mocked_success"
  },
  D002: {
    device_match_status: "matched",
    site_match_status: "matched",
    deposit_status: "paid",
    first_borrow_status: "old_user",
    borrow_availability: "available",
    a_system_bridge_status: "mocked_success"
  },
  D003: {
    device_match_status: "matched",
    site_match_status: "matched",
    deposit_status: "unpaid",
    first_borrow_status: "unknown_before_borrow",
    borrow_availability: "blocked_need_deposit",
    a_system_bridge_status: "mocked_success"
  },
  D404: {
    device_match_status: "not_found",
    site_match_status: "unknown",
    deposit_status: "unknown_device_not_found",
    first_borrow_status: "unknown_device_not_found",
    borrow_availability: "blocked_device_not_found",
    a_system_bridge_status: "mocked_not_found"
  }
};

const CABINET_MOCKS = {
  C001: {
    device_match_status: "cabinet_entry_no_device_check",
    site_match_status: "pending_site_mapping_confirm",
    deposit_status: "pending_a_system_check",
    first_borrow_status: "pending_a_system_check",
    borrow_availability: "pending_cabinet_resolution",
    a_system_bridge_status: "mocked_partial"
  }
};

const SITE_MOCKS = {
  S001: {
    device_match_status: "site_entry_no_device_check",
    site_match_status: "matched",
    deposit_status: "pending_a_system_check",
    first_borrow_status: "pending_a_system_check",
    borrow_availability: "pending_site_entry_resolution",
    a_system_bridge_status: "mocked_partial"
  }
};

export function resolveMockPatch(params) {
  if (params.entry_type === "device_qr") {
    return DEVICE_MOCKS[params.entry_code] || {
      device_match_status: "matched",
      site_match_status: "pending_mapping_check",
      deposit_status: "pending_a_system_check",
      first_borrow_status: "pending_a_system_check",
      borrow_availability: "pending_a_system_check",
      a_system_bridge_status: "mocked_default"
    };
  }

  if (params.entry_type === "cabinet_qr") {
    return CABINET_MOCKS[params.entry_code] || {
      device_match_status: "cabinet_entry_no_device_check",
      site_match_status: "pending_mapping_check",
      deposit_status: "pending_a_system_check",
      first_borrow_status: "pending_a_system_check",
      borrow_availability: "pending_cabinet_resolution",
      a_system_bridge_status: "mocked_default"
    };
  }

  if (params.entry_type === "site_qr") {
    return SITE_MOCKS[params.entry_code] || {
      device_match_status: "site_entry_no_device_check",
      site_match_status: "pending_mapping_check",
      deposit_status: "pending_a_system_check",
      first_borrow_status: "pending_a_system_check",
      borrow_availability: "pending_site_entry_resolution",
      a_system_bridge_status: "mocked_default"
    };
  }

  return {};
}
