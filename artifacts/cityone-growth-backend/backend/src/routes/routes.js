import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const ROUTES_FILE = path.join(DATA_DIR, "route-rules.json");

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDefaultRoutes() {
  return [
    {
      route_rule_id: "route_001",
      rule_name: "site_001 桌贴默认摇一摇",
      site_id: "site_001",
      entry_type: "table_card",
      entry_code: "",
      referrer_type: "",
      referrer_id: "",
      feature_name: "shake",
      activity_id: "",
      priority: 100,
      status: "enabled",
      route_source: "site_and_entry_type_rule",
      created_at: "2026-04-01T10:00:00+07:00",
      updated_at: "2026-04-01T10:00:00+07:00",
    },
    {
      route_rule_id: "route_002",
      rule_name: "site_001 设备码先走借电分流",
      site_id: "site_001",
      entry_type: "device_qr",
      entry_code: "",
      referrer_type: "",
      referrer_id: "",
      feature_name: "battery_sos",
      activity_id: "",
      priority: 200,
      status: "enabled",
      route_source: "system_fallback_rule",
      created_at: "2026-04-01T10:05:00+07:00",
      updated_at: "2026-04-01T10:05:00+07:00",
    },
  ];
}

function loadRouteRules() {
  ensureDataDir();

  if (!fs.existsSync(ROUTES_FILE)) {
    const defaults = getDefaultRoutes();
    fs.writeFileSync(ROUTES_FILE, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }

  try {
    const raw = fs.readFileSync(ROUTES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultRoutes();
  } catch (error) {
    return getDefaultRoutes();
  }
}

function saveRouteRules(rules) {
  ensureDataDir();
  fs.writeFileSync(ROUTES_FILE, JSON.stringify(rules, null, 2), "utf-8");
}

function nextRouteId(rules) {
  const maxNo = rules.reduce((max, item) => {
    const raw = String(item.route_rule_id || "");
    const m = raw.match(/^route_(\d+)$/);
    if (!m) return max;
    return Math.max(max, Number(m[1]));
  }, 0);

  return `route_${String(maxNo + 1).padStart(3, "0")}`;
}

function findRouteIndex(rules, routeRuleId) {
  return rules.findIndex((item) => item.route_rule_id === routeRuleId);
}

function normalizePriority(value, fallback = 100) {
  const n = Number(String(value ?? fallback).trim());
  return Number.isNaN(n) ? fallback : n;
}

function validateRoutePayload(body, mode = "create") {
  const ruleName = String(body.rule_name || "").trim();
  const siteId = String(body.site_id || "").trim();
  const entryType = String(body.entry_type || "").trim();
  const featureName = String(body.feature_name || "").trim();
  const priority = normalizePriority(body.priority, 100);

  if (!ruleName) {
    return { ok: false, statusCode: 400, error: "RULE_NAME_REQUIRED", msg: "rule_name 必填" };
  }

  if (!siteId) {
    return { ok: false, statusCode: 400, error: "SITE_ID_REQUIRED", msg: "site_id 必填" };
  }

  if (!entryType) {
    return { ok: false, statusCode: 400, error: "ENTRY_TYPE_REQUIRED", msg: "entry_type 必填" };
  }

  if (!featureName) {
    return { ok: false, statusCode: 400, error: "FEATURE_NAME_REQUIRED", msg: "feature_name 必填" };
  }

  return {
    ok: true,
    data: {
      rule_name: ruleName,
      site_id: siteId,
      entry_type: entryType,
      feature_name: featureName,
      priority,
      mode,
    },
  };
}

export function handleRouteList(req, res, url, sendJson) {
  const data = loadRouteRules();
  return sendOk(res, sendJson, "route rules loaded", data);
}

export function handleRouteLogs(req, res, url, sendJson) {
  const data = [
    {
      route_log_id: "log_001",
      entry_type: "table_card",
      entry_code: "T001",
      matched_rule_id: "route_001",
      route_result: "shake",
      user_status: "visitor_unfollowed",
      created_at: "2026-04-01T10:00:00+07:00",
    },
    {
      route_log_id: "log_002",
      entry_type: "device_qr",
      entry_code: "D001",
      matched_rule_id: "route_002",
      route_result: "oa_follow_then_business",
      user_status: "visitor_unfollowed",
      created_at: "2026-04-01T10:05:00+07:00",
    },
  ];

  return sendOk(res, sendJson, "route logs loaded", data);
}

export async function handleRouteCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const validation = validateRoutePayload(body, "create");

    if (!validation.ok) {
      return sendError(res, sendJson, validation.statusCode, validation.error, validation.msg);
    }

    const payload = validation.data;
    const rules = loadRouteRules();

    const nextItem = {
      route_rule_id: nextRouteId(rules),
      rule_name: payload.rule_name,
      site_id: payload.site_id,
      entry_type: payload.entry_type,
      entry_code: "",
      referrer_type: "",
      referrer_id: "",
      feature_name: payload.feature_name,
      activity_id: "",
      priority: payload.priority,
      status: "enabled",
      route_source: "manual_created_rule",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    rules.push(nextItem);
    saveRouteRules(rules);

    return sendOk(res, sendJson, "route rule created", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ROUTE_CREATE_FAILED",
      error.message || "路由规则创建失败"
    );
  }
}

export async function handleRouteUpdate(req, res, url, sendJson, readBody) {
  try {
    const routeRuleId = String(bodyRouteIdFromPath(url.pathname) || "").trim();
    if (!routeRuleId) {
      return sendError(res, sendJson, 400, "ROUTE_ID_REQUIRED", "route_rule_id 必填");
    }

    const body = await readBody(req);
    const validation = validateRoutePayload(body, "update");

    if (!validation.ok) {
      return sendError(res, sendJson, validation.statusCode, validation.error, validation.msg);
    }

    const payload = validation.data;
    const rules = loadRouteRules();
    const idx = findRouteIndex(rules, routeRuleId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ROUTE_NOT_FOUND", "未找到对应路由规则");
    }

    const current = rules[idx];
    const nextItem = {
      ...current,
      rule_name: payload.rule_name,
      site_id: payload.site_id,
      entry_type: payload.entry_type,
      feature_name: payload.feature_name,
      priority: payload.priority,
      updated_at: new Date().toISOString(),
    };

    rules[idx] = nextItem;
    saveRouteRules(rules);

    return sendOk(res, sendJson, "route rule updated", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ROUTE_UPDATE_FAILED",
      error.message || "路由规则更新失败"
    );
  }
}

export async function handleRouteEnable(req, res, url, sendJson) {
  return updateRouteStatus(req, res, url, sendJson, "enabled");
}

export async function handleRouteDisable(req, res, url, sendJson) {
  return updateRouteStatus(req, res, url, sendJson, "disabled");
}

async function updateRouteStatus(req, res, url, sendJson, status) {
  try {
    const routeRuleId = String(bodyRouteIdFromPath(url.pathname) || "").trim();
    if (!routeRuleId) {
      return sendError(res, sendJson, 400, "ROUTE_ID_REQUIRED", "route_rule_id 必填");
    }

    const rules = loadRouteRules();
    const idx = findRouteIndex(rules, routeRuleId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ROUTE_NOT_FOUND", "未找到对应路由规则");
    }

    rules[idx] = {
      ...rules[idx],
      status,
      updated_at: new Date().toISOString(),
    };

    saveRouteRules(rules);

    return sendOk(
      res,
      sendJson,
      status === "enabled" ? "route rule enabled" : "route rule disabled",
      rules[idx]
    );
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ROUTE_STATUS_UPDATE_FAILED",
      error.message || "路由状态更新失败"
    );
  }
}

