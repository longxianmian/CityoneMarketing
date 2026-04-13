/**
 * 积分体系路由 — PostgreSQL 版
 * 替代原 JSON 文件存储；保持与前端完全相同的 API 响应结构
 * 覆盖：积分账户、积分流水、分享归因、消费归因、积分规则、手工调整
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

// ── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, status, code, msg) {
  return sendJson(res, status, { code: status, error: code, msg });
}

function accountRow(row) {
  return {
    ...row,
    total_points:     Number(row.total_points     ?? 0),
    available_points: Number(row.available_points ?? 0),
    pending_points:   Number(row.pending_points   ?? 0),
    consumed_points:  Number(row.consumed_points  ?? 0),
    revoked_points:   Number(row.revoked_points   ?? 0),
    updated_at:       row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function ledgerRow(row) {
  return {
    ...row,
    points:     Number(row.points ?? 0),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function shareRow(row) {
  return {
    ...row,
    points_value: Number(row.points_value ?? 0),
    created_at:   row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function consumeRow(row) {
  return {
    ...row,
    paid_amount:       row.paid_amount       != null ? Number(row.paid_amount)       : null,
    pointable_amount:  row.pointable_amount  != null ? Number(row.pointable_amount)  : null,
    credited_points:   Number(row.credited_points  ?? 0),
    revoked_points:    Number(row.revoked_points   ?? 0),
    created_at:        row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

// ── 用户端：积分总览 ─────────────────────────────────────────────────────────
// GET /growth/user/points/summary?user_id=xxx
export async function handleUserPointsSummary(req, res, url, sendJson) {
  try {
    const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");

    if (!userId) {
      return sendError(res, sendJson, 400, "MISSING_USER_ID", "请传入 user_id 或 line_user_id");
    }

    // UPSERT：首次访问自动初始化账户
    const result = await query(`
      INSERT INTO points_accounts (user_id, line_user_id, total_points, available_points, pending_points, consumed_points, revoked_points, updated_at)
      VALUES ($1, $2, 0, 0, 0, 0, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE SET updated_at = points_accounts.updated_at
      RETURNING *
    `, [userId, userId]);

    return sendOk(res, sendJson, "success", accountRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 用户端：积分流水 ─────────────────────────────────────────────────────────
// GET /growth/user/points/ledger?user_id=xxx&page=1&page_size=20
export async function handleUserPointsLedger(req, res, url, sendJson) {
  try {
    const userId   = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");
    const page     = Math.max(1, parseInt(url.searchParams.get("page")      || "1",  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const offset   = (page - 1) * pageSize;

    if (!userId) {
      const dataRes = await query("SELECT * FROM points_ledger ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]);
      const countRes = await query("SELECT COUNT(*) AS total FROM points_ledger");
      return sendOk(res, sendJson, "success", {
        total:     Number(countRes.rows[0].total),
        page,
        page_size: pageSize,
        items:     dataRes.rows.map(ledgerRow),
      });
    }

    const dataRes = await query(`
      SELECT * FROM points_ledger
      WHERE user_id = $1 OR line_user_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3
    `, [userId, pageSize, offset]);

    const countRes = await query(
      "SELECT COUNT(*) AS total FROM points_ledger WHERE user_id = $1 OR line_user_id = $1",
      [userId]
    );

    return sendOk(res, sendJson, "success", {
      total:     Number(countRes.rows[0].total),
      page,
      page_size: pageSize,
      items:     dataRes.rows.map(ledgerRow),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 用户端：兑换记录 ─────────────────────────────────────────────────────────
// GET /growth/user/points/redeems?user_id=xxx
export async function handleUserPointsRedeems(req, res, url, sendJson) {
  try {
    const userId   = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");
    const page     = Math.max(1, parseInt(url.searchParams.get("page")      || "1",  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const offset   = (page - 1) * pageSize;

    const userFilter = userId
      ? "AND (user_id = $3 OR line_user_id = $3)"
      : "";

    const params = userId
      ? [pageSize, offset, userId]
      : [pageSize, offset];

    const dataRes = await query(
      `SELECT * FROM points_ledger WHERE ref_type = 'exchange' ${userFilter} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    const cntParams = userId ? [userId] : [];
    const countRes  = await query(
      `SELECT COUNT(*) AS total FROM points_ledger WHERE ref_type = 'exchange' ${userId ? "AND (user_id = $1 OR line_user_id = $1)" : ""}`,
      cntParams
    );

    return sendOk(res, sendJson, "success", {
      total:     Number(countRes.rows[0].total),
      page,
      page_size: pageSize,
      items:     dataRes.rows.map(ledgerRow),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：积分账户列表 ─────────────────────────────────────────────────────
// GET /growth/admin/points/accounts?page=1&page_size=20&keyword=xxx
export async function handleAdminPointsAccounts(req, res, url, sendJson) {
  try {
    const page     = Math.max(1, parseInt(url.searchParams.get("page")      || "1",   10));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const keyword  = url.searchParams.get("keyword") || "";
    const offset   = (page - 1) * pageSize;

    let where  = "";
    let params = [pageSize, offset];

    if (keyword) {
      where  = "WHERE user_id ILIKE $3 OR line_user_id ILIKE $3";
      params = [pageSize, offset, `%${keyword}%`];
    }

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM points_accounts ${where}`,
      keyword ? [`%${keyword}%`] : []
    );
    const total = Number(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT * FROM points_accounts ${where} ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    return sendOk(res, sendJson, "success", {
      total,
      page,
      page_size: pageSize,
      items:     dataRes.rows.map(accountRow),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：分享归因列表 ─────────────────────────────────────────────────────
// GET /growth/admin/points/share-relations?page=1&page_size=20&campaign_id=xxx&points_status=xxx
export async function handleAdminShareRelations(req, res, url, sendJson) {
  try {
    const page       = Math.max(1, parseInt(url.searchParams.get("page")      || "1",   10));
    const pageSize   = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const campaignId = url.searchParams.get("campaign_id") || "";
    const status     = url.searchParams.get("points_status") || "";
    const offset     = (page - 1) * pageSize;

    const conditions = [];
    const filterParams = [];
    let filterIdx = 1;

    if (campaignId) { conditions.push(`campaign_id = $${filterIdx++}`); filterParams.push(campaignId); }
    if (status)     { conditions.push(`points_status = $${filterIdx++}`); filterParams.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) AS total FROM share_relations ${where}`, filterParams);
    const total    = Number(countRes.rows[0].total);

    const dataParams = [...filterParams, pageSize, offset];
    const dataRes = await query(
      `SELECT * FROM share_relations ${where} ORDER BY created_at DESC LIMIT $${filterIdx} OFFSET $${filterIdx + 1}`,
      dataParams
    );

    return sendOk(res, sendJson, "success", {
      total,
      page,
      page_size: pageSize,
      items:     dataRes.rows.map(shareRow),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：消费归因列表 ─────────────────────────────────────────────────────
// GET /growth/admin/points/consume-relations?page=1&page_size=20&user_id=xxx&points_status=xxx
export async function handleAdminConsumeRelations(req, res, url, sendJson) {
  try {
    const page     = Math.max(1, parseInt(url.searchParams.get("page")      || "1",   10));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const userId   = url.searchParams.get("user_id") || "";
    const status   = url.searchParams.get("points_status") || "";
    const offset   = (page - 1) * pageSize;

    const conditions = [];
    const filterParams = [];
    let filterIdx = 1;

    if (userId) { conditions.push(`(user_id = $${filterIdx} OR line_user_id = $${filterIdx})`); filterParams.push(userId); filterIdx++; }
    if (status) { conditions.push(`points_status = $${filterIdx++}`); filterParams.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) AS total FROM consume_relations ${where}`, filterParams);
    const total    = Number(countRes.rows[0].total);

    const dataParams = [...filterParams, pageSize, offset];
    const dataRes = await query(
      `SELECT * FROM consume_relations ${where} ORDER BY created_at DESC LIMIT $${filterIdx} OFFSET $${filterIdx + 1}`,
      dataParams
    );

    return sendOk(res, sendJson, "success", {
      total,
      page,
      page_size: pageSize,
      items:     dataRes.rows.map(consumeRow),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 积分规则新建 ────────────────────────────────────────────────────────────
// POST /growth/points/rules/create  body: { rule_type, points_value, description, enabled }
export async function handlePointsRuleCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { rule_type, points_value, description, enabled } = body;
    if (!rule_type || !rule_type.trim()) return sendError(res, sendJson, 400, "MISSING_TYPE", "缺少 rule_type");
    const pts = Number(points_value);
    if (isNaN(pts) || pts < 0) return sendError(res, sendJson, 400, "INVALID_POINTS", "积分值须为非负数");
    const rule_id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const result = await query(
      `INSERT INTO points_rules (rule_id, rule_type, points_value, description, enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`,
      [rule_id, rule_type.trim(), pts, description ?? "", enabled !== false]
    );
    return sendOk(res, sendJson, "已创建", result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return sendError(res, sendJson, 409, "DUPLICATE", "同类型规则已存在");
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 积分规则删除 ────────────────────────────────────────────────────────────
// POST /growth/points/rules/delete  body: { rule_id }
export async function handlePointsRuleDelete(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { rule_id } = body;
    if (!rule_id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少 rule_id");
    await query(`DELETE FROM points_rules WHERE rule_id=$1`, [rule_id]);
    return sendOk(res, sendJson, "已删除", {});
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 积分规则读取（全部，含禁用）─────────────────────────────────────────────
// GET /growth/points/rules
export async function handlePointsRules(req, res, url, sendJson) {
  try {
    const result = await query("SELECT * FROM points_rules ORDER BY rule_id ASC");
    return sendOk(res, sendJson, "success", { rules: result.rows });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 积分规则更新（积分值/备注）────────────────────────────────────────────────
// POST /growth/points/rules/update  body: { rule_id, points_value, memo }
export async function handlePointsRuleUpdate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { rule_id, points_value, description } = body;
    if (!rule_id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少 rule_id");
    const pts = Number(points_value);
    if (isNaN(pts) || pts < 0) return sendError(res, sendJson, 400, "INVALID_POINTS", "积分值须为非负数");
    const result = await query(
      `UPDATE points_rules SET points_value=$2, description=$3, updated_at=NOW() WHERE rule_id=$1 RETURNING *`,
      [rule_id, pts, description ?? ""]
    );
    if (!result.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "规则不存在");
    return sendOk(res, sendJson, "已保存", result.rows[0]);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 积分规则开/关 ──────────────────────────────────────────────────────────
// POST /growth/points/rules/toggle  body: { rule_id, enabled }
export async function handlePointsRuleToggle(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { rule_id, enabled } = body;
    if (!rule_id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少 rule_id");
    const result = await query(
      `UPDATE points_rules SET enabled=$2, updated_at=NOW() WHERE rule_id=$1 RETURNING *`,
      [rule_id, !!enabled]
    );
    if (!result.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "规则不存在");
    return sendOk(res, sendJson, "已更新", result.rows[0]);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：统一归因记录（分享+消费）──────────────────────────────────────────
// GET /growth/admin/points/attribution?page=1&page_size=20&source_type=all&user_id=&status=
export async function handleAdminAttribution(req, res, url, sendJson) {
  try {
    const page       = Math.max(1, parseInt(url.searchParams.get("page")      || "1",  10));
    const pageSize   = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
    const sourceType = url.searchParams.get("source_type") || "all";
    const userId     = url.searchParams.get("user_id") || "";
    const status     = url.searchParams.get("status") || "";
    const offset     = (page - 1) * pageSize;

    let rows = [], total = 0;

    // share_relations real columns: sharer_user_id, sharer_line_user_id, invitee_line_user_id
    if (sourceType === "share" || sourceType === "all") {
      const shareUserFilter = [];
      const sharePrms = [];
      let spi = 1;
      if (userId) {
        shareUserFilter.push(`(sharer_user_id=$${spi} OR sharer_line_user_id=$${spi} OR invitee_line_user_id=$${spi})`);
        sharePrms.push(userId); spi++;
      }
      if (status) {
        shareUserFilter.push(`points_status=$${spi}`);
        sharePrms.push(status); spi++;
      }
      const shareWhere = shareUserFilter.length ? `WHERE ${shareUserFilter.join(" AND ")}` : "";

      const r = await query(
        `SELECT id::text, COALESCE(sharer_user_id,'') AS user_id, COALESCE(sharer_line_user_id,'') AS line_user_id,
                'share' AS source_type, CAST(COALESCE(points_value,0) AS numeric) AS points_value,
                points_status, campaign_id AS ref_id, created_at
         FROM share_relations ${shareWhere} ORDER BY created_at DESC`,
        sharePrms
      );
      if (sourceType === "share") {
        const cnt = await query(`SELECT COUNT(*) AS total FROM share_relations ${shareWhere}`, sharePrms);
        total = Number(cnt.rows[0].total);
        const slice = r.rows.slice(offset, offset + pageSize);
        return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items: slice });
      }
      rows.push(...r.rows.map(x => ({ ...x, points_value: Number(x.points_value ?? 0) })));
    }

    // consume_relations real columns: user_id, line_user_id, order_id, credited_points, points_status
    if (sourceType === "consume" || sourceType === "all") {
      const consumeUserFilter = [];
      const consumePrms = [];
      let cpi = 1;
      if (userId) {
        consumeUserFilter.push(`(user_id=$${cpi} OR line_user_id=$${cpi})`);
        consumePrms.push(userId); cpi++;
      }
      if (status) {
        consumeUserFilter.push(`points_status=$${cpi}`);
        consumePrms.push(status); cpi++;
      }
      const consumeWhere = consumeUserFilter.length ? `WHERE ${consumeUserFilter.join(" AND ")}` : "";

      const r = await query(
        `SELECT id::text, COALESCE(user_id,'') AS user_id, COALESCE(line_user_id,'') AS line_user_id,
                'consume' AS source_type, CAST(COALESCE(credited_points,0) AS numeric) AS points_value,
                points_status, order_id AS ref_id, created_at
         FROM consume_relations ${consumeWhere} ORDER BY created_at DESC`,
        consumePrms
      );
      rows.push(...r.rows.map(x => ({ ...x, points_value: Number(x.points_value ?? 0) })));
    }

    // Sort merged result by created_at desc
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    total = rows.length;
    const items = rows.slice(offset, offset + pageSize);
    return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 手工积分调整 ─────────────────────────────────────────────────────────────
// POST /growth/points/adjust
// body: { user_id, line_user_id, type("credit"|"debit"), points, reason, operator_id }
export async function handlePointsAdjust(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);

    const userId     = body.user_id || body.line_user_id || "";
    const type       = body.type;
    const pts        = parseInt(body.points, 10);
    const reason     = body.reason || "";
    const operatorId = body.operator_id || "";

    if (!userId)                                   return sendError(res, sendJson, 400, "MISSING_USER_ID",    "请传入 user_id 或 line_user_id");
    if (type !== "credit" && type !== "debit")     return sendError(res, sendJson, 400, "INVALID_TYPE",       "type 必须为 credit 或 debit");
    if (!pts || pts <= 0)                          return sendError(res, sendJson, 400, "INVALID_POINTS",     "points 必须为正整数");
    if (!operatorId)                               return sendError(res, sendJson, 400, "MISSING_OPERATOR",   "operator_id 必填，不允许匿名调整");
    if (!reason)                                   return sendError(res, sendJson, 400, "MISSING_REASON",     "reason 必填");

    const result = await withTransaction(async (client) => {
      // 检查现有账户（行锁）
      const accRes = await client.query(
        "SELECT * FROM points_accounts WHERE user_id = $1 OR line_user_id = $1 LIMIT 1 FOR UPDATE",
        [userId]
      );

      if (type === "debit") {
        const available = accRes.rows.length ? Number(accRes.rows[0].available_points) : 0;
        if (pts > available) {
          return {
            error: {
              code: 400,
              key:  "INSUFFICIENT_POINTS",
              msg:  `可用积分不足，当前可用 ${available}`,
            },
          };
        }
      }

      const now = new Date().toISOString();

      // 写入流水
      const entryId = `ledger_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const entryRes = await client.query(`
        INSERT INTO points_ledger
          (id, user_id, line_user_id, type, points, ref_type, reason, operator_id, created_at)
        VALUES ($1,$2,$3,$4,$5,'manual_adjust',$6,$7,$8)
        RETURNING *
      `, [entryId, userId, body.line_user_id || userId, type, pts, reason, operatorId, now]);

      // UPSERT 积分账户
      let upsertSQL;
      if (type === "credit") {
        upsertSQL = `
          INSERT INTO points_accounts (user_id, line_user_id, total_points, available_points, updated_at)
          VALUES ($1, $2, $3, $3, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            total_points     = points_accounts.total_points     + $3,
            available_points = points_accounts.available_points + $3,
            updated_at       = NOW()
          RETURNING *
        `;
      } else {
        upsertSQL = `
          INSERT INTO points_accounts (user_id, line_user_id, consumed_points, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            available_points = points_accounts.available_points - $3,
            consumed_points  = points_accounts.consumed_points  + $3,
            updated_at       = NOW()
          RETURNING *
        `;
      }

      const accUpsertRes = await client.query(upsertSQL, [userId, body.line_user_id || userId, pts]);

      return {
        ledger_entry: ledgerRow(entryRes.rows[0]),
        account:      accountRow(accUpsertRes.rows[0]),
      };
    });

    if (result.error) {
      return sendError(res, sendJson, result.error.code, result.error.key, result.error.msg);
    }

    return sendOk(res, sendJson, "调整成功", result);
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message);
  }
}
