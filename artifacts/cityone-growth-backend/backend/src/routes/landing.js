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

export function handleLandingTemplateGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
  const list = loadJsonArray(LANDING_TEMPLATES_FILE);
  const item = list.find((t) => t.template_id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");
  return sendOk(res, sendJson, "landing template loaded", item);
}

export async function handleLandingTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const templateType = String(body.template_type || "").trim();

    if (!templateName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "template_name 必填");

    const VALID_TYPES = ["solution", "welcome_gift", "limited_offer", "nearby_available"];
    if (!VALID_TYPES.includes(templateType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `template_type 必须是: ${VALID_TYPES.join(" | ")}`);

    const list = loadJsonArray(LANDING_TEMPLATES_FILE);
    const now = new Date().toISOString();

    const item = {
      template_id: nextId(list, "lt", "template_id"),
      template_name: templateName,
      template_type: templateType,
      title_zh: body.title_zh || "",
      title_th: body.title_th || "",
      title_en: body.title_en || "",
      sub_title_zh: body.sub_title_zh || "",
      sub_title_th: body.sub_title_th || "",
      sub_title_en: body.sub_title_en || "",
      benefit_text_zh: body.benefit_text_zh || "",
      benefit_text_th: body.benefit_text_th || "",
      benefit_text_en: body.benefit_text_en || "",
      support_text_zh: body.support_text_zh || "",
      support_text_th: body.support_text_th || "",
      support_text_en: body.support_text_en || "",
      hero_image: body.hero_image || "",
      hero_video: body.hero_video || "",
      primary_cta_text_zh: body.primary_cta_text_zh || "",
      primary_cta_text_th: body.primary_cta_text_th || "",
      primary_cta_text_en: body.primary_cta_text_en || "",
      primary_cta_action: "follow_oa",
      follow_success_action: body.follow_success_action || "auto_open_welfare_home",
      target_activity_id: body.target_activity_id || "",
      target_product_id: body.target_product_id || "",
      target_page: body.target_page || "",
      auto_claim_reward: !!body.auto_claim_reward,
      auto_join_activity: !!body.auto_join_activity,
      auto_open_nearby: !!body.auto_open_nearby,
      auto_open_welfare_home: !!body.auto_open_welfare_home,
      status: "enabled",
      created_at: now,
      updated_at: now,
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
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "template_id 必填");

    const body = await readBody(req);
    const list = loadJsonArray(LANDING_TEMPLATES_FILE);
    const idx = list.findIndex((t) => t.template_id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");

    const VALID_TYPES = ["solution", "welcome_gift", "limited_offer", "nearby_available"];
    const templateType = body.template_type ? String(body.template_type).trim() : list[idx].template_type;
    if (!VALID_TYPES.includes(templateType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `template_type 必须是: ${VALID_TYPES.join(" | ")}`);

    const fields = [
      "template_name","template_type","title_zh","title_th","title_en",
      "sub_title_zh","sub_title_th","sub_title_en","benefit_text_zh","benefit_text_th","benefit_text_en",
      "support_text_zh","support_text_th","support_text_en","hero_image","hero_video",
      "primary_cta_text_zh","primary_cta_text_th","primary_cta_text_en",
      "follow_success_action","target_activity_id","target_product_id","target_page",
      "auto_claim_reward","auto_join_activity","auto_open_nearby","auto_open_welfare_home","status",
    ];

    const updated = { ...list[idx] };
    for (const f of fields) {
      if (body[f] !== undefined) updated[f] = body[f];
    }
    updated.updated_at = new Date().toISOString();
    list[idx] = updated;
    saveJsonArray(LANDING_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "landing template updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
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
