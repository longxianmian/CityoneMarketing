import { query } from "../db/pool.js";
import { resolveOssUrl, normalizeManagedAssetRef } from "../services/ossService.js";

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function requireAdmin(req, res, sendJson) {
  if (!req._admin) { sendError(res, sendJson, 401, "UNAUTH", "未登录"); return null; }
  return req._admin;
}
function generateBannerCode() {
  return "bn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}
function toML(v) {
  if (!v) return { zh: "", th: "", en: "" };
  if (typeof v === "object" && ("zh" in v || "th" in v || "en" in v))
    return { zh: v.zh || "", th: v.th || "", en: v.en || "" };
  return { zh: typeof v === "string" ? v : "", th: "", en: "" };
}
function rowToClient(r) {
  return {
    id: r.banner_code,
    title: r.title || { zh: "", th: "", en: "" },
    sub_title: r.sub_title || { zh: "", th: "", en: "" },
    image_url: resolveOssUrl(r.image_url),
    position_key: r.position_key,
    jump_type: r.jump_type,
    jump_target_id: r.jump_target_id,
    jump_target_type: r.jump_target_type,
    link_type: r.link_type,
    link_url: r.link_url,
    landing_code: r.landing_code,
    activity_code: r.activity_code,
    enabled: r.enabled,
    sort_order: r.sort_order,
    start_at: r.start_at,
    end_at: r.end_at,
    source_entry_id: r.source_entry_id,
    source_channel_id: r.source_channel_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/growth/banners
export async function handleGetBanners(req, res, sendJson, url) {
  try {
    const onlyEnabled = url.searchParams.get("enabled") === "true";
    const positionKey = url.searchParams.get("position_key") || "";
    let sql = "SELECT * FROM banners";
    const params = [];
    const where = [];
    if (onlyEnabled) { where.push("enabled = TRUE"); }
    if (positionKey) { params.push(positionKey); where.push(`position_key = $${params.length}`); }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY sort_order ASC, id ASC";

    const { rows } = await query(sql, params);
    const list = rows.map(rowToClient);
    return sendOk(res, sendJson, "ok", { list, total: list.length });
  } catch (err) {
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "DB_ERROR", err.message);
  }
}

// ─── 内部：校验跳转目标存在性 ─────────────────────────────────────────────────
async function validateJumpTargets(res, sendJson, landingCode, activityCode) {
  if (landingCode) {
    const { rows } = await query("SELECT id FROM landing_pages WHERE landing_code=$1", [landingCode]);
    if (rows.length === 0)
      return sendError(res, sendJson, 422, "LANDING_NOT_FOUND", `landing_code "${landingCode}" 不存在，请先创建落地页`);
  }
  if (activityCode) {
    const { rows } = await query("SELECT activity_id FROM activities WHERE activity_id=$1", [activityCode]);
    if (rows.length === 0)
      return sendError(res, sendJson, 422, "ACTIVITY_NOT_FOUND", `activity_code "${activityCode}" 不存在，请先创建活动`);
  }
  return null;
}

// POST /api/growth/banners
export async function handleCreateBanner(req, res, sendJson, body) {
  if (!requireAdmin(req, res, sendJson)) return;
  try {
    // Task 4: 跳转目标有效性校验
    const validErr = await validateJumpTargets(res, sendJson, body.landing_code || "", body.activity_code || "");
    if (validErr !== null) return;

    const { rows: last } = await query("SELECT COUNT(*) as cnt FROM banners", []);
    const cnt = parseInt(last[0]?.cnt || "0");
    const bannerCode = generateBannerCode();
    const { rows } = await query(
      `INSERT INTO banners
         (banner_code, title, sub_title, image_url, position_key, jump_type, jump_target_id, jump_target_type,
          link_type, link_url, landing_code, activity_code, enabled, sort_order, start_at, end_at,
          source_entry_id, source_channel_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        bannerCode,
        JSON.stringify(toML(body.title)),
        JSON.stringify(toML(body.sub_title)),
        normalizeManagedAssetRef(body.image_url, "image_url") || "",
        body.position_key || "home_top",
        body.jump_type || body.link_type || "external",
        body.jump_target_id || "",
        body.jump_target_type || "",
        body.link_type || "external",
        body.link_url || "",
        body.landing_code || "",
        body.activity_code || "",
        body.enabled !== false,
        body.sort_order != null ? Number(body.sort_order) : cnt,
        body.start_at ? new Date(body.start_at) : null,
        body.end_at ? new Date(body.end_at) : null,
        body.source_entry_id || "",
        body.source_channel_id || "",
      ]
    );
    return sendOk(res, sendJson, "created", rowToClient(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "DB_ERROR", err.message);
  }
}

// PUT /api/growth/banners/:id
export async function handleUpdateBanner(req, res, sendJson, body, bannerId) {
  if (!requireAdmin(req, res, sendJson)) return;
  try {
    const { rows: found } = await query("SELECT id FROM banners WHERE banner_code=$1", [bannerId]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Banner not found");

    // Task 4: 跳转目标有效性校验（仅当字段出现在请求中时才校验）
    const landingToCheck  = body.landing_code  !== undefined ? body.landing_code  : "";
    const activityToCheck = body.activity_code !== undefined ? body.activity_code : "";
    const validErr = await validateJumpTargets(res, sendJson, landingToCheck, activityToCheck);
    if (validErr !== null) return;

    const { rows } = await query(
      `UPDATE banners SET
         title = COALESCE($1, title),
         sub_title = COALESCE($2, sub_title),
         image_url = COALESCE($3, image_url),
         position_key = COALESCE($4, position_key),
         jump_type = COALESCE($5, jump_type),
         jump_target_id = COALESCE($6, jump_target_id),
         jump_target_type = COALESCE($7, jump_target_type),
         link_type = COALESCE($8, link_type),
         link_url = COALESCE($9, link_url),
         landing_code = COALESCE($10, landing_code),
         activity_code = COALESCE($11, activity_code),
         enabled = COALESCE($12, enabled),
         sort_order = COALESCE($13, sort_order),
         start_at = $14,
         end_at = $15,
         updated_at = NOW()
       WHERE banner_code=$16 RETURNING *`,
      [
        body.title !== undefined ? JSON.stringify(toML(body.title)) : null,
        body.sub_title !== undefined ? JSON.stringify(toML(body.sub_title)) : null,
        body.image_url !== undefined ? normalizeManagedAssetRef(body.image_url, "image_url") : null,
        body.position_key !== undefined ? body.position_key : null,
        body.jump_type !== undefined ? body.jump_type : null,
        body.jump_target_id !== undefined ? body.jump_target_id : null,
        body.jump_target_type !== undefined ? body.jump_target_type : null,
        body.link_type !== undefined ? body.link_type : null,
        body.link_url !== undefined ? body.link_url : null,
        body.landing_code !== undefined ? body.landing_code : null,
        body.activity_code !== undefined ? body.activity_code : null,
        body.enabled !== undefined ? !!body.enabled : null,
        body.sort_order !== undefined ? Number(body.sort_order) : null,
        body.start_at ? new Date(body.start_at) : null,
        body.end_at ? new Date(body.end_at) : null,
        bannerId,
      ]
    );
    return sendOk(res, sendJson, "updated", rowToClient(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// DELETE /api/growth/banners/:id
export async function handleDeleteBanner(req, res, sendJson, bannerId) {
  if (!requireAdmin(req, res, sendJson)) return;
  try {
    const { rows } = await query("DELETE FROM banners WHERE banner_code=$1 RETURNING id", [bannerId]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Banner not found");
    return sendOk(res, sendJson, "deleted", null);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}
