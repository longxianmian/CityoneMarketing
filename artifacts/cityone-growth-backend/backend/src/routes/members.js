/**
 * 客户管理路由（PostgreSQL 版）
 *
 * 管理端统一业务身份定义：
 *   visitor  — 当前仅有会话/设备痕迹，尚未识别到有效 LINE 身份
 *   fan      — 已关注 LINE OA，等于已完成 H5 系统注册
 *   customer — 已发生过至少一次真实充电业务
 *   member   — 已缴纳押金，可直接进入完整取电链路
 *
 * GET  /api/admin/customers              — 客户列表（四层人群）
 * GET  /api/admin/member-config          — 会员权益配置
 * POST /api/admin/member-config/update   — 更新权益配置
 * POST /api/admin/customers/:id/set-member — 手动设置/取消会员（押金桥接前临时）
 * GET  /api/charging-discount/check      — A 系统旁路折扣查询接口（阶段四对接）
 */

import { query } from "../db/pool.js";

function sendError(res, sendJson, code, errCode, msg) {
  return sendJson(res, code, { code, error: errCode, msg });
}

function resolveIdentityTag(row) {
  const raw = String(row?.identity_level || "").trim().toLowerCase();
  if (raw === "visitor" || raw === "fan" || raw === "customer" || raw === "member") {
    return raw;
  }
  if (!row?.line_user_id) return "visitor";
  if (row.deposit_paid) return "member";
  if (row.has_charge_order || row.has_used_charging) return "customer";
  if (row.is_fan) return "fan";
  return "visitor";
}

function resolveSource(row, tag) {
  if (row.source) return row.source;
  if (tag === "member") return "押金缴纳";
  if (tag === "customer" && row.source_hint === "marketing") return "营销活动体验";
  if (tag === "customer" && row.source_hint === "refund") return "押金退款用户";
  if (tag === "customer") return "充电体验用户";
  if (tag === "visitor") return "未识别 LINE 身份";
  return "LINE OA 关注";
}

function formatCustomer(row) {
  const tag = resolveIdentityTag(row);
  const source = resolveSource(row, tag);
  const LABEL = { visitor: "访客", fan: "粉丝", customer: "客户", member: "会员" };
  const benefits = tag === "member"
    ? [{ key: "charging_discount", label: "充电9折", status: "active" }]
    : [];
  return {
    user_id:           row.user_id || row.line_user_id || "",
    line_user_id:      row.line_user_id || "",
    line_display_name: row.line_display_name || row.display_name || "—",
    identity_tag:      tag,
    identity_label:    LABEL[tag] || tag,
    source,
    deposit_paid:      row.deposit_paid || false,
    deposit_amount:    Number(row.deposit_amount) || 0,
    has_used_charging: row.has_charge_order || row.has_used_charging || false,
    available_points:  Number(row.available_points) || 0,
    total_points:      Number(row.total_points) || 0,
    member_level:      row.member_level || 0,
    tags:              row.tags || [],
    benefits,
    joined_at:  row.created_at || row.updated_at || null,
    updated_at: row.updated_at || null,
  };
}

/** GET /api/admin/customers */
export async function handleListCustomers(req, res, url, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");

  const filterTag = url.searchParams.get("tag") || "";
  const keyword   = url.searchParams.get("q")   || "";
  const pageStr   = url.searchParams.get("page") || "1";
  const limitStr  = url.searchParams.get("limit") || "20";
  const page  = Math.max(1, parseInt(pageStr, 10)  || 1);
  const limit = Math.min(100, parseInt(limitStr, 10) || 20);
  const offset = (page - 1) * limit;

  // 管理端身份语义统一到 users.identity_level，points_accounts 只补充业务字段。
  const { rows: all } = await query(`
    SELECT
      u.user_id,
      u.line_user_id,
      u.display_name,
      u.is_fan,
      u.has_charge_order,
      u.deposit_paid,
      u.identity_level,
      u.created_at,
      u.updated_at,
      pa.line_display_name,
      pa.deposit_amount,
      pa.available_points,
      pa.total_points,
      pa.source,
      pa.source_hint,
      pa.member_level,
      pa.tags
    FROM users u
    LEFT JOIN LATERAL (
      SELECT
        line_display_name,
        deposit_amount,
        available_points,
        total_points,
        source,
        source_hint,
        member_level,
        tags,
        updated_at
      FROM points_accounts pa
      WHERE pa.user_id = u.user_id
         OR pa.line_user_id = u.user_id
         OR (u.line_user_id IS NOT NULL AND (pa.user_id = u.line_user_id OR pa.line_user_id = u.line_user_id))
      ORDER BY pa.updated_at DESC NULLS LAST
      LIMIT 1
    ) pa ON TRUE
    ORDER BY COALESCE(u.updated_at, u.created_at) DESC NULLS LAST
  `);

  const allFormatted = all.map(formatCustomer);

  // 按 tag 过滤（可选）
  let filtered = filterTag ? allFormatted.filter((u) => u.identity_tag === filterTag) : allFormatted;

  // 关键词搜索
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(
      (u) => u.line_display_name.toLowerCase().includes(kw) || u.user_id.includes(kw)
    );
  }

  const total      = filtered.length;
  const list       = filtered.slice(offset, offset + limit);
  const countFor   = (tag) => allFormatted.filter((u) => u.identity_tag === tag).length;

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      list,
      total,
      page, limit,
      visitorCount: countFor("visitor"),
      customerCount: countFor("customer"),
      memberCount: countFor("member"),
      fanCount:    countFor("fan"),
    },
  });
}

