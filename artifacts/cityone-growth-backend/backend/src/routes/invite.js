import { query } from "../db/pool.js";

function safeNum(val, fallback = 0) {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function sendError(res, sendJson, status, code, msg) {
  return sendJson(res, status, { code: status, msg, error: code });
}

// ── GET /api/growth/invite/config ─────────────────────────────────────────────
export async function handleGetInviteConfig(req, res, sendJson) {
  try {
    const result = await query(
      "SELECT inviter_points, invitee_points, daily_limit, enabled, updated_at FROM invite_reward_config ORDER BY id LIMIT 1"
    );
    const row = result.rows[0] || { inviter_points: 100, invitee_points: 50, daily_limit: 10, enabled: true };
    return sendJson(res, 200, { code: 200, msg: "ok", data: row });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── POST /api/growth/invite/config/save ───────────────────────────────────────
export async function handleSaveInviteConfig(req, res, sendJson, body) {
  try {
    const { inviter_points, invitee_points, daily_limit, enabled } = body || {};
    const inviterPts  = safeNum(inviter_points, 100);
    const inviteePts  = safeNum(invitee_points, 50);
    const dailyLim    = safeNum(daily_limit, 10);
    const isEnabled   = enabled === undefined ? true : Boolean(enabled);

    // upsert：如果已有记录则更新，否则插入
    const existing = await query("SELECT id FROM invite_reward_config LIMIT 1");
    if (existing.rows.length > 0) {
      await query(
        `UPDATE invite_reward_config
           SET inviter_points = $1, invitee_points = $2, daily_limit = $3, enabled = $4, updated_at = NOW()
         WHERE id = $5`,
        [inviterPts, inviteePts, dailyLim, isEnabled, existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO invite_reward_config (inviter_points, invitee_points, daily_limit, enabled)
         VALUES ($1, $2, $3, $4)`,
        [inviterPts, inviteePts, dailyLim, isEnabled]
      );
    }
    return sendJson(res, 200, { code: 200, msg: "配置已保存" });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── GET /api/growth/invite/stats ──────────────────────────────────────────────
export async function handleGetInviteStats(req, res, sendJson) {
  try {
    const [relRes, cfgRes] = await Promise.all([
      query("SELECT COUNT(*) AS total FROM invite_relations"),
      query("SELECT COALESCE(SUM(inviter_points + invitee_points), 0) AS pts FROM invite_reward_config, (SELECT COUNT(*) AS cnt FROM invite_relations) t WHERE TRUE"),
    ]);
    const totalRelations = Number(relRes.rows[0]?.total || 0);
    return sendJson(res, 200, {
      code: 200,
      msg: "ok",
      data: {
        totalRelations,
        totalRewards: totalRelations * 2,
        totalPoints: 0,
      },
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── GET /api/growth/invite/relations ─────────────────────────────────────────
export async function handleGetInviteRelations(req, res, sendJson, url) {
  try {
    const page     = Math.max(1, parseInt(url.searchParams.get("pageNum")  || "1",  10));
    const pageSize = Math.max(1, parseInt(url.searchParams.get("pageSize") || "10", 10));
    const keyword  = (url.searchParams.get("keyword") || "").trim();
    const offset   = (page - 1) * pageSize;

    let where = "WHERE TRUE";
    const params = [];
    if (keyword) {
      params.push(`%${keyword}%`);
      where += ` AND (inviter_mobile ILIKE $${params.length} OR invitee_mobile ILIKE $${params.length} OR inviter_id ILIKE $${params.length} OR invitee_id ILIKE $${params.length})`;
    }

    const countRes = await query(`SELECT COUNT(*) AS total FROM invite_relations ${where}`, params);
    const total = Number(countRes.rows[0]?.total || 0);

    params.push(pageSize, offset);
    const dataRes = await query(
      `SELECT * FROM invite_relations ${where} ORDER BY bound_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return sendJson(res, 200, {
      code: 200, msg: "ok",
      data: { list: dataRes.rows, total },
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}
