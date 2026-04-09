import { query, withTransaction } from "../db/pool.js";

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function templateCodeFromPath(pathname) {
  return pathname.match(/^\/api\/entries\/templates\/([^/]+)(?:\/(update|delete))?$/)?.[1] || "";
}
function entryCodeFromPath(pathname) {
  return pathname.match(/^\/api\/entries\/([^/]+)(?:\/(update|disable))?$/)?.[1] || "";
}

// ─── 入口模板 ────────────────────────────────────────────────────────────────

export async function handleEntryTemplateList(req, res, url, sendJson) {
  const { rows } = await query(
    "SELECT * FROM entry_templates ORDER BY id ASC"
  );
  return sendOk(res, sendJson, "entry templates loaded", rows);
}

export async function handleEntryTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const defaultFeatureName = String(body.default_feature_name || "").trim();

    if (!templateName) return sendError(res, sendJson, 400, "TEMPLATE_NAME_REQUIRED", "template_name 必填");
    if (!entryType) return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    if (!defaultFeatureName) return sendError(res, sendJson, 400, "DEFAULT_FEATURE_REQUIRED", "default_feature_name 必填");

    const { rows: existing } = await query(
      "SELECT id FROM entry_templates WHERE LOWER(template_name)=LOWER($1) AND entry_type=$2",
      [templateName, entryType]
    );
    if (existing.length > 0)
      return sendError(res, sendJson, 400, "ENTRY_TEMPLATE_DUPLICATED", "同一入口类型下已存在同名模板");

    const { rows: existing2 } = await query("SELECT template_code FROM entry_templates ORDER BY id DESC LIMIT 1", []);
    const lastNum = existing2.length > 0
      ? parseInt((existing2[0].template_code || "tpl_000").replace("tpl_", "")) || 0
      : 0;
    const templateCode = `tpl_${String(lastNum + 1).padStart(3, "0")}`;

    const { rows } = await query(
      `INSERT INTO entry_templates (template_code, template_name, entry_type, default_feature_name, status)
       VALUES ($1,$2,$3,$4,'enabled') RETURNING *`,
      [templateCode, templateName, entryType, defaultFeatureName]
    );
    return sendOk(res, sendJson, "entry template created", rows[0]);
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_TEMPLATE_CREATE_FAILED", err.message || "入口模板创建失败");
  }
}

export async function handleEntryTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const templateCode = String(templateCodeFromPath(url.pathname) || "").trim();
    if (!templateCode) return sendError(res, sendJson, 400, "TEMPLATE_ID_REQUIRED", "template_id 必填");

    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const defaultFeatureName = String(body.default_feature_name || "").trim();

    if (!templateName) return sendError(res, sendJson, 400, "TEMPLATE_NAME_REQUIRED", "template_name 必填");
    if (!entryType) return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    if (!defaultFeatureName) return sendError(res, sendJson, 400, "DEFAULT_FEATURE_REQUIRED", "default_feature_name 必填");

    const { rows: found } = await query("SELECT id FROM entry_templates WHERE template_code=$1", [templateCode]);
    if (found.length === 0) return sendError(res, sendJson, 404, "ENTRY_TEMPLATE_NOT_FOUND", "未找到对应入口模板");

    const { rows: dup } = await query(
      "SELECT id FROM entry_templates WHERE LOWER(template_name)=LOWER($1) AND entry_type=$2 AND template_code<>$3",
      [templateName, entryType, templateCode]
    );
    if (dup.length > 0) return sendError(res, sendJson, 400, "ENTRY_TEMPLATE_DUPLICATED", "同一入口类型下已存在同名模板");

    const { rows } = await query(
      `UPDATE entry_templates SET template_name=$1, entry_type=$2, default_feature_name=$3, updated_at=NOW()
       WHERE template_code=$4 RETURNING *`,
      [templateName, entryType, defaultFeatureName, templateCode]
    );
    return sendOk(res, sendJson, "entry template updated", rows[0]);
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_TEMPLATE_UPDATE_FAILED", err.message || "入口模板更新失败");
  }
}

