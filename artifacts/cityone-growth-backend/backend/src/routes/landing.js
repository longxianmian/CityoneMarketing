import { query } from "../db/pool.js";

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function idFromPath(pathname, pattern) {
  return pathname.match(pattern)?.[1] || "";
}
function toML(v) {
  if (!v) return { zh: "", th: "", en: "" };
  if (typeof v === "object" && ("zh" in v || "th" in v || "en" in v))
    return { zh: v.zh || "", th: v.th || "", en: v.en || "" };
  return { zh: typeof v === "string" ? v : "", th: "", en: "" };
}

function rowToClient(r) {
  return {
    id: r.landing_code,
    name: r.name,
    templateType: r.template_type,
    template_type: r.template_type,
    title: r.title || { zh: "", th: "", en: "" },
    subTitle: r.sub_title || { zh: "", th: "", en: "" },
    benefitText: r.benefit_text || { zh: "", th: "", en: "" },
    supportText: r.support_text || { zh: "", th: "", en: "" },
    buttonText: r.button_text || { zh: "", th: "", en: "" },
    primary_cta_text: r.primary_cta_text || { zh: "", th: "", en: "" },
    coverImage: r.hero_image,
    hero_image: r.hero_image,
    hero_video: r.hero_video,
    autoAction: r.primary_cta_action,
    primary_cta_action: r.primary_cta_action,
    follow_success_action: r.follow_success_action,
    targetActivityId: r.target_activity_id,
    target_activity_id: r.target_activity_id,
    targetProductId: r.target_product_id,
    target_product_id: r.target_product_id,
    target_page: r.target_page,
    auto_claim_reward: r.auto_claim_reward,
    auto_join_activity: r.auto_join_activity,
    auto_open_nearby: r.auto_open_nearby,
    auto_open_welfare_home: r.auto_open_welfare_home,
    enabled: r.status === "enabled",
    status: r.status,
    entry_code: r.entry_code,
    sort_order: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ─── 落地页 CRUD ─────────────────────────────────────────────────────────────

export async function handleLandingTemplateList(req, res, url, sendJson) {
  try {
    const page = Math.max(1, Number(url.searchParams?.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams?.get("pageSize") || 20)));
    const offset = (page - 1) * pageSize;

    const { rows: total } = await query("SELECT COUNT(*) AS cnt FROM landing_pages", []);
    const { rows } = await query(
      "SELECT * FROM landing_pages ORDER BY sort_order ASC, id ASC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    );
    return sendOk(res, sendJson, "landing templates loaded", {
      list: rows.map(rowToClient),
      total: parseInt(total[0].cnt),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleLandingTemplateGet(req, res, url, sendJson) {
  try {
    const code = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
    const { rows } = await query("SELECT * FROM landing_pages WHERE landing_code=$1", [code]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");
    return sendOk(res, sendJson, "landing template loaded", rowToClient(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleLandingTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, sendJson, 400, "NAME_REQUIRED", "name 必填");

    const { rows: last } = await query("SELECT landing_code FROM landing_pages ORDER BY id DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].landing_code || "lt_000").replace("lt_", "")) || 0
      : 0;
    const landingCode = `lt_${String(lastNum + 1).padStart(3, "0")}`;

    const { rows } = await query(
      `INSERT INTO landing_pages
         (landing_code, name, template_type, title, sub_title, benefit_text, support_text, button_text,
          primary_cta_text, hero_image, hero_video, primary_cta_action, follow_success_action,
          target_activity_id, target_product_id, target_page,
          auto_claim_reward, auto_join_activity, auto_open_nearby, auto_open_welfare_home, status,
          entry_code, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [
        landingCode, name,
        String(body.templateType || body.template_type || "").trim(),
        JSON.stringify(toML(body.title)),
        JSON.stringify(toML(body.subTitle || body.sub_title)),
        JSON.stringify(toML(body.benefitText || body.benefit_text)),
        JSON.stringify(toML(body.supportText || body.support_text)),
        JSON.stringify(toML(body.buttonText || body.button_text)),
        JSON.stringify(toML(body.primary_cta_text)),
        body.coverImage || body.hero_image || "",
        body.hero_video || "",
        body.autoAction || body.primary_cta_action || "follow_oa",
        body.follow_success_action || "open_welfare_home",
        body.targetActivityId || body.target_activity_id || "",
        body.targetProductId || body.target_product_id || "",
        body.target_page || "",
        !!body.auto_claim_reward,
        !!body.auto_join_activity,
        !!body.auto_open_nearby,
        !!body.auto_open_welfare_home,
        body.enabled !== false ? "enabled" : "disabled",
        body.entry_code || "",
        Number(body.sort_order) || 0,
      ]
    );
    return sendOk(res, sendJson, "landing template created", rowToClient(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleLandingTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const code = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
    if (!code) return sendError(res, sendJson, 400, "ID_REQUIRED", "id 必填");

    const body = await readBody(req);
    const { rows: found } = await query("SELECT id FROM landing_pages WHERE landing_code=$1", [code]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");

    const prev = (await query("SELECT * FROM landing_pages WHERE landing_code=$1", [code])).rows[0];

    const { rows } = await query(
      `UPDATE landing_pages SET
         name = $1, template_type = $2, title = $3, sub_title = $4, benefit_text = $5,
         support_text = $6, button_text = $7, primary_cta_text = $8,
         hero_image = $9, hero_video = $10, primary_cta_action = $11, follow_success_action = $12,
         target_activity_id = $13, target_product_id = $14, target_page = $15,
         auto_claim_reward = $16, auto_join_activity = $17, auto_open_nearby = $18,
         auto_open_welfare_home = $19, status = $20, entry_code = $21, sort_order = $22,
         updated_at = NOW()
       WHERE landing_code=$23 RETURNING *`,
      [
        body.name !== undefined ? String(body.name).trim() : prev.name,
        body.templateType !== undefined ? String(body.templateType).trim()
          : body.template_type !== undefined ? String(body.template_type).trim() : prev.template_type,
        body.title !== undefined ? JSON.stringify(toML(body.title)) : JSON.stringify(prev.title),
        body.subTitle !== undefined ? JSON.stringify(toML(body.subTitle))
          : body.sub_title !== undefined ? JSON.stringify(toML(body.sub_title)) : JSON.stringify(prev.sub_title),
        body.benefitText !== undefined ? JSON.stringify(toML(body.benefitText))
          : body.benefit_text !== undefined ? JSON.stringify(toML(body.benefit_text)) : JSON.stringify(prev.benefit_text),
        body.supportText !== undefined ? JSON.stringify(toML(body.supportText))
          : body.support_text !== undefined ? JSON.stringify(toML(body.support_text)) : JSON.stringify(prev.support_text),
        body.buttonText !== undefined ? JSON.stringify(toML(body.buttonText))
          : body.button_text !== undefined ? JSON.stringify(toML(body.button_text)) : JSON.stringify(prev.button_text),
        body.primary_cta_text !== undefined ? JSON.stringify(toML(body.primary_cta_text)) : JSON.stringify(prev.primary_cta_text),
        body.coverImage !== undefined ? body.coverImage : body.hero_image !== undefined ? body.hero_image : prev.hero_image,
        body.hero_video !== undefined ? body.hero_video : prev.hero_video,
        body.autoAction !== undefined ? body.autoAction
          : body.primary_cta_action !== undefined ? body.primary_cta_action : prev.primary_cta_action,
        body.follow_success_action !== undefined ? body.follow_success_action : prev.follow_success_action,
        body.targetActivityId !== undefined ? body.targetActivityId
          : body.target_activity_id !== undefined ? body.target_activity_id : prev.target_activity_id,
        body.targetProductId !== undefined ? body.targetProductId
          : body.target_product_id !== undefined ? body.target_product_id : prev.target_product_id,
        body.target_page !== undefined ? body.target_page : prev.target_page,
        body.auto_claim_reward !== undefined ? !!body.auto_claim_reward : prev.auto_claim_reward,
        body.auto_join_activity !== undefined ? !!body.auto_join_activity : prev.auto_join_activity,
        body.auto_open_nearby !== undefined ? !!body.auto_open_nearby : prev.auto_open_nearby,
        body.auto_open_welfare_home !== undefined ? !!body.auto_open_welfare_home : prev.auto_open_welfare_home,
        body.enabled !== undefined ? (body.enabled ? "enabled" : "disabled") : prev.status,
        body.entry_code !== undefined ? body.entry_code : prev.entry_code,
        body.sort_order !== undefined ? Number(body.sort_order) : prev.sort_order,
        code,
      ]
    );
    return sendOk(res, sendJson, "landing template updated", rowToClient(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

export async function handleLandingTemplateDelete(req, res, url, sendJson) {
  try {
    const code = idFromPath(url.pathname, /^\/api\/landing-templates\/([^/]+)$/);
    if (!code) return sendError(res, sendJson, 400, "ID_REQUIRED", "id 必填");
    const { rows } = await query("DELETE FROM landing_pages WHERE landing_code=$1 RETURNING landing_code", [code]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到落地页模板");
    return sendOk(res, sendJson, "landing template deleted", { id: rows[0].landing_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message || "删除失败");
  }
}

// ─── 创意-落地页绑定 ─────────────────────────────────────────────────────────

export async function handleCreativeBindingList(req, res, url, sendJson) {
  try {
    const { rows } = await query("SELECT * FROM creative_landing_bindings ORDER BY id ASC", []);
    return sendOk(res, sendJson, "creative bindings loaded", rows.map(r => ({
      binding_id: r.binding_code,
      creative_id: r.creative_id,
      creative_theme: r.creative_theme,
      landing_template_id: r.landing_code,
      target_channel: r.target_channel,
      audience_type: r.audience_type,
      utm_source: r.utm_source,
      utm_campaign: r.utm_campaign,
      status: r.status,
    })));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleCreativeBindingCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const creativeId = String(body.creative_id || "").trim();
    const landingTemplateId = String(body.landing_template_id || "").trim();
    if (!creativeId) return sendError(res, sendJson, 400, "CREATIVE_ID_REQUIRED", "creative_id 必填");
    if (!landingTemplateId) return sendError(res, sendJson, 400, "LANDING_TEMPLATE_ID_REQUIRED", "landing_template_id 必填");

    const { rows: last } = await query("SELECT binding_code FROM creative_landing_bindings ORDER BY id DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].binding_code || "clb_000").replace("clb_", "")) || 0
      : 0;
    const bindingCode = `clb_${String(lastNum + 1).padStart(3, "0")}`;

    const { rows } = await query(
      `INSERT INTO creative_landing_bindings
         (binding_code, creative_id, creative_theme, landing_code, target_channel, audience_type, utm_source, utm_campaign, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enabled') RETURNING *`,
      [
        bindingCode, creativeId, body.creative_theme || "", landingTemplateId,
        body.target_channel || "", body.audience_type || "",
        body.utm_source || "", body.utm_campaign || "",
      ]
    );
    const r = rows[0];
    return sendOk(res, sendJson, "creative binding created", {
      binding_id: r.binding_code,
      creative_id: r.creative_id,
      creative_theme: r.creative_theme,
      landing_template_id: r.landing_code,
      target_channel: r.target_channel,
      utm_source: r.utm_source,
      utm_campaign: r.utm_campaign,
      status: r.status,
    });
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

    let template = null;
    if (landingTemplateId) {
      const { rows } = await query(
        "SELECT * FROM landing_pages WHERE landing_code=$1 AND status='enabled'",
        [landingTemplateId]
      );
      template = rows[0] || null;
    }

    let actionType = "open_welfare_home";
    let targetPage = "/welfare";
    let targetId = "";
    const claimedProductIds = [];

    if (template) {
      if (template.auto_claim_reward && template.target_product_id) {
        claimedProductIds.push(template.target_product_id);
        actionType = "claim_reward";
        targetId = template.target_product_id;
        targetPage = `/products/${template.target_product_id}`;
      } else if (template.auto_join_activity) {
        actionType = "join_activity";
        targetId = template.target_activity_id;
        targetPage = `/activities/${template.target_activity_id}`;
      } else if (template.auto_open_nearby) {
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
