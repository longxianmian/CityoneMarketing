/**
 * 账户管理路由（PostgreSQL 版）
 *
 * super_admin 专属（超管中心）:
 *   GET  /api/admin/accounts              — 全部账号列表
 *   POST /api/admin/accounts              — 新建账号（可建 admin / operator）
 *   POST /api/admin/accounts/:id/update   — 修改账号
 *   POST /api/admin/accounts/:id/delete   — 删除账号
 *   POST /api/admin/accounts/:id/reset-password — 重置密码
 *
 * admin 专属（系统配置 → 账户管理）:
 *   GET  /api/admin/my-accounts           — 我创建的操作员列表
 *   POST /api/admin/my-accounts           — 新建操作员（仅 operator 角色）
 *   POST /api/admin/my-accounts/:id/update
 *   POST /api/admin/my-accounts/:id/delete
 *   POST /api/admin/my-accounts/:id/reset-password
 *
 * 公共:
 *   GET  /api/admin/role-templates        — 角色模板列表
 */

import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";

const OPERATOR_ROLES = ["growth_content", "growth_data", "ops_activity", "ops_data"];

const ROLE_META = {
  super_admin:    { label: "超级管理员",       level: 100, color: "red"    },
  admin:          { label: "管理员",           level: 50,  color: "purple" },
  growth_content: { label: "推广内容操作员",   level: 30,  color: "blue"   },
  growth_data:    { label: "推广数据操作员",   level: 25,  color: "cyan"   },
  ops_activity:   { label: "运营活动操作员",   level: 20,  color: "green"  },
  ops_data:       { label: "运营数据操作员",   level: 15,  color: "orange" },
};

const PERMISSION_DEFAULTS = {
  admin:          ["growth:content:write", "growth:data:read", "ops:activity:write", "ops:data:read", "admin:accounts:manage"],
  growth_content: ["growth:content:write", "growth:data:read"],
  growth_data:    ["growth:data:read"],
  ops_activity:   ["ops:activity:write", "ops:data:read"],
  ops_data:       ["ops:data:read"],
};

function sendError(res, sendJson, code, errCode, msg) {
  return sendJson(res, code, { code, error: errCode, msg });
}

function safeAccount(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return {
    ...rest,
    role_label: ROLE_META[row.role]?.label || row.role,
    role_color: ROLE_META[row.role]?.color || "default",
  };
}

// ─── 角色模板 ─────────────────────────────────────────────────────────────────

export async function handleRoleTemplates(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");

  const { rows } = await query("SELECT * FROM role_templates ORDER BY sort_order");
  const isAdmin = user.role === "admin";
  const filtered = isAdmin ? rows.filter((t) => OPERATOR_ROLES.includes(t.key)) : rows;

  // 规范化字段名（group_name → group）兼容前端旧命名
  const data = filtered.map((t) => ({
    key: t.key, label: t.label, label_th: t.label_th, label_en: t.label_en,
    description: t.description, group: t.group_name,
    default_permissions: t.default_permissions,
    can_be_created_by: t.can_be_created_by,
  }));
  sendJson(res, 200, { code: 200, msg: "success", data });
}

// ─── 超管中心：全量账号 CRUD（super_admin only） ───────────────────────────────

export async function handleSuperListAccounts(req, res, url, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");

  const role   = url.searchParams.get("role")   || "";
  const status = url.searchParams.get("status") || "";

  let sql = "SELECT * FROM admins WHERE id <> 1";
  const params = [];
  let idx = 1;
  if (role)   { sql += ` AND role = $${idx++}`;   params.push(role); }
  if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
  sql += " ORDER BY id";

  const { rows } = await query(sql, params);
  sendJson(res, 200, { code: 200, msg: "success", data: rows.map(safeAccount) });
}

export async function handleSuperCreateAccount(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");

  const allowedRoles = ["admin", ...OPERATOR_ROLES];
  const { username, password, display_name, role, department = "", note = "" } = body || {};
  if (!username || !password || !display_name || !role)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名、显示名、密码、角色均不能为空");
  if (!allowedRoles.includes(role))
    return sendError(res, sendJson, 400, "INVALID_ROLE", `角色须为：${allowedRoles.join(" / ")}`);
  if (password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");

  const dup = await query("SELECT id FROM admins WHERE username = $1", [username]);
  if (dup.rows[0]) return sendError(res, sendJson, 409, "USERNAME_EXISTS", "用户名已存在");

  const perms = body.permissions || PERMISSION_DEFAULTS[role] || [];
  const hash = await bcrypt.hash(password, 12);

  const { rows } = await query(`
    INSERT INTO admins (username, password_hash, display_name, role, permissions,
                        department, status, note, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(), NOW())
    RETURNING *
  `, [username, hash, display_name, role, JSON.stringify(perms), department, note, user.id]);

  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAccount(rows[0]) });
}

