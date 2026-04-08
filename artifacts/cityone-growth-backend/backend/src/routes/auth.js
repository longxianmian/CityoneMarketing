/**
 * 管理端认证路由
 * POST /api/admin/login   — 登录，返回 JWT
 * POST /api/admin/logout  — 登出（客户端丢弃 token 即可）
 * GET  /api/admin/me      — 获取当前登录管理员信息
 * GET  /api/admin/admins           — [super_admin] 管理员列表
 * POST /api/admin/admins           — [super_admin] 新建管理员
 * POST /api/admin/admins/:id/update  — [super_admin] 修改管理员
 * POST /api/admin/admins/:id/delete  — [super_admin] 删除管理员
 * POST /api/admin/change-password   — 修改自己的密码
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");

const JWT_SECRET = process.env.JWT_SECRET || "cityone-dev-jwt-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

// ── 角色层级定义 ──────────────────────────────────────────────────────────
export const ROLES = {
  super_admin: { label: "超级管理员", level: 100 },
  admin:       { label: "管理员",     level: 50  },
  operator_1:  { label: "操作员Ⅰ",   level: 30  },
  operator_2:  { label: "操作员Ⅱ",   level: 20  },
  operator_3:  { label: "操作员Ⅲ（只读）", level: 10 },
};

// 各角色可访问的路由前缀白名单（前缀匹配）
const ROLE_ROUTE_ACCESS = {
  super_admin: ["*"],
  admin:       ["/api/dashboard", "/api/growth", "/api/activities", "/api/coupons",
                "/api/stations", "/api/entries", "/api/admin/me", "/api/admin/change-password"],
  operator_1:  ["/api/dashboard/stats", "/api/activities", "/api/coupons",
                "/api/admin/me", "/api/admin/change-password"],
  operator_2:  ["/api/dashboard/stats", "/api/admin/me", "/api/admin/change-password"],
  operator_3:  ["/api/dashboard/stats", "/api/admin/me"],
};

// ── 工具函数 ──────────────────────────────────────────────────────────────
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, error: errorCode, msg });
}

function readAdmins() {
  try { return JSON.parse(fs.readFileSync(ADMINS_FILE, "utf8")); } catch { return []; }
}

function writeAdmins(list) {
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(list, null, 2), "utf8");
}

function safeAdmin(a) {
  const { password_hash, ...rest } = a;
  return rest;
}

function nextId(list) {
  return list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
}

// ── JWT 签发 / 校验 ───────────────────────────────────────────────────────
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

// ── JWT 鉴权中间件（挂载到 index.js） ────────────────────────────────────
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

// ── 路由处理器 ────────────────────────────────────────────────────────────

/** POST /api/admin/login */
export async function handleAdminLogin(req, body, res, sendJson) {
  const { username, password } = body || {};
  if (!username || !password)
    return sendError(res, sendJson, 400, "MISSING_FIELDS", "用户名和密码不能为空");

  const admins = readAdmins();
  const admin = admins.find((a) => a.username === username && a.status === "active");
  if (!admin)
    return sendError(res, sendJson, 401, "INVALID_CREDENTIALS", "用户名或密码错误");

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok)
    return sendError(res, sendJson, 401, "INVALID_CREDENTIALS", "用户名或密码错误");

  // 更新最后登录时间
  const idx = admins.findIndex((a) => a.id === admin.id);
  admins[idx].last_login_at = new Date().toISOString();
  writeAdmins(admins);

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
export function handleAdminMe(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTHORIZED", "请先登录");
  const admins = readAdmins();
  const admin = admins.find((a) => a.id === user.id);
  if (!admin) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  sendJson(res, 200, { code: 200, data: safeAdmin(admin) });
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

  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === user.id);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");

  const ok = await bcrypt.compare(old_password, admins[idx].password_hash);
  if (!ok) return sendError(res, sendJson, 401, "WRONG_PASSWORD", "旧密码不正确");

  admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  admins[idx].password_changed_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "密码已修改，请重新登录" });
}

/** GET /api/admin/admins  [super_admin] */
export function handleListAdmins(req, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");
  const admins = readAdmins();
  sendJson(res, 200, { code: 200, data: admins.map(safeAdmin) });
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

  const admins = readAdmins();
  if (admins.find((a) => a.username === username))
    return sendError(res, sendJson, 409, "DUPLICATE_USERNAME", "用户名已存在");

  const newAdmin = {
    id: nextId(admins),
    username,
    password_hash: await bcrypt.hash(password, 12),
    display_name: display_name || username,
    role,
    department: department || "",
    status: "active",
    created_at: new Date().toISOString(),
    last_login_at: null,
    created_by: user.username,
  };
  admins.push(newAdmin);
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "创建成功", data: safeAdmin(newAdmin) });
}

/** POST /api/admin/admins/:id/update  [super_admin] */
export async function handleUpdateAdmin(req, body, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const admins = readAdmins();
  const idx = admins.findIndex((a) => a.id === Number(id));
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (admins[idx].role === "super_admin" && admins[idx].username === "superadmin")
    return sendError(res, sendJson, 400, "PROTECTED", "超级管理员基础账号不可修改角色");

  const { display_name, role, department, status, new_password } = body || {};
  if (display_name) admins[idx].display_name = display_name;
  if (department !== undefined) admins[idx].department = department;
  if (status && ["active", "disabled"].includes(status)) admins[idx].status = status;
  if (role && ROLES[role] && role !== "super_admin") admins[idx].role = role;
  if (new_password) {
    if (new_password.length < 8)
      return sendError(res, sendJson, 400, "WEAK_PASSWORD", "密码至少 8 位");
    admins[idx].password_hash = await bcrypt.hash(new_password, 12);
  }
  admins[idx].updated_at = new Date().toISOString();
  writeAdmins(admins);
  sendJson(res, 200, { code: 200, msg: "更新成功", data: safeAdmin(admins[idx]) });
}

/** POST /api/admin/admins/:id/delete  [super_admin] */
export function handleDeleteAdmin(req, id, res, sendJson) {
  const user = req._admin;
  if (!user || user.role !== "super_admin")
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅超级管理员可操作");

  const admins = readAdmins();
  const target = admins.find((a) => a.id === Number(id));
  if (!target) return sendError(res, sendJson, 404, "NOT_FOUND", "账号不存在");
  if (target.username === "superadmin")
    return sendError(res, sendJson, 400, "PROTECTED", "不能删除超级管理员账号");
  if (target.id === user.id)
    return sendError(res, sendJson, 400, "SELF_DELETE", "不能删除自己的账号");

  const updated = admins.filter((a) => a.id !== Number(id));
  writeAdmins(updated);
  sendJson(res, 200, { code: 200, msg: "删除成功" });
}
