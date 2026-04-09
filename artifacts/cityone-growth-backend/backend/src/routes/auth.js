/**
 * 管理端认证路由（PostgreSQL 版）
 * POST /api/admin/login   — 登录，返回 JWT
 * POST /api/admin/logout  — 登出（客户端丢弃 token 即可）
 * GET  /api/admin/me      — 获取当前登录管理员信息
 * GET  /api/admin/admins           — [super_admin] 管理员列表
 * POST /api/admin/admins           — [super_admin] 新建管理员
 * POST /api/admin/admins/:id/update  — [super_admin] 修改管理员
 * POST /api/admin/admins/:id/delete  — [super_admin] 删除管理员
 * POST /api/admin/change-password   — 修改自己的密码
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/pool.js";

const IS_PROD = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD
  ? (() => { throw new Error("JWT_SECRET environment variable is required in production"); })()
  : "cityone-dev-jwt-secret-do-not-use-in-prod");
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

// ── 角色层级定义 ──────────────────────────────────────────────────────────────
export const ROLES = {
  super_admin:    { label: "超级管理员",       level: 100 },
  admin:          { label: "管理员",           level: 50  },
  growth_content: { label: "推广内容操作员",   level: 30  },
  growth_data:    { label: "推广数据操作员",   level: 25  },
  ops_activity:   { label: "运营活动操作员",   level: 20  },
  ops_data:       { label: "运营数据操作员",   level: 15  },
  // 旧别名兼容
  operator_1:     { label: "操作员Ⅰ",         level: 30  },
  operator_2:     { label: "操作员Ⅱ",         level: 20  },
  operator_3:     { label: "操作员Ⅲ（只读）", level: 10  },
};

const ROLE_ROUTE_ACCESS = {
  super_admin:    ["*"],
  admin:          ["/api/dashboard", "/api/growth", "/api/activities", "/api/coupons",
                   "/api/stations", "/api/entries", "/api/admin/me", "/api/admin/change-password"],
  growth_content: ["/api/growth/coupon", "/api/growth/mall", "/api/admin/me", "/api/admin/change-password"],
  growth_data:    ["/api/dashboard/stats", "/api/admin/me", "/api/admin/change-password"],
  ops_activity:   ["/api/activities", "/api/admin/me", "/api/admin/change-password"],
  ops_data:       ["/api/dashboard/stats", "/api/admin/me", "/api/admin/change-password"],
  operator_1:     ["/api/dashboard/stats", "/api/activities", "/api/coupons", "/api/admin/me", "/api/admin/change-password"],
  operator_2:     ["/api/dashboard/stats", "/api/admin/me", "/api/admin/change-password"],
  operator_3:     ["/api/dashboard/stats", "/api/admin/me"],
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, error: errorCode, msg });
}

function safeAdmin(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  // JSONB 列 PostgreSQL 返回已解析的对象/数组，直接使用
  return rest;
}

// ── JWT 签发 / 校验 ───────────────────────────────────────────────────────────
export function signToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role, display_name: admin.display_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── JWT 鉴权中间件（挂载到 index.js） ────────────────────────────────────────
export function requireAuth(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try { return verifyToken(token); } catch { return null; }
}

export function hasAccess(role, urlPath) {
  const allowed = ROLE_ROUTE_ACCESS[role] || [];
  if (allowed.includes("*")) return true;
  return allowed.some((prefix) => urlPath.startsWith(prefix));
}

// ── 路由处理器 ────────────────────────────────────────────────────────────────

/** POST /api/admin/login */
export async function handleAdminLogin(req, body, res, sendJson) {
  const { username, password } = body || {};
  if (!username || !password)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名和密码不能为空");

  const { rows } = await query(
    "SELECT * FROM admins WHERE username = $1 AND status = 'active'",
    [username]
  );
  const admin = rows[0];
  if (!admin)
    return sendError(res, sendJson, 401, "INVALID_CREDENTIALS", "用户名或密码错误");

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok)
    return sendError(res, sendJson, 401, "INVALID_CREDENTIALS", "用户名或密码错误");

  // 更新最后登录时间
  await query("UPDATE admins SET last_login_at = NOW() WHERE id = $1", [admin.id]);
  admin.last_login_at = new Date().toISOString();

  const token = signToken(admin);
  sendJson(res, 200, {
    code: 200, msg: "登录成功",
    data: { token, admin: safeAdmin(admin) },
  });
}