export async function handleSuperUpdateAccount(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (found[0].id === 1) return sendError(res, sendJson, 400, "PROTECTED", "超级管理员账号不可修改");

  const { display_name, role, department, status, permissions, note, new_password } = body || {};
  const sets = [];
  const params = [];
  let idx = 1;
  const add = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

  if (display_name)                                        add("display_name", display_name);
  if (department !== undefined)                             add("department",   department);
  if (note !== undefined)                                   add("note",         note);
  if (status && ["active","disabled"].includes(status))    add("status",       status);
  if (role && ROLE_META[role] && role !== "super_admin")   add("role",         role);
  if (permissions)                                          add("permissions",  JSON.stringify(permissions));
  if (new_password) {
    if (new_password.length < 8) return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    add("password_hash", await bcrypt.hash(new_password, 12));
  }
  if (sets.length === 0) return sendError(res, sendJson, 400, "NO_CHANGES", "未提供任何修改内容");

  sets.push("updated_at = NOW()");
  params.push(Number(id));

  const { rows } = await query(
    `UPDATE admins SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAccount(rows[0]) });
}

export async function handleSuperDeleteAccount(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");

  const { rows: found } = await query("SELECT id, role FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (found[0].id === 1) return sendError(res, sendJson, 400, "PROTECTED", "不能删除超级管理员账号");
  if (found[0].id === user.id) return sendError(res, sendJson, 400, "SELF_DELETE", "不能删除自己的账号");

  await query("DELETE FROM admins WHERE id = $1", [Number(id)]);
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}

export async function handleSuperResetPassword(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");

  const { new_password } = body || {};
  if (!new_password || new_password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");

  const { rows: found } = await query("SELECT id FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (found[0].id === 1) return sendError(res, sendJson, 400, "PROTECTED", "超级管理员账号请通过修改密码接口操作");

  const hash = await bcrypt.hash(new_password, 12);
  await query(
    "UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hash, Number(id)]
  );
  sendJson(res, 200, { code: 200, msg: "密码重置成功" });
}

// ─── 系统管理员：操作员 CRUD（admin only） ─────────────────────────────────────

export async function handleAdminListMyAccounts(req, res, url, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const role   = url.searchParams.get("role")   || "";
  const status = url.searchParams.get("status") || "";

  const rolePlaceholders = OPERATOR_ROLES.map((_, i) => `$${i + 1}`).join(", ");
  let sql = `SELECT * FROM admins WHERE role IN (${rolePlaceholders})`;
  const params = [...OPERATOR_ROLES];
  let idx = OPERATOR_ROLES.length + 1;

  if (user.role === "admin") { sql += ` AND created_by = $${idx++}`; params.push(user.id); }
  if (role)   { sql += ` AND role = $${idx++}`;   params.push(role); }
  if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
  sql += " ORDER BY id";

  const { rows } = await query(sql, params);
  sendJson(res, 200, { code: 200, msg: "success", data: rows.map(safeAccount) });
}

export async function handleAdminCreateMyAccount(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const { username, password, display_name, role, department = "", note = "" } = body || {};
  if (!username || !password || !display_name || !role)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名、显示名、密码、角色均不能为空");
  if (!OPERATOR_ROLES.includes(role))
    return sendError(res, sendJson, 400, "INVALID_ROLE", `角色须为：${OPERATOR_ROLES.join(" / ")}`);
  if (password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");

  const dup = await query("SELECT id FROM admins WHERE username = $1", [username]);
  if (dup.rows[0]) return sendError(res, sendJson, 409, "USERNAME_EXISTS", "用户名已存在");

  const perms = body.permissions || PERMISSION_DEFAULTS[role] || [];
  const hash = await bcrypt.hash(password, 12);

  const { rows } = await query(`
    INSERT INTO admins (username, password_hash, display_name, role, permissions,
                        department, status, note, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(), NOW())
    RETURNING *
  `, [username, hash, display_name, role, JSON.stringify(perms), department, note, user.id]);

  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAccount(rows[0]) });
}

export async function handleAdminUpdateMyAccount(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(found[0].role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能管理操作员账号");
  if (user.role === "admin" && found[0].created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能管理自己创建的账号");

  const { display_name, role, department, status, permissions, note, new_password } = body || {};
  const sets = [];
  const params = [];
  let idx = 1;
  const add = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

  if (display_name)                                         add("display_name", display_name);
  if (department !== undefined)                              add("department",   department);
  if (note !== undefined)                                    add("note",         note);
  if (status && ["active","disabled"].includes(status))     add("status",       status);
  if (role && OPERATOR_ROLES.includes(role))                add("role",         role);
  if (permissions)                                           add("permissions",  JSON.stringify(permissions));
  if (new_password) {
    if (new_password.length < 8) return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    add("password_hash", await bcrypt.hash(new_password, 12));
  }
  if (sets.length === 0) return sendError(res, sendJson, 400, "NO_CHANGES", "未提供任何修改内容");

  sets.push("updated_at = NOW()");
  params.push(Number(id));

  const { rows } = await query(
    `UPDATE admins SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAccount(rows[0]) });
}

export async function handleAdminDeleteMyAccount(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(found[0].role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能删除操作员账号");
  if (user.role === "admin" && found[0].created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能删除自己创建的账号");

  await query("DELETE FROM admins WHERE id = $1", [Number(id)]);
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}

export async function handleAdminResetMyPassword(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const { new_password } = body || {};
  if (!new_password || new_password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(found[0].role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能重置操作员密码");
  if (user.role === "admin" && found[0].created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能重置自己创建的账号密码");

  const hash = await bcrypt.hash(new_password, 12);
  await query(
    "UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hash, Number(id)]
  );
  sendJson(res, 200, { code: 200, msg: "密码重置成功" });
}
