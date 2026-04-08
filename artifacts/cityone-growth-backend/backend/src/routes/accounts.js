/**
 * 账户管理路由
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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const TEMPLATES_FILE = path.join(DATA_DIR, "role_templates.json");

const OPERATOR_ROLES = ["growth_content", "growth_data", "ops_activity", "ops_data"];

const ROLE_META = {
  super_admin:    { label: "超级管理员", level: 100, color: "red" },
  admin:          { label: "管理员",     level: 50,  color: "purple" },
  growth_content: { label: "推广内容操作员", level: 30, color: "blue" },
  growth_data:    { label: "推广数据操作员", level: 25, color: "cyan" },
  ops_activity:   { label: "运营活动操作员", level: 20, color: "green" },
  ops_data:       { label: "运营数据操作员", level: 15, color: "orange" },
};

const PERMISSION_DEFAULTS = {
  admin:          ["growth:content:write", "growth:data:read", "ops:activity:write", "ops:data:read", "admin:accounts:manage"],
  growth_content: ["growth:content:write", "growth:data:read"],
  growth_data:    ["growth:data:read"],
  ops_activity:   ["ops:activity:write", "ops:data:read"],
  ops_data:       ["ops:data:read"],
};

function readAdmins() {
  try { return JSON.parse(fs.readFileSync(ADMINS_FILE, "utf8")); } catch { return []; }
}
function writeAdmins(list) {
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(list, null, 2), "utf8");
}
function readTemplates() {
  try { return JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf8")); } catch { return []; }
}
function safeAccount(a) {
  const { password_hash, ...rest } = a;
  return { ...rest, role_label: ROLE_META[a.role]?.label || a.role, role_color: ROLE_META[a.role]?.color || "default" };
}
function nextId(list) {
  return list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
}
function sendError(res, sendJson, code, errCode, msg) {
  return sendJson(res, code, { code, error: errCode, msg });
}

async function validateNewAccount(body, allowedRoles, admins, sendJson, res) {
  const { username, password, display_name, role } = body || {};
  if (!username || !password || !display_name || !role)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名、显示名、密码、角色均不能为空");
  if (!allowedRoles.includes(role))
    return sendError(res, sendJson, 400, "INVALID_ROLE", `角色须为：${allowedRoles.join(" / ")}`);
  if (password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
  if (admins.find((a) => a.username === username))
    return sendError(res, sendJson, 409, "USERNAME_EXISTS", "用户名已存在");
  return null;
}

// ─── 角色模板 ─────────────────────────────────────────────────────────────────

export function handleRoleTemplates(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");
  const templates = readTemplates();
  const isAdmin = user.role === "admin";
  const filtered = isAdmin
    ? templates.filter((t) => OPERATOR_ROLES.includes(t.key))
    : templates;
  sendJson(res, 200, { code: 200, msg: "success", data: filtered });
}

// ─── 超管中心：全量账号 CRUD（super_admin only） ───────────────────────────────

export function handleSuperListAccounts(req, res, url, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");
  const admins = readAdmins();
  const role = url.searchParams.get("role") || "";
  const status = url.searchParams.get("status") || "";
  let list = admins.filter((a) => a.id !== 1);
  if (role) list = list.filter((a) => a.role === role);
  if (status) list = list.filter((a) => a.status === status);
  sendJson(res, 200, { code: 200, msg: "success", data: list.map(safeAccount) });
}

export async function handleSuperCreateAccount(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");
  const allowedRoles = ["admin", ...OPERATOR_ROLES];
  const admins = readAdmins();
  const err = await validateNewAccount(body, allowedRoles, admins, sendJson, res);
  if (err !== null) return err;

  const { username, password, display_name, role, department = "", note = "" } = body;
  const perms = body.permissions || PERMISSION_DEFAULTS[role] || [];
  const hash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const newAccount = {
    id: nextId(admins), username, password_hash: hash,
    display_name, role, permissions: perms,
    department, status: "active",
    created_by: user.id, created_at: now, updated_at: now,
    last_login_at: null, note,
  };
  admins.push(newAccount);
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAccount(newAccount) });
}

export async function handleSuperUpdateAccount(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");
  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === Number(id));
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (admins[idx].id === 1) return sendError(res, sendJson, 400, "PROTECTED", "超级管理员账号不可修改");

  const { display_name, role, department, status, permissions, note, new_password } = body || {};
  if (display_name) admins[idx].display_name = display_name;
  if (department !== undefined) admins[idx].department = department;
  if (note !== undefined) admins[idx].note = note;
  if (status && ["active", "disabled"].includes(status)) admins[idx].status = status;
  if (role && ROLE_META[role] && role !== "super_admin") admins[idx].role = role;
  if (permissions) admins[idx].permissions = permissions;
  if (new_password) {
    if (new_password.length < 8) return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  }
  admins[idx].updated_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAccount(admins[idx]) });
}

export function handleSuperDeleteAccount(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");
  const admins = readAdmins();
  const target = admins.find((a) => a.id === Number(id));
  if (!target) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (target.id === 1) return sendError(res, sendJson, 400, "PROTECTED", "不能删除超级管理员账号");
  if (target.id === user.id) return sendError(res, sendJson, 400, "SELF_DELETE", "不能删除自己的账号");
  writeAdmins(admins.filter((a) => a.id !== Number(id)));
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}

export async function handleSuperResetPassword(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可访问");
  const { new_password } = body || {};
  if (!new_password || new_password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === Number(id));
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (admins[idx].id === 1) return sendError(res, sendJson, 400, "PROTECTED", "超级管理员账号请通过修改密码接口操作");
  admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  admins[idx].updated_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "密码重置成功" });
}

// ─── 系统管理员：操作员 CRUD（admin only） ─────────────────────────────────────

export function handleAdminListMyAccounts(req, res, url, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");
  const admins = readAdmins();
  const role = url.searchParams.get("role") || "";
  const status = url.searchParams.get("status") || "";
  let list = admins.filter((a) => OPERATOR_ROLES.includes(a.role));
  if (user.role === "admin") list = list.filter((a) => a.created_by === user.id);
  if (role) list = list.filter((a) => a.role === role);
  if (status) list = list.filter((a) => a.status === status);
  sendJson(res, 200, { code: 200, msg: "success", data: list.map(safeAccount) });
}

export async function handleAdminCreateMyAccount(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");
  const admins = readAdmins();
  const err = await validateNewAccount(body, OPERATOR_ROLES, admins, sendJson, res);
  if (err !== null) return err;

  const { username, password, display_name, role, department = "", note = "" } = body;
  const perms = body.permissions || PERMISSION_DEFAULTS[role] || [];
  const hash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const newAccount = {
    id: nextId(admins), username, password_hash: hash,
    display_name, role, permissions: perms,
    department, status: "active",
    created_by: user.id, created_at: now, updated_at: now,
    last_login_at: null, note,
  };
  admins.push(newAccount);
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAccount(newAccount) });
}

export async function handleAdminUpdateMyAccount(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");
  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === Number(id));
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(admins[idx].role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能管理操作员账号");
  if (user.role === "admin" && admins[idx].created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能管理自己创建的账号");

  const { display_name, role, department, status, permissions, note, new_password } = body || {};
  if (display_name) admins[idx].display_name = display_name;
  if (department !== undefined) admins[idx].department = department;
  if (note !== undefined) admins[idx].note = note;
  if (status && ["active", "disabled"].includes(status)) admins[idx].status = status;
  if (role && OPERATOR_ROLES.includes(role)) admins[idx].role = role;
  if (permissions) admins[idx].permissions = permissions;
  if (new_password) {
    if (new_password.length < 8) return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  }
  admins[idx].updated_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAccount(admins[idx]) });
}

export function handleAdminDeleteMyAccount(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");
  const admins = readAdmins();
  const target = admins.find((a) => a.id === Number(id));
  if (!target) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(target.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能删除操作员账号");
  if (user.role === "admin" && target.created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能删除自己创建的账号");
  writeAdmins(admins.filter((a) => a.id !== Number(id)));
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}

export async function handleAdminResetMyPassword(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || !["admin", "super_admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");
  const { new_password } = body || {};
  if (!new_password || new_password.length < 8)
    return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === Number(id));
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (!OPERATOR_ROLES.includes(admins[idx].role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能重置操作员密码");
  if (user.role === "admin" && admins[idx].created_by !== user.id)
    return sendError(res, sendJson, 403, "FORBIDDEN", "只能重置自己创建的账号密码");
  admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  admins[idx].updated_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "密码重置成功" });
}
