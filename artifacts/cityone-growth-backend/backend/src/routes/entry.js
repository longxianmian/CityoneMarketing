import { parseEntryParams, getAllowedEntryTypes } from "../utils/entry-params.js";
import { resolveEntryRoute } from "../services/entry-resolver.js";
import { previewASystemLiveCalls } from "../services/a-system-live-provider.js";
import { getFeatureRouteRules } from "../services/feature-router.js";
import { getEntryRoutingConfig } from "../config/entry-routing-config.js";

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, {
    code: 200,
    msg,
    data,
  });
}

function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, {
    code: statusCode,
    msg,
    error: errorCode,
  });
}

export function handleEntryResolve(req, res, url, sendJson) {
  try {
    const params = parseEntryParams(url.searchParams);
    const result = resolveEntryRoute(params);

    return sendOk(res, sendJson, "entry resolved", result);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      400,
      "BAD_ENTRY_PARAMS",
      error.message || "入口参数错误"
    );
  }
}

export async function handleEntryLivePreview(req, res, url, sendJson) {
  try {
    const params = parseEntryParams(url.searchParams);
    const result = await previewASystemLiveCalls(params);

    return sendOk(res, sendJson, "a system live preview finished", result);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "A_SYSTEM_LIVE_PREVIEW_FAILED",
      error.message || "A 系统实时预览失败"
    );
  }
}

export function handleOAReturnPreview(req, res, url, sendJson) {
  try {
    const params = parseEntryParams(url.searchParams);
    const result = resolveEntryRoute(params);

    return sendOk(res, sendJson, "oa return preview", {
      follow_return_token: result.oa_flow.follow_return_token,
      return_path: result.oa_flow.return_path,
      return_context: result.oa_flow.return_context,
      oa_redirect_url: result.oa_flow.oa_redirect_url
    });
  } catch (error) {
    return sendError(
      res,
      sendJson,
      400,
      "OA_RETURN_PREVIEW_FAILED",
      error.message || "OA 回跳预览失败"
    );
  }
}

export function handleEntryConfig(req, res, url, sendJson) {
  try {
    const config = getEntryRoutingConfig();

    return sendOk(res, sendJson, "entry config loaded", {
      allowed_entry_types: config.allowed_entry_types || [],
      onsite_business_entry_types: config.onsite_business_entry_types || [],
      forced_feature_enabled: !!config.forced_feature_enabled,
      user_stage_labels: config.user_stage_labels || {},
      feature_route_rules: config.feature_route_rules || {}
    });
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_CONFIG_LOAD_FAILED",
      error.message || "入口配置加载失败"
    );
  }
}

export function handleEntryAllowedTypes(req, res, url, sendJson) {
  try {
    return sendOk(res, sendJson, "allowed entry types loaded", {
      allowed_entry_types: getAllowedEntryTypes()
    });
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_ALLOWED_TYPES_LOAD_FAILED",
      error.message || "入口类型加载失败"
    );
  }
}

export function handleEntryFeatureRules(req, res, url, sendJson) {
  try {
    return sendOk(res, sendJson, "feature route rules loaded", getFeatureRouteRules());
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_FEATURE_RULES_LOAD_FAILED",
      error.message || "玩法规则加载失败"
    );
  }
}
