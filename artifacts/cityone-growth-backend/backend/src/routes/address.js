/**
 * 收货地址路由 — PostgreSQL
 * GET  /api/growth/user/addresses?user_id=xxx  — 列表
 * POST /api/growth/user/addresses               — 新增
 * PUT  /api/growth/user/addresses/:id           — 编辑
 * DELETE /api/growth/user/addresses/:id         — 删除
 * POST /api/growth/user/addresses/:id/default   — 设为默认
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

function ok(res, sendJson, data, msg = "ok") {
  return sendJson(res, 200, { code: 200, msg, data });
}
function err(res, sendJson, status, key, msg) {
  return sendJson(res, status, { code: status, error: key, msg });
}
function genId() {
  return "addr_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex");
}

function rowToAddr(r) {
  return {
    id:            r.id,
    user_id:       r.user_id,
    contact_name:  r.contact_name,
    contact_phone: r.contact_phone,
    address:       r.address,
    label:         r.label || null,
    is_default:    Boolean(r.is_default),
    created_at:    r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at:    r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

// ── GET 列表 ──────────────────────────────────────────────────────────────────
export async function handleGetAddresses(req, res, sendJson, url) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  if (!userId) return err(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
  try {
    const result = await query(
      "SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
      [userId]
    );
    return ok(res, sendJson, result.rows.map(rowToAddr));
  } catch (e) {
    return err(res, sendJson, 500, "DB_ERROR", e.message);
  }
}

// ── POST 新增 ─────────────────────────────────────────────────────────────────
export async function handleCreateAddress(req, res, sendJson, body) {
  const { user_id, contact_name, contact_phone, address, label, is_default } = body || {};
  if (!user_id)        return err(res, sendJson, 400, "MISSING_USER_ID",   "user_id 必填");
  if (!contact_name)   return err(res, sendJson, 400, "MISSING_NAME",      "收货人姓名必填");
  if (!contact_phone)  return err(res, sendJson, 400, "MISSING_PHONE",     "手机号必填");
  if (!address)        return err(res, sendJson, 400, "MISSING_ADDRESS",   "地址必填");

  try {
    const result = await withTransaction(async (client) => {
      // 如果设为默认，先清除其他默认
      if (is_default) {
        await client.query(
          "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
          [user_id]
        );
      }
      // 检查是否是第一条地址（自动设为默认）
      const countRes = await client.query(
        "SELECT COUNT(*) AS cnt FROM user_addresses WHERE user_id = $1",
        [user_id]
      );
      const isFirst = Number(countRes.rows[0].cnt) === 0;
      const setDefault = is_default === true || isFirst;

      const r = await client.query(`
        INSERT INTO user_addresses (id, user_id, contact_name, contact_phone, address, label, is_default, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
        RETURNING *
      `, [genId(), user_id, String(contact_name).trim(), String(contact_phone).trim(),
          String(address).trim(), label || null, setDefault]);
      return r.rows[0];
    });
    return ok(res, sendJson, rowToAddr(result), "created");
  } catch (e) {
    return err(res, sendJson, 500, "DB_ERROR", e.message);
  }
}

// ── PUT 编辑 ──────────────────────────────────────────────────────────────────
export async function handleUpdateAddress(req, res, sendJson, body, addrId) {
  const { user_id, contact_name, contact_phone, address, label, is_default } = body || {};
  if (!user_id) return err(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
  try {
    const existing = await query("SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2", [addrId, user_id]);
    if (!existing.rows.length) return err(res, sendJson, 404, "NOT_FOUND", "地址不存在");

    const result = await withTransaction(async (client) => {
      if (is_default) {
        await client.query(
          "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
          [user_id]
        );
      }
      const sets = [];
      const params = [];
      let idx = 1;
      const addSet = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };
      if (contact_name  != null) addSet("contact_name",  String(contact_name).trim());
      if (contact_phone != null) addSet("contact_phone", String(contact_phone).trim());
      if (address       != null) addSet("address",       String(address).trim());
      if (label         !== undefined) addSet("label",    label || null);
      if (is_default    != null) addSet("is_default",    Boolean(is_default));
      addSet("updated_at", new Date().toISOString());
      params.push(addrId);
      const r = await client.query(
        `UPDATE user_addresses SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );
      return r.rows[0];
    });
    return ok(res, sendJson, rowToAddr(result), "updated");
  } catch (e) {
    return err(res, sendJson, 500, "DB_ERROR", e.message);
  }
}

// ── DELETE 删除 ───────────────────────────────────────────────────────────────
export async function handleDeleteAddress(req, res, sendJson, url, addrId) {
  const userId = url.searchParams.get("user_id") || "";
  if (!userId) return err(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
  try {
    const r = await query(
      "DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING id, is_default",
      [addrId, userId]
    );
    if (!r.rows.length) return err(res, sendJson, 404, "NOT_FOUND", "地址不存在");
    // 如果删除的是默认地址，把最新一条设为默认
    if (r.rows[0].is_default) {
      await query(
        "UPDATE user_addresses SET is_default = true WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
    }
    return ok(res, sendJson, null, "deleted");
  } catch (e) {
    return err(res, sendJson, 500, "DB_ERROR", e.message);
  }
}

// ── POST 设为默认 ─────────────────────────────────────────────────────────────
export async function handleSetDefaultAddress(req, res, sendJson, body, addrId) {
  const userId = (body || {}).user_id || "";
  if (!userId) return err(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
  try {
    await withTransaction(async (client) => {
      await client.query(
        "UPDATE user_addresses SET is_default = false WHERE user_id = $1",
        [userId]
      );
      await client.query(
        "UPDATE user_addresses SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [addrId, userId]
      );
    });
    return ok(res, sendJson, null, "default set");
  } catch (e) {
    return err(res, sendJson, 500, "DB_ERROR", e.message);
  }
}