/** POST /api/admin/customers/:id/set-member */
export async function handleSetMember(req, body, userId, res, sendJson) {
  const user = req._admin;
  if (!user || !["super_admin", "admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const { rows: found } = await query(
    "SELECT * FROM points_accounts WHERE user_id = $1 OR line_user_id = $1 LIMIT 1",
    [userId]
  );
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "用户不存在");

  const { deposit_paid, deposit_amount } = body || {};
  const sets = [];
  const params = [];
  let idx = 1;

  if (deposit_paid !== undefined) { sets.push(`deposit_paid = $${idx++}`);    params.push(Boolean(deposit_paid)); }
  if (deposit_amount !== undefined) { sets.push(`deposit_amount = $${idx++}`); params.push(Number(deposit_amount)); }
  sets.push(`updated_at = NOW()`);
  params.push(found[0].user_id);

  await query(
    `UPDATE points_accounts SET ${sets.join(", ")} WHERE user_id = $${idx}`,
    params
  );

  sendJson(res, 200, {
    code: 200,
    msg: deposit_paid ? "已设置为会员" : "已取消会员身份",
    data: { user_id: userId, deposit_paid: Boolean(deposit_paid) },
  });
}

/** GET /api/admin/member-config */
export async function handleGetMemberConfig(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");

  const { rows } = await query("SELECT * FROM member_config WHERE id = 1");
  const row = rows[0] || {};
  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      charging_discount: row.charging_discount || {},
      deposit:           row.deposit || {},
      extra_benefits:    row.extra_benefits || [],
      updated_at:        row.updated_at || null,
      updated_by:        row.updated_by || null,
    },
  });
}

/** POST /api/admin/member-config/update */
export async function handleUpdateMemberConfig(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || !["super_admin", "admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅管理员可修改会员配置");

  // 取当前值
  const { rows } = await query("SELECT * FROM member_config WHERE id = 1");
  const cur = rows[0] || {};

  const newChargingDiscount = body.charging_discount !== undefined
    ? { ...(cur.charging_discount || {}), ...body.charging_discount }
    : (cur.charging_discount || {});
  const newDeposit = body.deposit !== undefined
    ? { ...(cur.deposit || {}), ...body.deposit }
    : (cur.deposit || {});
  const newExtraBenefits = body.extra_benefits !== undefined
    ? body.extra_benefits
    : (cur.extra_benefits || []);

  const { rows: updated } = await query(`
    INSERT INTO member_config (id, charging_discount, deposit, extra_benefits, updated_at, updated_by)
    VALUES (1, $1, $2, $3, NOW(), $4)
    ON CONFLICT (id) DO UPDATE SET
      charging_discount = EXCLUDED.charging_discount,
      deposit           = EXCLUDED.deposit,
      extra_benefits    = EXCLUDED.extra_benefits,
      updated_at        = EXCLUDED.updated_at,
      updated_by        = EXCLUDED.updated_by
    RETURNING *
  `, [
    JSON.stringify(newChargingDiscount),
    JSON.stringify(newDeposit),
    JSON.stringify(newExtraBenefits),
    user.username,
  ]);

  const r = updated[0];
  sendJson(res, 200, {
    code: 200, msg: "更新成功",
    data: {
      charging_discount: r.charging_discount,
      deposit:           r.deposit,
      extra_benefits:    r.extra_benefits,
      updated_at:        r.updated_at,
      updated_by:        r.updated_by,
    },
  });
}

/**
 * GET /api/charging-discount/check?user_id=xxx&order_amount=xxx
 * 充电折扣查询接口（A 系统旁路对接预留口）
 */
export async function handleCheckChargingDiscount(req, res, url, sendJson) {
  const userId      = url.searchParams.get("user_id") || "";
  const orderAmount = parseFloat(url.searchParams.get("order_amount") || "0");

  const { rows: configRows } = await query("SELECT * FROM member_config WHERE id = 1");
  const config = configRows[0] || {};
  const discountConfig = config.charging_discount || {};

  if (!discountConfig.enabled) {
    return sendJson(res, 200, {
      code: 200, msg: "no_discount",
      data: { eligible: false, discount_rate: 1, discount_amount: 0, final_amount: orderAmount, reason: "会员充电折扣未启用" },
    });
  }

  const { rows: accRows } = await query(
    "SELECT deposit_paid FROM points_accounts WHERE user_id = $1 OR line_user_id = $1 LIMIT 1",
    [userId]
  );
  const isMember = accRows[0]?.deposit_paid === true;

  // TODO(阶段四 A 系统旁路对接)：替换为真实 A 系统 API 调用
  if (!isMember) {
    return sendJson(res, 200, {
      code: 200, msg: "not_member",
      data: { eligible: false, discount_rate: 1, discount_amount: 0, final_amount: orderAmount, reason: "非会员用户" },
    });
  }

  const rate = discountConfig.rate ?? 0.9;
  const discountAmount = orderAmount > 0 ? parseFloat((orderAmount * (1 - rate)).toFixed(2)) : 0;
  const finalAmount    = orderAmount > 0 ? parseFloat((orderAmount * rate).toFixed(2)) : 0;

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      eligible: true,
      discount_rate: rate,
      discount_label: discountConfig.label_zh || `${rate * 10}折`,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      original_amount: orderAmount,
      discount_source: "local",
      apply_scope: discountConfig.apply_scope || "all_stations",
    },
  });
}

// 旧函数名兼容导出
export const handleListMembers = handleListCustomers;