/** POST /api/admin/logout */
export function handleAdminLogout(req, res, sendJson) {
  sendJson(res, 200, { code: 200, msg: "已登出" });
}

/** GET /api/admin/me */
export async function handleAdminMe(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTHORIZED", "请先登录");

  const { rows } = await query("SELECT * FROM admins WHERE id = $1", [user.id]);
  if (!rows[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  sendJson(res, 200, { code: 200, data: safeAdmin(rows[0]) });
}

/** POST /api/admin/change-password */
export async function handleChangePassword(req, body, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTHORIZED", "请先登录");
  const { old_password, new_password } = body || {};
  if (!old_password || !new_password)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "请填写旧密码和新密码");
  if (new_password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "新密码至少 8 位");

  const { rows } = await query("SELECT * FROM admins WHERE id = $1", [user.id]);
  if (!rows[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");

  const ok = await bcrypt.compare(old_password, rows[0].password_hash);
  if (!ok) return sendError(res, sendJson, 401, "WRONG_PASSWORD", "旧密码不正确");

  const newHash = await bcrypt.hash(new_password, 12);
  await query(
    "UPDATE admins SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2",
    [newHash, user.id]
  );
  sendJson(res, 200, { code: 200, msg: "密码已修改，请重新登录" });
}

/** GET /api/admin/admins  [super_admin] */
export async function handleListAdmins(req, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const { rows } = await query("SELECT * FROM admins ORDER BY id");
  sendJson(res, 200, { code: 200, data: rows.map(safeAdmin) });
}

/** POST /api/admin/admins  [super_admin] */
export async function handleCreateAdmin(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const { username, password, display_name, role, department } = body || {};
  if (!username || !password || !role)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名、密码、角色不能为空");
  if (!ROLES[role])
    return sendError(res, sendJson, 400, "INVALID_ROLE", `角色须为：${Object.keys(ROLES).join(" / ")}`);
  if (role === "super_admin")
    return sendError(res, sendJson, 400, "FORBIDDEN_ROLE", "不能创建超级管理员账号");
  if (password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");

  const dup = await query("SELECT id FROM admins WHERE username = $1", [username]);
  if (dup.rows[0])
    return sendError(res, sendJson, 409, "DUPLICATE_USERNAME", "用户名已存在");

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(`
    INSERT INTO admins (username, password_hash, display_name, role, department,
                        status, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
    RETURNING *
  `, [username, hash, display_name || username, role, department || "", user.id]);

  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAdmin(rows[0]) });
}

/** POST /api/admin/admins/:id/update  [super_admin] */
export async function handleUpdateAdmin(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (found[0].role === "super_admin" && found[0].id === 1)
    return sendError(res, sendJson, 400, "PROTECTED", "超级管理员基础账号不可修改角色");

  const { display_name, role, department, status, new_password } = body || {};
  const sets = [];
  const params = [];
  let idx = 1;
  const add = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

  if (display_name)                                   add("display_name", display_name);
  if (department !== undefined)                        add("department",   department);
  if (status && ["active","disabled"].includes(status)) add("status",      status);
  if (role && ROLES[role] && role !== "super_admin")  add("role",         role);
  if (new_password) {
    if (new_password.length < 8)
      return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    add("password_hash", await bcrypt.hash(new_password, 12));
  }
  if (sets.length === 0) return sendError(res, sendJson, 400, "NO_CHANGES", "未提供任何修改内容");

  sets.push(`updated_at = NOW()`);
  params.push(Number(id));

  const { rows } = await query(
    `UPDATE admins SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAdmin(rows[0]) });
}

/** POST /api/admin/admins/:id/delete  [super_admin] */
export async function handleDeleteAdmin(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const { rows: found } = await query("SELECT * FROM admins WHERE id = $1", [Number(id)]);
  if (!found[0]) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (found[0].role === "super_admin" && found[0].id === 1)
    return sendError(res, sendJson, 400, "PROTECTED", "不能删除超级管理员账号");
  if (found[0].id === user.id)
    return sendError(res, sendJson, 400, "SELF_DELETE", "不能删除自己的账号");

  await query("DELETE FROM admins WHERE id = $1", [Number(id)]);
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}
