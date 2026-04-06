import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const ACTIVITY_TEMPLATES_FILE = path.join(DATA_DIR, "activity-templates.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");
const ACTIVITY_PRODUCT_BINDINGS_FILE = path.join(DATA_DIR, "activity-product-bindings.json");

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadJsonArray(filePath) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveJsonArray(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
function nextId(list, prefix, field) {
  const max = list.reduce((m, item) => {
    const matched = String(item[field] || "").match(new RegExp(`^${prefix}_(\\d+)$`));
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
}
function idFromPath(pathname, pattern) {
  return pathname.match(pattern)?.[1] || "";
}

// ─── 活动模板 ────────────────────────────────────────────────────────────────

const VALID_ACTIVITY_TYPES = [
  "general", "sos", "lightning_coupon", "lucky_wheel", "scratch_card", "thai_fortune_draw", "invite_reward"
];

export function handleActivityTemplateGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/activity-templates\/([^/]+)$/);
  const list = loadJsonArray(ACTIVITY_TEMPLATES_FILE);
  const item = list.find((t) => t.template_id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动模板");
  return sendOk(res, sendJson, "activity template loaded", item);
}

export async function handleActivityTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const activityType = String(body.activity_type || "").trim();
    if (!templateName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "template_name 必填");
    if (!VALID_ACTIVITY_TYPES.includes(activityType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `activity_type 必须是: ${VALID_ACTIVITY_TYPES.join(" | ")}`);

    const list = loadJsonArray(ACTIVITY_TEMPLATES_FILE);
    const now = new Date().toISOString();
    const item = {
      template_id: nextId(list, "at", "template_id"),
      template_name: templateName,
      activity_type: activityType,
      header_json: body.header_json || null,
      media_assets_json: body.media_assets_json || null,
      intro_block_json: body.intro_block_json || null,
      steps_block_json: body.steps_block_json || null,
      reward_block_json: body.reward_block_json || null,
      notice_block_json: body.notice_block_json || null,
      cta_block_json: body.cta_block_json || null,
      status: "enabled",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(ACTIVITY_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "activity template created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleActivityTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activity-templates\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "template_id 必填");
    const body = await readBody(req);
    const list = loadJsonArray(ACTIVITY_TEMPLATES_FILE);
    const idx = list.findIndex((t) => t.template_id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动模板");

    const updatableFields = [
      "template_name","activity_type","header_json","media_assets_json","intro_block_json",
      "steps_block_json","reward_block_json","notice_block_json","cta_block_json","status",
    ];
    const updated = { ...list[idx] };
    for (const f of updatableFields) {
      if (body[f] !== undefined) updated[f] = body[f];
    }
    updated.updated_at = new Date().toISOString();
    list[idx] = updated;
    saveJsonArray(ACTIVITY_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "activity template updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

// ─── 活动实例 ────────────────────────────────────────────────────────────────

export function handleActivityList(req, res, url, sendJson) {
  const list = loadJsonArray(ACTIVITIES_FILE);
  const activityType = url.searchParams.get("activity_type");
  const status = url.searchParams.get("status");
  let result = list;
  if (activityType) result = result.filter((a) => a.activity_type === activityType);
  if (status) result = result.filter((a) => a.status === status);
  return sendOk(res, sendJson, "activities loaded", result);
}

export function handleActivityGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
  const list = loadJsonArray(ACTIVITIES_FILE);
  const item = list.find((a) => a.activity_id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
  return sendOk(res, sendJson, "activity loaded", item);
}

export async function handleActivityCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityName = String(body.activity_name || "").trim();
    const activityType = String(body.activity_type || "").trim();
    if (!activityName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "activity_name 必填");
    if (!VALID_ACTIVITY_TYPES.includes(activityType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `activity_type 必须是: ${VALID_ACTIVITY_TYPES.join(" | ")}`);

    const list = loadJsonArray(ACTIVITIES_FILE);
    const now = new Date().toISOString();
    const item = {
      activity_id: nextId(list, "act", "activity_id"),
      activity_type: activityType,
      activity_name: activityName,
      activity_title: body.activity_title || "",
      activity_subtitle: body.activity_subtitle || "",
      activity_desc: body.activity_desc || "",
      template_id: body.template_id || "",
      usage_mode: body.usage_mode || "public",
      start_time: body.start_time || "",
      end_time: body.end_time || "",
      status: ["draft", "active", "ended"].includes(body.status) ? body.status : "draft",
      require_oa_follow: !!body.require_oa_follow,
      auto_join_after_follow: !!body.auto_join_after_follow,
      entry_scope_json: body.entry_scope_json || null,
      site_scope_json: body.site_scope_json || null,
      channel_scope_json: body.channel_scope_json || null,
      share_content_type: "activity",
      share_enabled: !!body.share_enabled,
      share_title: body.share_title || "",
      share_desc: body.share_desc || "",
      share_cover: body.share_cover || "",
      campaign_id: body.campaign_id || "",
      share_status: body.share_status || "disabled",
      goal: body.goal || "",
      department: body.department || "",
      owner_dept: body.owner_dept || "",
      partner_dept: body.partner_dept || "",
      coupon_name: body.coupon_name || "",
      highlights: body.highlights || "",
      participation_guide: body.participation_guide || "",
      reward_guide: body.reward_guide || "",
      notice_text: body.notice_text || "",
      cover_image: body.cover_image || "",
      cover_video: body.cover_video || "",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(ACTIVITIES_FILE, list);
    return sendOk(res, sendJson, "activity created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleActivityUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "activity_id 必填");
    const body = await readBody(req);
    const list = loadJsonArray(ACTIVITIES_FILE);
    const idx = list.findIndex((a) => a.activity_id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");

    const updatableFields = [
      "activity_name","activity_title","activity_subtitle","activity_desc","template_id",
      "usage_mode","start_time","end_time","status","require_oa_follow","auto_join_after_follow",
      "entry_scope_json","site_scope_json","channel_scope_json",
      "share_enabled","share_title","share_desc","share_cover","campaign_id","share_status",
      "goal","department","owner_dept","partner_dept","coupon_name",
      "highlights","participation_guide","reward_guide","notice_text","cover_image","cover_video",
    ];
    const updated = { ...list[idx] };
    for (const f of updatableFields) {
      if (body[f] !== undefined) updated[f] = body[f];
    }
    updated.updated_at = new Date().toISOString();
    list[idx] = updated;
    saveJsonArray(ACTIVITIES_FILE, list);
    return sendOk(res, sendJson, "activity updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

// ─── 活动与商品绑定 ──────────────────────────────────────────────────────────

const VALID_BINDING_TYPES = [
  "reward_preview", "reward_delivery", "unlock_after_event", "related_recommendation"
];

export function handleActivityProductBindingList(req, res, url, sendJson) {
  const activityId = url.searchParams.get("activityId");
  const list = loadJsonArray(ACTIVITY_PRODUCT_BINDINGS_FILE);
  const result = activityId ? list.filter((b) => b.activity_id === activityId) : list;
  return sendOk(res, sendJson, "activity product bindings loaded", result);
}

export async function handleActivityProductBindingCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const productId = String(body.product_id || "").trim();
    const bindingType = String(body.binding_type || "").trim();

    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!productId) return sendError(res, sendJson, 400, "PRODUCT_ID_REQUIRED", "product_id 必填");
    if (!VALID_BINDING_TYPES.includes(bindingType))
      return sendError(res, sendJson, 400, "BINDING_TYPE_INVALID", `binding_type 必须是: ${VALID_BINDING_TYPES.join(" | ")}`);

    const list = loadJsonArray(ACTIVITY_PRODUCT_BINDINGS_FILE);
    const now = new Date().toISOString();
    const item = {
      binding_id: nextId(list, "apb", "binding_id"),
      activity_id: activityId,
      product_id: productId,
      binding_type: bindingType,
      trigger_event: body.trigger_event || "",
      user_scope: body.user_scope || "all",
      sort_no: Number(body.sort_no || 0),
      status: "enabled",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(ACTIVITY_PRODUCT_BINDINGS_FILE, list);
    return sendOk(res, sendJson, "activity product binding created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export function handleActivityDelete(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
  if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少活动ID");
  const list = loadJsonArray(ACTIVITIES_FILE);
  const idx = list.findIndex((a) => a.activity_id === id);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
  list.splice(idx, 1);
  saveJsonArray(ACTIVITIES_FILE, list);
  return sendOk(res, sendJson, "活动已删除", null);
}