export async function handleEntryTemplateDelete(req, res, url, sendJson) {
  try {
    const templateCode = String(templateCodeFromPath(url.pathname) || "").trim();
    if (!templateCode) return sendError(res, sendJson, 400, "TEMPLATE_ID_REQUIRED", "template_id 必填");

    const { rows } = await query(
      "DELETE FROM entry_templates WHERE template_code=$1 RETURNING *",
      [templateCode]
    );
    if (rows.length === 0) return sendError(res, sendJson, 404, "ENTRY_TEMPLATE_NOT_FOUND", "未找到对应入口模板");
    return sendOk(res, sendJson, "entry template deleted", rows[0]);
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_TEMPLATE_DELETE_FAILED", err.message || "入口模板删除失败");
  }
}

// ─── 入口实例 ────────────────────────────────────────────────────────────────

export async function handleEntryInstanceList(req, res, url, sendJson) {
  const { rows } = await query(
    "SELECT * FROM entry_instances ORDER BY sort_order ASC, id ASC"
  );
  // 前端兼容：映射字段名
  const mapped = rows.map(r => ({
    entry_id: r.entry_code,
    site_id: r.site_id,
    site_name: r.site_name,
    entry_type: r.entry_type,
    entry_code: r.entry_qr_code,
    current_feature_name: r.current_feature_name,
    status: r.status,
    landing_code: r.landing_code,
    default_activity_code: r.default_activity_code,
    device_code: r.device_code,
    a_system_device_id: r.a_system_device_id,
    source_channel_id: r.source_channel_id,
    sort_order: r.sort_order,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  return sendOk(res, sendJson, "entry instances loaded", mapped);
}

export async function handleEntryInstanceCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const siteId = String(body.site_id || "").trim();
    const siteName = String(body.site_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryQrCode = String(body.entry_code || "").trim();

    if (!siteId) return sendError(res, sendJson, 400, "SITE_ID_REQUIRED", "site_id 必填");
    if (!siteName) return sendError(res, sendJson, 400, "SITE_NAME_REQUIRED", "site_name 必填");
    if (!entryType) return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    if (!entryQrCode) return sendError(res, sendJson, 400, "ENTRY_CODE_REQUIRED", "entry_code 必填");

    const { rows: dup } = await query(
      "SELECT id FROM entry_instances WHERE entry_type=$1 AND LOWER(entry_qr_code)=LOWER($2)",
      [entryType, entryQrCode]
    );
    if (dup.length > 0) return sendError(res, sendJson, 400, "ENTRY_INSTANCE_DUPLICATED", "同一入口类型下入口编码已存在");

    const { rows: last } = await query("SELECT entry_code FROM entry_instances ORDER BY id DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].entry_code || "entry_000").replace("entry_", "")) || 0
      : 0;
    const entryCode = `entry_${String(lastNum + 1).padStart(3, "0")}`;

    const currentFeatureName = entryType === "device_qr" ? "battery_sos" : "shake";
    const { rows } = await query(
      `INSERT INTO entry_instances
         (entry_code, site_id, site_name, entry_type, entry_qr_code, current_feature_name, status,
          landing_code, default_activity_code, device_code, a_system_device_id, source_channel_id)
       VALUES ($1,$2,$3,$4,$5,$6,'enabled',$7,$8,$9,$10,$11) RETURNING *`,
      [
        entryCode, siteId, siteName, entryType, entryQrCode, currentFeatureName,
        body.landing_code || "", body.default_activity_code || "",
        body.device_code || "", body.a_system_device_id || "", body.source_channel_id || "",
      ]
    );
    const r = rows[0];
    return sendOk(res, sendJson, "entry instance created", {
      entry_id: r.entry_code, site_id: r.site_id, site_name: r.site_name,
      entry_type: r.entry_type, entry_code: r.entry_qr_code,
      current_feature_name: r.current_feature_name, status: r.status,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_INSTANCE_CREATE_FAILED", err.message || "入口实例创建失败");
  }
}

export async function handleEntryInstanceUpdate(req, res, url, sendJson, readBody) {
  try {
    const entryCode = String(entryCodeFromPath(url.pathname) || "").trim();
    if (!entryCode) return sendError(res, sendJson, 400, "ENTRY_ID_REQUIRED", "entry_id 必填");

    const body = await readBody(req);
    const siteId = String(body.site_id || "").trim();
    const siteName = String(body.site_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryQrCode = String(body.entry_code || "").trim();

    if (!siteId) return sendError(res, sendJson, 400, "SITE_ID_REQUIRED", "site_id 必填");
    if (!siteName) return sendError(res, sendJson, 400, "SITE_NAME_REQUIRED", "site_name 必填");
    if (!entryType) return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    if (!entryQrCode) return sendError(res, sendJson, 400, "ENTRY_CODE_REQUIRED", "entry_code 必填");

    const { rows: found } = await query("SELECT id FROM entry_instances WHERE entry_code=$1", [entryCode]);
    if (found.length === 0) return sendError(res, sendJson, 404, "ENTRY_INSTANCE_NOT_FOUND", "未找到对应入口实例");

    const { rows: dup } = await query(
      "SELECT id FROM entry_instances WHERE entry_type=$1 AND LOWER(entry_qr_code)=LOWER($2) AND entry_code<>$3",
      [entryType, entryQrCode, entryCode]
    );
    if (dup.length > 0) return sendError(res, sendJson, 400, "ENTRY_INSTANCE_DUPLICATED", "同一入口类型下入口编码已存在");

    const cfn = String(body.current_feature_name || "").trim()
      || (entryType === "device_qr" ? "battery_sos" : "shake");

    const { rows } = await query(
      `UPDATE entry_instances SET
         site_id=$1, site_name=$2, entry_type=$3, entry_qr_code=$4,
         current_feature_name=$5, landing_code=$6, default_activity_code=$7, updated_at=NOW()
       WHERE entry_code=$8 RETURNING *`,
      [siteId, siteName, entryType, entryQrCode, cfn,
       body.landing_code || "", body.default_activity_code || "", entryCode]
    );
    const r = rows[0];
    return sendOk(res, sendJson, "entry instance updated", {
      entry_id: r.entry_code, site_id: r.site_id, site_name: r.site_name,
      entry_type: r.entry_type, entry_code: r.entry_qr_code,
      current_feature_name: r.current_feature_name, status: r.status,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_INSTANCE_UPDATE_FAILED", err.message || "入口实例更新失败");
  }
}

export async function handleEntryInstanceDisable(req, res, url, sendJson) {
  try {
    const entryCode = String(entryCodeFromPath(url.pathname) || "").trim();
    if (!entryCode) return sendError(res, sendJson, 400, "ENTRY_ID_REQUIRED", "entry_id 必填");

    const { rows } = await query(
      "UPDATE entry_instances SET status='disabled', updated_at=NOW() WHERE entry_code=$1 RETURNING *",
      [entryCode]
    );
    if (rows.length === 0) return sendError(res, sendJson, 404, "ENTRY_INSTANCE_NOT_FOUND", "未找到对应入口实例");
    const r = rows[0];
    return sendOk(res, sendJson, "entry instance disabled", {
      entry_id: r.entry_code, status: r.status,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "ENTRY_INSTANCE_DISABLE_FAILED", err.message || "入口实例停用失败");
  }
}

export async function handleQrAssetList(req, res, url, sendJson) {
  const { rows } = await query(
    "SELECT * FROM entry_instances ORDER BY sort_order ASC, id ASC"
  );
  const data = rows.map((r, index) => ({
    qr_id: `qr_${String(r.id).padStart(3, "0")}`,
    entry_id: r.entry_code,
    site_id: r.site_id,
    site_name: r.site_name,
    entry_type: r.entry_type,
    entry_code: r.entry_qr_code,
    qr_scene: r.entry_type === "device_qr" ? "设备固定码" : "站点固定码",
    short_link: `https://city.one/e/${r.entry_qr_code}`,
    current_route_rule_id: r.entry_type === "device_qr" ? "route_002" : "route_001",
    current_feature_name: r.current_feature_name,
    status: r.status,
    print_batch_no: `batch_${r.entry_qr_code}`,
    last_scan_at: "2026-04-01 10:05:00",
    total_scan_count: 100 + index * 25,
  }));
  return sendOk(res, sendJson, "qr assets loaded", data);
}
