/**
 * 会员管理路由
 *
 * GET  /api/admin/members              — 会员/用户列表（管理员可见）
 * GET  /api/admin/member-config        — 会员权益配置
 * POST /api/admin/member-config/update — 更新会员权益配置
 * POST /api/admin/members/:id/set-member — 手动设置/取消会员（押金桥接前临时操作）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.join(__dirname, "..", "..", "..");
const DATA_DIR = path.join(BACKEND_DIR, "data");

const ACCOUNTS_FILE = path.join(DATA_DIR, "points-accounts.json");
const CONFIG_FILE = path.join(DATA_DIR, "member-config.json");
const INTERACTIONS_FILE = path.join(DATA_DIR, "interactions.json");

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch { return null; }
}
function readJsonArray(file) {
  const v = readJson(file);
  return Array.isArray(v) ? v : [];
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function sendError(res, sendJson, code, errCode, msg) {
  return sendJson(res, code, { code, error: errCode, msg });
}

function resolveIdentityTag(account) {
  if (!account) return "fan";
  if (account.deposit_paid) return "member";
  return "user";
}

/** GET /api/admin/members */
export function handleListMembers(req, res, url, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");

  const accounts = readJsonArray(ACCOUNTS_FILE);
  const interactions = readJsonArray(INTERACTIONS_FILE);

  const filterTag = url.searchParams.get("tag") || "";   // member / user / fan / ""
  const keyword = url.searchParams.get("q") || "";

  const interactionCountMap = {};
  for (const ia of interactions) {
    if (ia.user_id) interactionCountMap[ia.user_id] = (interactionCountMap[ia.user_id] || 0) + 1;
  }

  let list = accounts.map((a) => {
    const tag = resolveIdentityTag(a);
    return {
      user_id: a.user_id || a.line_user_id || "",
      line_user_id: a.line_user_id || "",
      line_display_name: a.line_display_name || "—",
      identity_tag: tag,
      identity_label: tag === "member" ? "会员" : tag === "user" ? "普通用户" : "粉丝",
      deposit_paid: a.deposit_paid || false,
      deposit_amount: a.deposit_amount || 0,
      available_points: a.available_points || 0,
      total_points: a.total_points || 0,
      interaction_count: interactionCountMap[a.user_id || a.line_user_id] || 0,
      joined_at: a.created_at || a.updated_at || null,
      updated_at: a.updated_at || null,
    };
  });

  if (filterTag) list = list.filter((u) => u.identity_tag === filterTag);
  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(
      (u) => u.line_display_name.toLowerCase().includes(kw) || u.user_id.includes(kw)
    );
  }

  const total = accounts.length;
  const memberCount = accounts.filter((a) => a.deposit_paid).length;
  const userCount = accounts.filter((a) => !a.deposit_paid).length;

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: { list, total, memberCount, userCount, fanCount: 0 },
  });
}

/** GET /api/admin/member-config */
export function handleGetMemberConfig(req, res, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");
  const config = readJson(CONFIG_FILE) || {};
  sendJson(res, 200, { code: 200, msg: "success", data: config });
}

/** POST /api/admin/member-config/update */
export function handleUpdateMemberConfig(req, body, res, sendJson) {
  const user = req._admin;
  if (!user || !["super_admin", "admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "仅管理员可修改会员配置");

  const config = readJson(CONFIG_FILE) || {};

  if (body.charging_discount !== undefined) {
    config.charging_discount = {
      ...config.charging_discount,
      ...body.charging_discount,
    };
  }
  if (body.deposit !== undefined) {
    config.deposit = { ...config.deposit, ...body.deposit };
  }
  if (body.extra_benefits !== undefined) {
    config.extra_benefits = body.extra_benefits;
  }

  config.updated_at = new Date().toISOString();
  config.updated_by = user.username;
  writeJson(CONFIG_FILE, config);
  sendJson(res, 200, { code: 200, msg: "更新成功", data: config });
}

/**
 * GET /api/charging-discount/check?user_id=xxx&order_amount=xxx
 *
 * 充电折扣查询接口（A 系统旁路对接预留口）
 *
 * 当前阶段（阶段三）：
 *   - 本系统自行读取 member-config.json + points-accounts.json 判断折扣资格
 *   - 返回 discount_rate（折扣率）和 discount_source="local"
 *
 * 阶段四（A 系统旁路对接）：
 *   - A 系统在订单结算前调用本接口，本接口转发给 A 系统订单引擎
 *   - 或者 A 系统主动推送订单结算钩子，本系统作为折扣策略服务响应
 *   - 实现方式：将下方 TODO 块替换为真实 A 系统 API 调用
 *   - 返回中 discount_source 改为 "a_system"
 */
export function handleCheckChargingDiscount(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || "";
  const orderAmount = parseFloat(url.searchParams.get("order_amount") || "0");

  const config = readJson(CONFIG_FILE) || {};
  const discountConfig = config.charging_discount || {};

  if (!discountConfig.enabled) {
    return sendJson(res, 200, {
      code: 200, msg: "no_discount",
      data: { eligible: false, discount_rate: 1, discount_amount: 0, final_amount: orderAmount, reason: "会员充电折扣未启用" },
    });
  }

  const accounts = readJsonArray(ACCOUNTS_FILE);
  const account = accounts.find((a) => a.user_id === userId || a.line_user_id === userId);
  const isMember = account?.deposit_paid === true;

  // TODO(阶段四 A 系统旁路对接)：
  // 在此处调用 A 系统 API 校验用户押金/会员状态，替代本地 deposit_paid 判断
  // 示例：const aResult = await fetchASystemMemberStatus(userId)
  //       const isMember = aResult.is_member === true
  // discount_source 改为 "a_system"

  if (!isMember) {
    return sendJson(res, 200, {
      code: 200, msg: "not_member",
      data: { eligible: false, discount_rate: 1, discount_amount: 0, final_amount: orderAmount, reason: "非会员用户" },
    });
  }

  const rate = discountConfig.rate ?? 0.9;
  const discountAmount = orderAmount > 0 ? parseFloat((orderAmount * (1 - rate)).toFixed(2)) : 0;
  const finalAmount = orderAmount > 0 ? parseFloat((orderAmount * rate).toFixed(2)) : 0;

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      eligible: true,
      discount_rate: rate,
      discount_label: discountConfig.label_zh || `${rate * 10}折`,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      original_amount: orderAmount,
      discount_source: "local",           // 阶段四改为 "a_system"
      apply_scope: discountConfig.apply_scope || "all_stations",
    },
  });
}

/** POST /api/admin/members/:id/set-member */
export async function handleSetMember(req, body, userId, res, sendJson) {
  const user = req._admin;
  if (!user || !["super_admin", "admin"].includes(user.role))
    return sendError(res, sendJson, 403, "FORBIDDEN", "无权限");

  const accounts = readJsonArray(ACCOUNTS_FILE);
  const idx = accounts.findIndex(
    (a) => a.user_id === userId || a.line_user_id === userId
  );
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "用户不存在");

  const { deposit_paid, deposit_amount } = body || {};
  if (deposit_paid !== undefined) accounts[idx].deposit_paid = Boolean(deposit_paid);
  if (deposit_amount !== undefined) accounts[idx].deposit_amount = Number(deposit_amount);
  accounts[idx].updated_at = new Date().toISOString();
  writeJson(ACCOUNTS_FILE, accounts);

  sendJson(res, 200, {
    code: 200,
    msg: deposit_paid ? "已设置为会员" : "已取消会员身份",
    data: { user_id: userId, deposit_paid: accounts[idx].deposit_paid },
  });
}
