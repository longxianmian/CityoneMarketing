import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

const VALID_ACTIVITY_TYPES = [
  "general", "sos", "lightning_coupon", "lucky_wheel", "scratch_card", "thai_fortune_draw", "invite_reward",
];
const VALID_BINDING_TYPES = [
  "reward_preview", "reward_delivery", "unlock_after_event", "related_recommendation",
];

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
    share_cover: r.share_cover || "",
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
    cover_image: r.cover_image || "",
    cover_video: r.cover_video || "",
    reward_points: r.reward_points || 0,
    landing_code: r.landing_code || "",
    entry_ref_code: r.entry_ref_code || "",
    banner_code: r.banner_code || "",
    sort_order: r.sort_order || 0,
    is_featured: r.is_featured || false,
    source_entry_id: r.source_entry_id || "",
    source_banner_id: r.source_banner_id || "",
    source_channel_id: r.source_channel_id || "",
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
    return sendOk(res, sendJson, "activities loaded", rows.map(rowToActivity));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

export async function handleActivityGet(req, res, url, sendJson) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    const { rows } = await query("SELECT * FROM activities WHERE activity_id=$1", [id]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");
    return sendOk(res, sendJson, "activity loaded", rowToActivity(rows[0]));
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

    const actName = typeof rawName === "object" ? rawName : { zh: String(rawName || ""), th: "", en: "" };
    const { rows } = await query(
      `INSERT INTO activities
         (activity_id, activity_type, activity_name, activity_title, activity_subtitle, activity_desc,
          template_code, usage_mode, start_time, end_time, status,
          require_oa_follow, auto_join_after_follow,
          entry_scope_json, site_scope_json, channel_scope_json,
          share_enabled, share_title, share_desc, share_cover, campaign_id, share_status,
          goal, department, owner_dept, partner_dept, coupon_name,
          highlights, participation_guide, reward_guide, notice_text,
          cover_image, cover_video, reward_points, sort_order, is_featured,
          landing_code, entry_ref_code, banner_code,
          source_entry_id, source_banner_id, source_channel_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42)
       RETURNING *`,
      [
        activityId, activityType, JSON.stringify(actName),
        body.activity_title || "", body.activity_subtitle || "", body.activity_desc || "",
        body.template_id || "", body.usage_mode || "public",
        body.start_time || "", body.end_time || "",
        ["draft", "active", "ended"].includes(body.status) ? body.status : "draft",
        !!body.require_oa_follow, !!body.auto_join_after_follow,
        body.entry_scope_json ? JSON.stringify(body.entry_scope_json) : null,
        body.site_scope_json ? JSON.stringify(body.site_scope_json) : null,
        body.channel_scope_json ? JSON.stringify(body.channel_scope_json) : null,
        !!body.share_enabled, body.share_title || "", body.share_desc || "", body.share_cover || "",
        body.campaign_id || "", body.share_status || "disabled",
        body.goal || "", body.department || "", body.owner_dept || "", body.partner_dept || "",
        body.coupon_name || "", body.highlights || "", body.participation_guide || "",
        body.reward_guide || "", body.notice_text || "",
        body.cover_image || "", body.cover_video || "",
        Number(body.reward_points) || 0, Number(body.sort_order) || 0, !!body.is_featured,
        body.landing_code || "", body.entry_ref_code || "", body.banner_code || "",
        body.source_entry_id || "", body.source_banner_id || "", body.source_channel_id || "",
      ]
    );
    return sendOk(res, sendJson, "activity created", rowToActivity(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleActivityUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/activities\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "activity_id 必填");
    const body = await readBody(req);
    const { rows: found } = await query("SELECT activity_id FROM activities WHERE activity_id=$1", [id]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到活动");

    const fieldMap = {
      activity_name: (v) => JSON.stringify(typeof v === "object" ? v : { zh: String(v), th: "", en: "" }),
      activity_title: (v) => String(v), activity_subtitle: (v) => String(v),
      activity_desc: (v) => String(v),
      template_id: null,
      template_code: (v) => String(v),
      usage_mode: (v) => String(v), start_time: (v) => String(v), end_time: (v) => String(v),
      status: (v) => String(v),
      require_oa_follow: (v) => !!v, auto_join_after_follow: (v) => !!v,
      entry_scope_json: (v) => JSON.stringify(v), site_scope_json: (v) => JSON.stringify(v),
      channel_scope_json: (v) => JSON.stringify(v),
      share_enabled: (v) => !!v, share_title: (v) => String(v), share_desc: (v) => String(v),
      share_cover: (v) => String(v), campaign_id: (v) => String(v), share_status: (v) => String(v),
      goal: (v) => String(v), department: (v) => String(v), owner_dept: (v) => String(v),
      partner_dept: (v) => String(v), coupon_name: (v) => String(v),
      highlights: (v) => String(v), participation_guide: (v) => String(v),
      reward_guide: (v) => String(v), notice_text: (v) => String(v),
      cover_image: (v) => String(v), cover_video: (v) => String(v),
      reward_points: (v) => Number(v) || 0,
      landing_code: (v) => String(v), entry_ref_code: (v) => String(v), banner_code: (v) => String(v),
      sort_order: (v) => Number(v) || 0, is_featured: (v) => !!v,
    };

    const sets = [];
    const params = [];
    for (const [bodyKey, transform] of Object.entries(fieldMap)) {
      if (body[bodyKey] === undefined) continue;
      const dbCol = bodyKey === "template_id" ? "template_code" : bodyKey;
      if (!transform && bodyKey === "template_id") {
        params.push(String(body[bodyKey]));
        sets.push(`template_code = $${params.length}`);
      } else if (transform) {
        params.push(transform(body[bodyKey]));
        sets.push(`${dbCol} = $${params.length}`);
      }
    }
    if (sets.length === 0) return sendOk(res, sendJson, "nothing to update", {});
    params.push(id);
    const { rows } = await query(
      `UPDATE activities SET ${sets.join(", ")}, updated_at=NOW() WHERE activity_id=$${params.length} RETURNING *`,
      params
    );
    return sendOk(res, sendJson, "activity updated", rowToActivity(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
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

    const participationCode = `part_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // ── 幂等核心：ON CONFLICT (activity_id, user_id) DO NOTHING ──────────────
    // 无论并发还是重放请求，DB 层唯一约束保证只插入一条。
    // INSERT 无 RETURNING 行 → 已存在 → 直接返回 already_joined。
    const result = await withTransaction(async (client) => {
      const { rows: partRows } = await client.query(
        `INSERT INTO activity_participations
           (id, activity_id, user_id, line_user_id, points_awarded,
            source_entry_id, source_landing_id, source_banner_id, source_channel_id,
            joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (activity_id, user_id) DO NOTHING
         RETURNING *`,
        [
          participationCode, id, userId, body.line_user_id || userId,
          rewardPoints,
          srcEntryId, srcLandingId, srcBannerId, srcChannelId,
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

        // 写积分流水（携带完整归因快照）
        await client.query(
          `INSERT INTO points_ledger
             (id, user_id, line_user_id, type, points, ref_type, ref_id, reason, operator_id,
              source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
              created_at)
           VALUES ($1,$2,$3,'credit',$4,'activity_reward',$5,$6,'activity_system',
                   $7,$8,$9,$10,$11,$12)`,
          [
            ledgerId, userId, body.line_user_id || userId,
            rewardPoints, id,
            `活动奖励：${actNameStr}`,
            srcEntryId, id, srcLandingId, srcBannerId, srcChannelId,
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

      return { already_joined: false, participation: partRows[0] };
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
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message || "参与失败");
  }
}

// ─── 活动-商品绑定 ────────────────────────────────────────────────────────────

export async function handleActivityProductBindingList(req, res, url, sendJson) {
  try {
    const activityId = url.searchParams.get("activityId");
    let sql = "SELECT * FROM activity_product_bindings";
    const params = [];
    if (activityId) { params.push(activityId); sql += ` WHERE activity_code=$1`; }
    sql += " ORDER BY sort_no ASC, id ASC";
    const { rows } = await query(sql, params);
    return sendOk(res, sendJson, "activity product bindings loaded",
      rows.map(r => ({ ...r, activity_id: r.activity_code, binding_id: r.binding_code })));
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
