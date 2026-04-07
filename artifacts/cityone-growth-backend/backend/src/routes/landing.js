import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LANDING_TEMPLATES_FILE = path.join(DATA_DIR, "landing-templates.json");
const CREATIVE_BINDINGS_FILE = path.join(DATA_DIR, "creative-landing-bindings.json");

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
  } catch {
    return [];
  }
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

// ─── 落地页模板 ──────────────────────────────────────────────────────────────

function toML(v) {
  if (v && typeof v === "object" && ("zh" in v || "th" in v || "en" in v))
    return { zh: v.zh || "", th: v.th || "", en: v.en || "" };
  return { zh: typeof v === "string" ? v : "", th: "", en: "" };
}

export function handleLandingTemplateList(req, res, url, sendJson) {
  const list = loadJsonArray(LANDING_TEMPLATES_FILE);
  const page = Number(url.searchParams?.get("page") || 1);
  const pageSize = Number(url.searchParams?.get("pageSize") || 20);
  const start = (page - 1) * pageSize;
  return sendOk(res, sendJson, "landing templates loaded", {
    list: list.slice(start, start + pageSize),
    total: list.length,
  });
}

export function handleLandingTemplateGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
  const list = loadJsonArray(LANDING_TEMPLATES_FILE);
  const item = list.find((t) => t.id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");
  return sendOk(res, sendJson, "landing template loaded", item);
}

export async function handleLandingTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, sendJson, 400, "NAME_REQUIRED", "name 必填");

    const list = loadJsonArray(LANDING_TEMPLATES_FILE);
    const now = new Date().toISOString();
    const item = {
      id: nextId(list, "lt", "id"),
      name,
      templateType: String(body.templateType || "").trim(),
      title: toML(body.title),
      subTitle: toML(body.subTitle),
      benefitText: toML(body.benefitText),
      supportText: toML(body.supportText),
      buttonText: toML(body.buttonText),
      coverImage: body.coverImage || "",
      autoAction: body.autoAction || "open_welfare",
      targetActivityId: body.targetActivityId || "",
      targetProductId: body.targetProductId || "",
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    list.push(item);
    saveJsonArray(LANDING_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "landing template created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleLandingTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "id 必填");

    const body = await readBody(req);
    const list = loadJsonArray(LANDING_TEMPLATES_FILE);
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");

    const prev = list[idx];
    const updated = {
      ...prev,
      name: body.name !== undefined ? String(body.name).trim() : prev.name,
      templateType: body.templateType !== undefined ? String(body.templateType).trim() : prev.templateType,
      title: body.title !== undefined ? toML(body.title) : prev.title,
      subTitle: body.subTitle !== undefined ? toML(body.subTitle) : prev.subTitle,
      benefitText: body.benefitText !== undefined ? toML(body.benefitText) : prev.benefitText,
      supportText: body.supportText !== undefined ? toML(body.supportText) : prev.supportText,
      buttonText: body.buttonText !== undefined ? toML(body.buttonText) : prev.buttonText,
      coverImage: body.coverImage !== undefined ? body.coverImage : prev.coverImage,
      autoAction: body.autoAction !== undefined ? body.autoAction : prev.autoAction,
      targetActivityId: body.targetActivityId !== undefined ? body.targetActivityId : prev.targetActivityId,
      targetProductId: body.targetProductId !== undefined ? body.targetProductId : prev.targetProductId,
      enabled: body.enabled !== undefined ? !!body.enabled : prev.enabled,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    saveJsonArray(LANDING_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "landing template updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

export function handleLandingTemplateDelete(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
  if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "id 必填");
  const list = loadJsonArray(LANDING_TEMPLATES_FILE);
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");
  list.splice(idx, 1);
  saveJsonArray(LANDING_TEMPLATES_FILE, list);
  return sendOk(res, sendJson, "landing template deleted", { id });
}

// ─── 创意-落地页绑定 ─────────────────────────────────────────────────────────

export function handleCreativeBindingList(req, res, url, sendJson) {
  const list = loadJsonArray(CREATIVE_BINDINGS_FILE);
  return sendOk(res, sendJson, "creative bindings loaded", list);
}

export async function handleCreativeBindingCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const creativeId = String(body.creative_id || "").trim();
    const landingTemplateId = String(body.landing_template_id || "").trim();
    if (!creativeId) return sendError(res, sendJson, 400, "CREATIVE_ID_REQUIRED", "creative_id 必填");
    if (!landingTemplateId) return sendError(res, sendJson, 400, "LANDING_TEMPLATE_ID_REQUIRED", "landing_template_id 必填");

    const list = loadJsonArray(CREATIVE_BINDINGS_FILE);
    const now = new Date().toISOString();

    const item = {
      binding_id: nextId(list, "clb", "binding_id"),
      creative_id: creativeId,
      creative_theme: body.creative_theme || "",
      landing_template_id: landingTemplateId,
      target_channel: body.target_channel || "",
      audience_type: body.audience_type || "",
      utm_source: body.utm_source || "",
      utm_campaign: body.utm_campaign || "",
      status: "enabled",
      created_at: now,
      updated_at: now,
    };

    list.push(item);
    saveJsonArray(CREATIVE_BINDINGS_FILE, list);
    return sendOk(res, sendJson, "creative binding created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

// ─── 关注成功自动动作分发 ─────────────────────────────────────────────────────

export async function handleFollowSuccessDispatch(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const lineUserId = String(body.line_user_id || "").trim();
    const landingTemplateId = String(body.landing_template_id || "").trim();

    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    const templates = loadJsonArray(LANDING_TEMPLATES_FILE);
    const template = landingTemplateId
      ? templates.find((t) => t.template_id === landingTemplateId && t.status === "enabled")
      : null;

    // 默认动作：打开福利中心
    let actionType = "open_welfare_home";
    let targetPage = "/welfare";
    let targetId = "";
    const claimedProductIds = [];

    if (template) {
      const action = template.follow_success_action;

      if (template.auto_claim_reward && template.target_product_id) {
        claimedProductIds.push(template.target_product_id);
        actionType = "claim_reward";
        targetId = template.target_product_id;
        targetPage = `/products/${template.target_product_id}`;
      } else if (action === "auto_join_activity" || template.auto_join_activity) {
        actionType = "join_activity";
        targetId = template.target_activity_id;
        targetPage = `/activities/${template.target_activity_id}`;
      } else if (action === "auto_open_nearby" || template.auto_open_nearby) {
        actionType = "open_nearby";
        targetPage = "/nearby";
      } else if (template.target_page) {
        actionType = "open_page";
        targetPage = template.target_page;
      }
    }

    return sendOk(res, sendJson, "follow success dispatched", {
      action_type: actionType,
      target_page: targetPage,
      target_id: targetId,
      claimed_product_ids: claimedProductIds,
      dispatched_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DISPATCH_FAILED", err.message || "分发失败");
  }
}
