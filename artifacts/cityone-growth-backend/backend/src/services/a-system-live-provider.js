import { httpGetJson, httpPostJson } from "../lib/http-client.js";

const A_SYSTEM_BASE_URL =
  process.env.A_SYSTEM_BASE_URL || "http://127.0.0.1:8084/app";

const DEFAULT_PLATFORM_CODE =
  process.env.A_SYSTEM_PLATFORM_CODE || "airwallex_wechat";

const DEFAULT_PAY_TYPE =
  Number(process.env.A_SYSTEM_PAY_TYPE || "1");

const A_SYSTEM_AUTH_MODE =
  process.env.A_SYSTEM_AUTH_MODE || "placeholder";

export function resolveLivePatch(params) {
  return {
    device_match_status:
      params.entry_type === "device_qr"
        ? "pending_a_system_api_check"
        : params.entry_type === "cabinet_qr"
        ? "cabinet_entry_no_device_check"
        : "site_entry_no_device_check",

    site_match_status: "pending_a_system_api_check",
    deposit_status: "pending_a_system_api_check",
    first_borrow_status: "pending_a_system_api_check",
    borrow_availability: "pending_a_system_api_check",
    a_system_bridge_status: "live_provider_placeholder",

    live_bridge_plan: buildLiveBridgePlan(params)
  };
}

export async function previewASystemLiveCalls(params) {
  const plan = buildLiveBridgePlan(params);

  const result = {
    auth_mode: A_SYSTEM_AUTH_MODE,
    step_1_shop_mapping: null,
    step_2_borrow_before: null,
    step_3_borrow: null
  };

  if (plan.step_1_shop_mapping.enabled) {
    result.step_1_shop_mapping = await httpGetJson(
      plan.step_1_shop_mapping.url,
      plan.step_1_shop_mapping.query
    );
  }

  result.step_2_borrow_before = await httpPostJson(
    plan.step_2_borrow_before.url,
    sanitizeBodyTemplate(plan.step_2_borrow_before.body_template)
  );

  result.step_3_borrow = await httpPostJson(
    plan.step_3_borrow.url,
    sanitizeBodyTemplate(plan.step_3_borrow.body_template)
  );

  return result;
}

function buildLiveBridgePlan(params) {
  return {
    step_1_shop_mapping: buildShopMappingPlan(params),
    step_2_borrow_before: buildBorrowBeforePlan(params),
    step_3_borrow: buildBorrowPlan(params)
  };
}

function buildShopMappingPlan(params) {
  if (params.entry_type !== "device_qr") {
    return {
      enabled: false,
      reason: "仅 device_qr 先桥接 queryShopByDeviceId"
    };
  }

  return {
    enabled: true,
    method: "GET",
    url: `${A_SYSTEM_BASE_URL}/shop/queryShopByDeviceId`,
    query: {
      deviceId: params.entry_code
    },
    response_hint: {
      wrapper: "R<ShopDTO>",
      important_fields: [
        "id",
        "shopName",
        "payMethod",
        "deposit",
        "canBorrowCount",
        "canReturnCount",
        "address",
        "longitude",
        "latitude",
        "distance"
      ]
    },
    note: "A系统真实接口：根据设备编号查店铺"
  };
}

function buildBorrowBeforePlan(params) {
  return {
    enabled: true,
    method: "POST",
    url: `${A_SYSTEM_BASE_URL}/borrow/borrowBefore`,
    body_template: buildBorrowBeforeBodyTemplate(params),
    body_schema: "BorrowVO",
    auth_requirement: "@CurrentUser",
    note: "A系统真实接口：借电前检查"
  };
}

function buildBorrowPlan(params) {
  return {
    enabled: true,
    method: "POST",
    url: `${A_SYSTEM_BASE_URL}/borrow/borrow`,
    body_template: buildBorrowBodyTemplate(params),
    body_schema: "WebBorrowVO",
    auth_requirement: "@CurrentUser",
    note: "A系统真实接口：正式借电"
  };
}

function buildBorrowBeforeBodyTemplate(params) {
  return {
    deviceId: params.entry_type === "device_qr" ? params.entry_code : "",
    payType: DEFAULT_PAY_TYPE,
    platformCode: DEFAULT_PLATFORM_CODE,
    source: 1
  };
}

function buildBorrowBodyTemplate(params) {
  return {
    deviceId: params.entry_type === "device_qr" ? params.entry_code : "",
    payType: DEFAULT_PAY_TYPE,
    platformCode: DEFAULT_PLATFORM_CODE,
    source: 2
  };
}

function sanitizeBodyTemplate(body) {
  return JSON.parse(JSON.stringify(body));
}
