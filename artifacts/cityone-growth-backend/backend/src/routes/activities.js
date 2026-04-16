import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { resolveOssUrl, normalizeManagedAssetRef } from "../services/ossService.js";
import { completeMlFieldMap, normalizeMlValue, syncMlSnapshotToOss } from "../services/multilingual-service.js";

const VALID_ACTIVITY_TYPES = [
  "general", "sos", "lightning_coupon", "lucky_wheel", "scratch_card", "thai_fortune_draw", "invite_reward",
];
const VALID_BINDING_TYPES = [
  "coupon", "mall_item", "reward_preview", "reward_delivery", "unlock_after_event", "related_recommendation",
];
const GAME_ACTIVITY_TYPES = new Set(["lucky_wheel", "scratch_card", "thai_fortune_draw"]);
const ACTIVE_BINDING_STATUSES = ["1", "active", "enabled"];

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function createHttpError(statusCode, errorCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
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
// 将多语言字段安全序列化为 JSON 字符串存入 text 列
function mlStr(v) {
  if (!v) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function serializeMlText(v) {
  return JSON.stringify(normalizeMlValue(v));
}

function normalizeRewardCouponIds(rawValue) {
  const list = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
  return [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
}

function isActivityRewardReady({ activityType, rewardPoints, rewardCouponIds, gameProgramId }) {
  if (Number(rewardPoints || 0) > 0) return true;
  if (Array.isArray(rewardCouponIds) && rewardCouponIds.length > 0) return true;
  if (GAME_ACTIVITY_TYPES.has(String(activityType || "").trim()) && String(gameProgramId || "").trim()) return true;
  return false;
}

async function loadRewardBindingsMap(activityIds) {
  const ids = [...new Set((activityIds || []).map((item) => String(item || "").trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { rows } = await query(`
    SELECT
      apb.activity_code,
      apb.product_id,
      apb.status,
      apb.sort_no,
      c.name AS coupon_name
    FROM activity_product_bindings apb
    LEFT JOIN coupons c ON c.id = apb.product_id
    WHERE apb.activity_code = ANY($1::text[])
      AND apb.binding_type = 'coupon'
      AND apb.trigger_event = 'participate'
    ORDER BY apb.sort_no ASC, apb.id ASC
  `, [ids]);

  const map = new Map();
  for (const row of rows) {
    const activityId = String(row.activity_code || "").trim();
    if (!activityId) continue;
    if (!map.has(activityId)) map.set(activityId, []);
    map.get(activityId).push({
      coupon_id: String(row.product_id || "").trim(),
      coupon_name: row.coupon_name || null,
      status: String(row.status || ""),
      sort_no: Number(row.sort_no || 0),
    });
  }
  return map;
}

async function enrichActivitiesWithRewards(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];
  const bindingMap = await loadRewardBindingsMap(list.map((row) => row.activity_id));
  return list.map((row) => {
    const bindings = bindingMap.get(String(row.activity_id || "").trim()) || [];
    const enabledBindings = bindings.filter((item) => ACTIVE_BINDING_STATUSES.includes(String(item.status || "")));
    return {
      ...row,
      reward_coupon_ids: enabledBindings.map((item) => item.coupon_id),
      reward_coupon_names: enabledBindings.map((item) => item.coupon_name).filter(Boolean),
      reward_binding_count: enabledBindings.length,
      reward_ready: isActivityRewardReady({
        activityType: row.activity_type,
        rewardPoints: row.reward_points,
        rewardCouponIds: enabledBindings.map((item) => item.coupon_id),
        gameProgramId: row.game_program_id,
      }),
    };
  });
}

async function syncActivityRewardCouponBindings(client, activityId, rewardCouponIds) {
  const ids = normalizeRewardCouponIds(rewardCouponIds);

  await client.query(
    `DELETE FROM activity_product_bindings
      WHERE activity_code = $1
        AND binding_type = 'coupon'
        AND trigger_event = 'participate'`,
    [activityId]
  );

  if (ids.length === 0) return [];

  const { rows: coupons } = await client.query(
    `SELECT id, status
       FROM coupons
      WHERE id = ANY($1::text[])`,
    [ids]
  );
  const couponMap = new Map(coupons.map((row) => [String(row.id), row]));
  for (const couponId of ids) {
    const coupon = couponMap.get(couponId);
    if (!coupon) {
      throw createHttpError(400, "REWARD_COUPON_NOT_FOUND", `奖励卡券不存在：${couponId}`);
    }
    if (Number(coupon.status || 0) !== 1) {
      throw createHttpError(400, "REWARD_COUPON_DISABLED", `奖励卡券未启用：${couponId}`);
    }
  }

  const inserted = [];
  for (const [index, couponId] of ids.entries()) {
    const bindingCode = `apb_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const { rows } = await client.query(
      `INSERT INTO activity_product_bindings
         (binding_code, activity_code, product_id, binding_type, trigger_event, user_scope, sort_no, status)
       VALUES ($1,$2,$3,'coupon','participate','all',$4,'enabled')
       RETURNING *`,
      [bindingCode, activityId, couponId, index]
    );
    inserted.push(rows[0]);
  }
  return inserted;
}

async function ensureActivityRewardReadiness({ client, activityId, activityType, targetStatus, rewardPoints, rewardCouponIds, gameProgramId }) {
  if (String(targetStatus || "draft") !== "active") return;

  const normalizedRewardCouponIds = Array.isArray(rewardCouponIds)
    ? normalizeRewardCouponIds(rewardCouponIds)
    : null;

  let effectiveRewardCouponIds = normalizedRewardCouponIds;
  if (!effectiveRewardCouponIds) {
    const { rows } = await client.query(
      `SELECT product_id
         FROM activity_product_bindings
        WHERE activity_code = $1
          AND binding_type = 'coupon'
          AND trigger_event = 'participate'
          AND status::text = ANY($2::text[])`,
      [activityId, ACTIVE_BINDING_STATUSES]
    );
    effectiveRewardCouponIds = rows.map((row) => String(row.product_id || "").trim()).filter(Boolean);
  }

  if (!isActivityRewardReady({
    activityType,
    rewardPoints,
    rewardCouponIds: effectiveRewardCouponIds,
    gameProgramId,
  })) {
    throw createHttpError(
      400,
      "ACTIVITY_REWARD_REQUIRED",
      "活动上线前必须至少配置一种奖励：活动积分、奖励卡券或有效游戏方案"
    );
  }
}

function rowToActivity(r) {
  return {
    activity_id: r.activity_id,
    activity_type: r.activity_type,
    activity_name: r.activity_name || { zh: "", th: "", en: "" },
    activity_title: r.activity_title || "",
    activity_subtitle: r.activity_subtitle || "",
    activity_desc: r.activity_desc || "",
    template_id: r.template_code || "",
    usage_mode: r.usage_mode || "public",
    game_program_id: r.game_program_id || "",
    game_config: r.game_config || {},
    start_time: r.start_time || "",
    end_time: r.end_time || "",
    status: r.status || "draft",
    require_oa_follow: r.require_oa_follow || false,
    auto_join_after_follow: r.auto_join_after_follow || false,
    entry_scope_json: r.entry_scope_json || null,
    site_scope_json: r.site_scope_json || null,
    channel_scope_json: r.channel_scope_json || null,
    share_enabled: r.share_enabled || false,
    share_title: r.share_title || "",
    share_desc: r.share_desc || "",
    share_cover: resolveOssUrl(r.share_cover || ""),
    campaign_id: r.campaign_id || "",
    share_status: r.share_status || "disabled",
    goal: r.goal || "",
    department: r.department || "",
    owner_dept: r.owner_dept || "",
    partner_dept: r.partner_dept || "",
    coupon_name: r.coupon_name || "",
    highlights: r.highlights || "",
    participation_guide: r.participation_guide || "",
    reward_guide: r.reward_guide || "",
    notice_text: r.notice_text || "",
    cover_image: resolveOssUrl(r.cover_image || ""),
    cover_video: resolveOssUrl(r.cover_video || ""),
    reward_points: r.reward_points || 0,
    landing_code: r.landing_code || "",
    entry_ref_code: r.entry_ref_code || "",
    banner_code: r.banner_code || "",
    sort_order: r.sort_order || 0,
    is_featured: r.is_featured || false,
    source_entry_id: r.source_entry_id || "",
    source_banner_id: r.source_banner_id || "",
    source_channel_id: r.source_channel_id || "",
    reward_coupon_ids: Array.isArray(r.reward_coupon_ids) ? r.reward_coupon_ids : [],
    reward_coupon_names: Array.isArray(r.reward_coupon_names) ? r.reward_coupon_names : [],
    reward_binding_count: Number(r.reward_binding_count || 0),
    reward_ready: !!r.reward_ready,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ─── 活动模板 ────────────────────────────────────────────────────────────────

export async function handleActivityTemplateList(req, res, url, sendJson) {
  try {
    const { page = 1, pageSize = 20, activity_type } = Object.fromEntries(url.searchParams);
    const p = Math.max(1, Number(page));
    const ps = Math.max(1, Math.min(100, Number(pageSize)));
    const offset = (p - 1) * ps;

    let sql = "SELECT * FROM activity_templates";
    const params = [];
    if (activity_type) { params.push(activity_type); sql += ` WHERE activity_type=$${params.length}`; }
    const { rows: countRows } = await query(sql.replace("SELECT *", "SELECT COUNT(*) AS cnt"), params);
    sql += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(ps, offset);
    const { rows } = await query(sql, params);

    return sendOk(res, sendJson, "activity templates loaded", {
      list: rows.map(r => ({ ...r, template_id: r.template_code })),
      total: parseInt(countRows[0].cnt),
      page: p, pageSize: ps,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleActivityTemplateGet(req, res, url, sendJson) {
  try {
    const code = idFromPath(url.pathname, /^\/api\/activity-templates\/([^/]+)$/);
    const { rows } = await query("SELECT * FROM activity_templates WHERE template_code=$1", [code]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动模板");
    return sendOk(res, sendJson, "activity template loaded", { ...rows[0], template_id: rows[0].template_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleActivityTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const activityType = String(body.activity_type || "").trim();
    if (!templateName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "template_name 必填");
    if (!VALID_ACTIVITY_TYPES.includes(activityType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `activity_type 必须是: ${VALID_ACTIVITY_TYPES.join(" | ")}`);

    const { rows: last } = await query("SELECT template_code FROM activity_templates ORDER BY id DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].template_code || "at_000").replace("at_", "")) || 0
      : 0;
    const templateCode = `at_${String(lastNum + 1).padStart(3, "0")}`;

    const { rows } = await query(
      `INSERT INTO activity_templates
         (template_code, template_name, activity_type,
          header_json, media_assets_json, intro_block_json, steps_block_json,
          reward_block_json, notice_block_json, cta_block_json, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'enabled') RETURNING *`,
      [
        templateCode, templateName, activityType,
        body.header_json ? JSON.stringify(body.header_json) : null,
        body.media_assets_json ? JSON.stringify(body.media_assets_json) : null,
        body.intro_block_json ? JSON.stringify(body.intro_block_json) : null,
        body.steps_block_json ? JSON.stringify(body.steps_block_json) : null,
        body.reward_block_json ? JSON.stringify(body.reward_block_json) : null,
        body.notice_block_json ? JSON.stringify(body.notice_block_json) : null,
        body.cta_block_json ? JSON.stringify(body.cta_block_json) : null,
      ]
    );
    return sendOk(res, sendJson, "activity template created", { ...rows[0], template_id: rows[0].template_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleActivityTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const code = idFromPath(url.pathname, /^\/api\/activity-templates\/([^/]+)$/);
    if (!code) return sendError(res, sendJson, 400, "ID_REQUIRED", "template_id 必填");
    const body = await readBody(req);
    const { rows: found } = await query("SELECT id FROM activity_templates WHERE template_code=$1", [code]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动模板");

    const updatable = [
      "template_name", "activity_type", "header_json", "media_assets_json",
      "intro_block_json", "steps_block_json", "reward_block_json", "notice_block_json",
      "cta_block_json", "status",
    ];
    const sets = [];
    const params = [];
    for (const f of updatable) {
      if (body[f] !== undefined) {
        params.push(typeof body[f] === "object" && body[f] !== null ? JSON.stringify(body[f]) : body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    if (sets.length === 0) return sendError(res, sendJson, 400, "NO_FIELDS", "无可更新字段");
    params.push(code);
    const { rows } = await query(
      `UPDATE activity_templates SET ${sets.join(", ")}, updated_at=NOW() WHERE template_code=$${params.length} RETURNING *`,
      params
    );
    return sendOk(res, sendJson, "activity template updated", { ...rows[0], template_id: rows[0].template_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

// ─── 活动实例 ────────────────────────────────────────────────────────────────

export async function handleActivityList(req, res, url, sendJson) {
  try {
    const activityType = url.searchParams.get("activity_type");
    const status = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || 100)));

    const params = [];
    const where = [];
    if (activityType) { params.push(activityType); where.push(`activity_type=$${params.length}`); }
    if (status) { params.push(status); where.push(`status=$${params.length}`); }
    const whereClause = where.length ? " WHERE " + where.join(" AND ") : "";

    const { rows: countRows } = await query(`SELECT COUNT(*) AS cnt FROM activities${whereClause}`, params);
    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const { rows } = await query(
      `SELECT * FROM activities${whereClause} ORDER BY sort_order ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const enrichedRows = await enrichActivitiesWithRewards(rows);
    return sendOk(res, sendJson, "activities loaded", enrichedRows.map(rowToActivity));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleActivityGet(req, res, url, sendJson) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    const { rows } = await query("SELECT * FROM activities WHERE activity_id=$1", [id]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
    const [enriched] = await enrichActivitiesWithRewards(rows);
    return sendOk(res, sendJson, "activity loaded", rowToActivity(enriched || rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleActivityCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const rawName = body.activity_name;
    const activityNameStr = (typeof rawName === "object" && rawName !== null)
      ? (rawName.zh || rawName.en || rawName.th || "").trim()
      : String(rawName || "").trim();
    const activityType = String(body.activity_type || "").trim();
    if (!activityNameStr) return sendError(res, sendJson, 400, "NAME_REQUIRED", "activity_name 必填");
    if (!VALID_ACTIVITY_TYPES.includes(activityType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `activity_type 必须是: ${VALID_ACTIVITY_TYPES.join(" | ")}`);

    const { rows: last } = await query("SELECT activity_id FROM activities ORDER BY created_at DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].activity_id || "act_000").replace("act_", "")) || 0
      : 0;
    const activityId = `act_${String(lastNum + 1).padStart(3, "0")}`;

    const rewardCouponIds = normalizeRewardCouponIds(body.reward_coupon_ids);
    const translatedFields = await completeMlFieldMap({
      activity_name: body.activity_name,
      activity_subtitle: body.activity_subtitle,
      activity_desc: body.activity_desc,
      highlights: body.highlights,
      participation_guide: body.participation_guide,
      reward_guide: body.reward_guide,
      notice_text: body.notice_text,
    }, body._sourceLang || body.sourceLang || "zh");
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO activities
         (activity_id, activity_type, activity_name, activity_title, activity_subtitle, activity_desc,
          template_code, usage_mode, game_program_id, game_config, start_time, end_time, status,
          require_oa_follow, auto_join_after_follow,
          entry_scope_json, site_scope_json, channel_scope_json,
          share_enabled, share_title, share_desc, share_cover, campaign_id, share_status,
          goal, department, owner_dept, partner_dept, coupon_name,
          highlights, participation_guide, reward_guide, notice_text,
          cover_image, cover_video, reward_points, sort_order, is_featured,
          landing_code, entry_ref_code, banner_code,
          source_entry_id, source_banner_id, source_channel_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)
         RETURNING *`,
        [
          activityId, activityType, serializeMlText(translatedFields.activity_name),
          body.activity_title || "", serializeMlText(translatedFields.activity_subtitle), serializeMlText(translatedFields.activity_desc),
          body.template_id || "", body.usage_mode || "public",
          body.game_program_id || "",
          body.game_config ? JSON.stringify(body.game_config) : "{}",
          body.start_time || "", body.end_time || "",
          ["draft", "active", "ended"].includes(body.status) ? body.status : "draft",
          !!body.require_oa_follow, !!body.auto_join_after_follow,
          body.entry_scope_json ? JSON.stringify(body.entry_scope_json) : null,
          body.site_scope_json ? JSON.stringify(body.site_scope_json) : null,
          body.channel_scope_json ? JSON.stringify(body.channel_scope_json) : null,
          !!body.share_enabled, body.share_title || "", body.share_desc || "", normalizeManagedAssetRef(body.share_cover, "share_cover") || "",
          body.campaign_id || "", body.share_status || "disabled",
          body.goal || "", body.department || "", body.owner_dept || "", body.partner_dept || "",
          body.coupon_name || "", serializeMlText(translatedFields.highlights), serializeMlText(translatedFields.participation_guide),
          serializeMlText(translatedFields.reward_guide), serializeMlText(translatedFields.notice_text),
          normalizeManagedAssetRef(body.cover_image, "cover_image") || "", normalizeManagedAssetRef(body.cover_video, "cover_video") || "",
          Number(body.reward_points) || 0, Number(body.sort_order) || 0, !!body.is_featured,
          body.landing_code || "", body.entry_ref_code || "", body.banner_code || "",
          body.source_entry_id || "", body.source_banner_id || "", body.source_channel_id || "",
        ]
      );

      await syncActivityRewardCouponBindings(client, activityId, rewardCouponIds);
      await ensureActivityRewardReadiness({
        client,
        activityId,
        activityType,
        targetStatus: ["draft", "active", "ended"].includes(body.status) ? body.status : "draft",
        rewardPoints: Number(body.reward_points) || 0,
        rewardCouponIds,
        gameProgramId: body.game_program_id || "",
      });

      return rows[0];
    });
    await syncMlSnapshotToOss("activity", activityId, {
      activity_name: translatedFields.activity_name,
      activity_subtitle: translatedFields.activity_subtitle,
      activity_desc: translatedFields.activity_desc,
      highlights: translatedFields.highlights,
      participation_guide: translatedFields.participation_guide,
      reward_guide: translatedFields.reward_guide,
      notice_text: translatedFields.notice_text,
    }).catch(() => null);
    const [enriched] = await enrichActivitiesWithRewards([result]);
    return sendOk(res, sendJson, "activity created", rowToActivity(enriched || result));
  } catch (err) {
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleActivityUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "activity_id 必填");
    const body = await readBody(req);
    const { rows: found } = await query("SELECT * FROM activities WHERE activity_id=$1", [id]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
    const existing = found[0];

    const fieldMap = {
      activity_name: (v) => JSON.stringify(typeof v === "object" ? v : { zh: String(v), th: "", en: "" }),
      activity_title: (v) => String(v),
      activity_subtitle: (v) => mlStr(v),
      activity_desc: (v) => mlStr(v),
      template_id: null,
      template_code: (v) => String(v),
      game_program_id: (v) => String(v || ""),
      game_config: (v) => v ? JSON.stringify(v) : "{}",
      usage_mode: (v) => String(v), start_time: (v) => String(v), end_time: (v) => String(v),
      status: (v) => String(v),
      require_oa_follow: (v) => !!v, auto_join_after_follow: (v) => !!v,
      entry_scope_json: (v) => JSON.stringify(v), site_scope_json: (v) => JSON.stringify(v),
      channel_scope_json: (v) => JSON.stringify(v),
      share_enabled: (v) => !!v, share_title: (v) => String(v), share_desc: (v) => String(v),
      share_cover: (v) => normalizeManagedAssetRef(String(v), "share_cover"), campaign_id: (v) => String(v), share_status: (v) => String(v),
      goal: (v) => String(v), department: (v) => String(v), owner_dept: (v) => String(v),
      partner_dept: (v) => String(v), coupon_name: (v) => String(v),
      highlights: (v) => mlStr(v),
      participation_guide: (v) => mlStr(v),
      reward_guide: (v) => mlStr(v),
      notice_text: (v) => mlStr(v),
      cover_image: (v) => normalizeManagedAssetRef(String(v), "cover_image"), cover_video: (v) => normalizeManagedAssetRef(String(v), "cover_video"),
      reward_points: (v) => Number(v) || 0,
      landing_code: (v) => String(v), entry_ref_code: (v) => String(v), banner_code: (v) => String(v),
      sort_order: (v) => Number(v) || 0, is_featured: (v) => !!v,
    };

    const rewardCouponIds = body.reward_coupon_ids !== undefined
      ? normalizeRewardCouponIds(body.reward_coupon_ids)
      : null;
    const mlFieldsToTranslate = {};
    for (const field of ["activity_name", "activity_subtitle", "activity_desc", "highlights", "participation_guide", "reward_guide", "notice_text"]) {
      if (body[field] !== undefined) mlFieldsToTranslate[field] = body[field];
    }
    const translatedFields = await completeMlFieldMap(
      mlFieldsToTranslate,
      body._sourceLang || body.sourceLang || "zh"
    );

    const targetStatus = body.status !== undefined ? String(body.status) : String(existing.status || "draft");
    const targetActivityType = body.activity_type !== undefined ? String(body.activity_type) : String(existing.activity_type || "general");
    const targetRewardPoints = body.reward_points !== undefined ? (Number(body.reward_points) || 0) : Number(existing.reward_points || 0);
    const targetGameProgramId = body.game_program_id !== undefined ? String(body.game_program_id || "") : String(existing.game_program_id || "");

    const updated = await withTransaction(async (client) => {
      const sets = [];
      const params = [];
      for (const [bodyKey, transform] of Object.entries(fieldMap)) {
        if (body[bodyKey] === undefined) continue;
        const dbCol = bodyKey === "template_id" ? "template_code" : bodyKey;
        const nextValue = translatedFields[bodyKey] !== undefined ? translatedFields[bodyKey] : body[bodyKey];
        if (!transform && bodyKey === "template_id") {
          params.push(String(nextValue));
          sets.push(`template_code = $${params.length}`);
        } else if (transform) {
          params.push(transform(nextValue));
          sets.push(`${dbCol} = $${params.length}`);
        }
      }
      if (sets.length > 0) {
        params.push(id);
        await client.query(
          `UPDATE activities SET ${sets.join(", ")}, updated_at=NOW() WHERE activity_id=$${params.length}`,
          params
        );
      }

      if (rewardCouponIds !== null) {
        await syncActivityRewardCouponBindings(client, id, rewardCouponIds);
      }

      await ensureActivityRewardReadiness({
        client,
        activityId: id,
        activityType: targetActivityType,
        targetStatus,
        rewardPoints: targetRewardPoints,
        rewardCouponIds,
        gameProgramId: targetGameProgramId,
      });

      const { rows } = await client.query("SELECT * FROM activities WHERE activity_id = $1", [id]);
      return rows[0];
    });
    if (Object.keys(translatedFields).length) {
      await syncMlSnapshotToOss("activity", id, translatedFields).catch(() => null);
    }

    const [enriched] = await enrichActivitiesWithRewards([updated]);
    return sendOk(res, sendJson, "activity updated", rowToActivity(enriched || updated));
  } catch (err) {
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "UPDATE_FAILED", err.message || "更新失败");
  }
}

export async function handleActivityDelete(req, res, url, sendJson) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少活动ID");
    const { rows } = await query("DELETE FROM activities WHERE activity_id=$1 RETURNING activity_id", [id]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
    return sendOk(res, sendJson, "活动已删除", null);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── 活动参与（积分走 PostgreSQL）────────────────────────────────────────────

export async function handleActivityParticipate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)\/participate$/);
    if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少活动ID");

    const body = await readBody(req);
    const userId = body.user_id || body.line_user_id || "";
    if (!userId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "缺少 user_id");

    const { rows: acts } = await query("SELECT * FROM activities WHERE activity_id=$1", [id]);
    if (acts.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
    const activity = acts[0];
    if (activity.status !== "active") return sendError(res, sendJson, 400, "INACTIVE", "活动未开启");

    const rewardPoints = Number(activity.reward_points) || 0;
    const now = new Date();

    // 归因快照字段
    const srcEntryId   = body.source_entry_id   || "";
    const srcLandingId = body.source_landing_id  || activity.landing_code || "";
    const srcBannerId  = body.source_banner_id   || activity.banner_code  || "";
    const srcChannelId = body.source_channel_id  || activity.source_channel_id || "";

    // 站点归因快照：优先来自请求体，其次通过 source_entry_id 反查 entry_instances → stations
    let srcStationCode = body.source_station_code || "";
    let srcASystemStationId = body.source_a_system_station_id || "";
    let srcDeviceCode = body.source_device_code || body.device_code || "";

    if (!srcStationCode && srcEntryId) {
      try {
        const { rows: entryRows } = await query(
          "SELECT station_code FROM entry_instances WHERE entry_code=$1", [srcEntryId]
        );
        const entryStationCode = entryRows[0]?.station_code || "";
        if (entryStationCode) {
          const { rows: stRows } = await query(
            "SELECT a_system_station_id, device_code FROM stations WHERE station_code=$1", [entryStationCode]
          );
          srcStationCode       = entryStationCode;
          srcASystemStationId  = stRows[0]?.a_system_station_id || "";
          srcDeviceCode        = srcDeviceCode || stRows[0]?.device_code || "";
        }
      } catch (_) {}
    }

    const participationCode = `part_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // ── 幂等核心：ON CONFLICT (activity_id, user_id) DO NOTHING ──────────────
    // 无论并发还是重放请求，DB 层唯一约束保证只插入一条。
    // INSERT 无 RETURNING 行 → 已存在 → 直接返回 already_joined。
    const result = await withTransaction(async (client) => {
      const { rows: partRows } = await client.query(
        `INSERT INTO activity_participations
           (id, activity_id, user_id, line_user_id, points_awarded,
            source_entry_id, source_landing_id, source_banner_id, source_channel_id,
            source_station_code, source_a_system_station_id, source_device_code,
            joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (activity_id, user_id) DO NOTHING
         RETURNING *`,
        [
          participationCode, id, userId, body.line_user_id || userId,
          rewardPoints,
          srcEntryId, srcLandingId, srcBannerId, srcChannelId,
          srcStationCode, srcASystemStationId, srcDeviceCode,
          now,
        ]
      );

      // 无 RETURNING 行 → 幂等命中（已参与过），跳过积分发放
      if (partRows.length === 0) return { already_joined: true };

      // 发放积分（仅 reward_points > 0 时）
      if (rewardPoints > 0) {
        const actName = activity.activity_name;
        const actNameStr = typeof actName === "object"
          ? (actName.zh || actName.en || id)
          : (actName || id);

        const ledgerId = `ledger_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // 写积分流水（携带完整归因快照，含站点维度）
        await client.query(
          `INSERT INTO points_ledger
             (id, user_id, line_user_id, type, points, ref_type, ref_id, reason, operator_id,
              source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
              source_station_code, source_a_system_station_id, source_device_code,
              created_at)
           VALUES ($1,$2,$3,'credit',$4,'activity_reward',$5,$6,'activity_system',
                   $7,$8,$9,$10,$11,
                   $12,$13,$14,$15)`,
          [
            ledgerId, userId, body.line_user_id || userId,
            rewardPoints, id,
            `活动奖励：${actNameStr}`,
            srcEntryId, id, srcLandingId, srcBannerId, srcChannelId,
            srcStationCode, srcASystemStationId, srcDeviceCode,
            now,
          ]
        );

        // 更新积分账户（ON CONFLICT 保证原子性）
        await client.query(
          `INSERT INTO points_accounts (user_id, line_user_id, total_points, available_points, updated_at)
           VALUES ($1,$2,$3,$3,$4)
           ON CONFLICT (user_id) DO UPDATE SET
             total_points     = points_accounts.total_points     + EXCLUDED.total_points,
             available_points = points_accounts.available_points + EXCLUDED.available_points,
             updated_at       = EXCLUDED.updated_at`,
          [userId, body.line_user_id || userId, rewardPoints, now]
        );
      }

      // 发放活动绑定卡券（生产级：统一走 activity_product_bindings）
      const issuedCoupons = [];
      const { rows: bindings } = await client.query(
        `SELECT product_id
           FROM activity_product_bindings
          WHERE activity_code = $1
            AND binding_type = 'coupon'
            AND trigger_event = 'participate'
            AND status::text IN ('1', 'active', 'enabled')
          ORDER BY sort_no ASC, id ASC`,
        [id]
      );

      for (const binding of bindings) {
        const couponId = String(binding.product_id || '').trim();
        if (!couponId) continue;

        // 幂等去重：同一用户 + 同一活动 + 同一券，不重复发
        const { rows: existsRows } = await client.query(
          `SELECT id
             FROM user_coupons
            WHERE coupon_id = $1
              AND source_activity_id = $2
              AND (user_id = $3 OR line_user_id = $4)
            LIMIT 1`,
          [couponId, id, userId, body.line_user_id || userId]
        );

        if (existsRows.length > 0) {
          issuedCoupons.push({ coupon_id: couponId, duplicated: true });
          continue;
        }

        const userCouponId = `uc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        await client.query(
          `INSERT INTO user_coupons
             (id, user_id, line_user_id, coupon_id, product_status, source_type,
              source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
              source_station_code, source_a_system_station_id, source_device_code, source_device_id,
              claimed_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'claimed','activity',
                   $5,$6,$7,$8,$9,
                   $10,$11,$12,$12,
                   $13,$13,$13)`,
          [
            userCouponId, userId, body.line_user_id || userId, couponId,
            srcEntryId, id, srcLandingId, srcBannerId, srcChannelId,
            srcStationCode, srcASystemStationId, srcDeviceCode,
            now,
          ]
        );

        issuedCoupons.push({ coupon_id: couponId, duplicated: false });
      }

      return { already_joined: false, participation: partRows[0], issued_coupons: issuedCoupons };
    });

    if (result.already_joined) {
      return sendOk(res, sendJson, "already_joined", {
        already_joined: true,
        points_awarded: 0,
        participation: null,
      });
    }

    return sendOk(res, sendJson, "参与成功", {
      already_joined: false,
      points_awarded: rewardPoints,
      participation: result.participation,
      issued_coupons: result.issued_coupons || [],
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message || "参与失败");
  }
}

// ─── 活动-商品绑定 ────────────────────────────────────────────────────────────

export async function handleActivityProductBindingList(req, res, url, sendJson) {
  try {
    const activityId = url.searchParams.get("activityId");
    let sql = `
      SELECT
        apb.*,
        a.activity_name,
        c.name AS coupon_name,
        mi.name AS mall_item_name
      FROM activity_product_bindings apb
      LEFT JOIN activities a ON a.activity_id = apb.activity_code
      LEFT JOIN coupons c ON c.id = apb.product_id AND apb.binding_type = 'coupon'
      LEFT JOIN mall_items mi ON mi.id = apb.product_id AND apb.binding_type = 'mall_item'
    `;
    const params = [];
    if (activityId) { params.push(activityId); sql += ` WHERE apb.activity_code=$1`; }
    sql += " ORDER BY apb.sort_no ASC, apb.id ASC";
    const { rows } = await query(sql, params);
    return sendOk(res, sendJson, "activity product bindings loaded",
      rows.map(r => ({
        ...r,
        activity_id: r.activity_code,
        binding_id: r.binding_code,
        reward_name: r.coupon_name || r.mall_item_name || "",
      })));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
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

    if (bindingType === "coupon") {
      const { rows: couponRows } = await query("SELECT id, status FROM coupons WHERE id = $1", [productId]);
      if (couponRows.length === 0) return sendError(res, sendJson, 400, "PRODUCT_NOT_FOUND", "所绑定的卡券不存在");
      if (Number(couponRows[0].status || 0) !== 1) return sendError(res, sendJson, 400, "COUPON_DISABLED", "所绑定的卡券未启用");
    }
    if (bindingType === "mall_item") {
      const { rows: itemRows } = await query("SELECT id FROM mall_items WHERE id = $1", [productId]);
      if (itemRows.length === 0) return sendError(res, sendJson, 400, "PRODUCT_NOT_FOUND", "所绑定的商品不存在");
    }

    const { rows: last } = await query("SELECT binding_code FROM activity_product_bindings ORDER BY id DESC LIMIT 1", []);
    const lastNum = last.length > 0
      ? parseInt((last[0].binding_code || "apb_000").replace("apb_", "")) || 0
      : 0;
    const bindingCode = `apb_${String(lastNum + 1).padStart(3, "0")}`;

    const { rows } = await query(
      `INSERT INTO activity_product_bindings
         (binding_code, activity_code, product_id, binding_type, trigger_event, user_scope, sort_no, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'enabled') RETURNING *`,
      [bindingCode, activityId, productId, bindingType,
       body.trigger_event || "", body.user_scope || "all", Number(body.sort_no) || 0]
    );
    const r = rows[0];
    return sendOk(res, sendJson, "activity product binding created",
      { ...r, activity_id: r.activity_code, binding_id: r.binding_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

// ─── 用户次数管理（User Chances，原逻辑保留占位）────────────────────────────

export async function handleUserChancesList(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)\/user-chances$/);
  return sendOk(res, sendJson, "user chances loaded", { activity_id: id, list: [], total: 0 });
}

export async function handleUserChancesGrant(req, res, url, sendJson, readBody) {
  return sendOk(res, sendJson, "not implemented in this version", null);
}