function bodyRouteIdFromPath(pathname) {
  const matched = pathname.match(/^\/api\/routes\/([^/]+)(?:\/(enable|disable))?$/);
  return matched?.[1] || "";
}

export async function handleRouteTestMatch(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);

    const siteId = String(body.site_id || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryCode = String(body.entry_code || "").trim();
    const referrerType = String(body.referrer_type || "").trim();
    const referrerId = String(body.referrer_id || "").trim();

    const rules = loadRouteRules().filter((item) => item.status === "enabled");

    const matched =
      rules
        .filter((item) => item.site_id === siteId && item.entry_type === entryType)
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] || null;

    let matched_rule_id = "route_fallback";
    let route_result = "battery_sos";
    let route_source = "system_fallback_rule";

    if (matched) {
      matched_rule_id = matched.route_rule_id;
      route_result =
        entryType === "device_qr" ? "oa_follow_then_business" : matched.feature_name;
      route_source = matched.route_source || "manual_created_rule";
    } else if (entryType === "device_qr") {
      matched_rule_id = "route_device_default";
      route_result = "oa_follow_then_business";
      route_source = "onsite_business_entry_rule";
    }

    return sendOk(res, sendJson, "route test matched", {
      input: {
        site_id: siteId,
        entry_type: entryType,
        entry_code: entryCode,
        referrer_type: referrerType,
        referrer_id: referrerId,
      },
      matched_rule_id,
      route_result,
      route_source,
    });
  } catch (error) {
    return sendError(
      res,
      sendJson,
      400,
      "ROUTE_TEST_MATCH_FAILED",
      error.message || "路由命中测试失败"
    );
  }
}
