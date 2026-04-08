/**
 * 客户管理路由
 *
 * 三层客户身份定义：
 *   fan    — 关注了 LINE OA，尚未产生任何充电/使用记录
 *   user   — 曾经使用过充电（押金已退 或 营销活动免费体验），当前无押金
 *   member — 缴纳押金且正在使用充电宝服务
 *
 * GET  /api/admin/customers              — 客户列表（三层人群）
 * GET  /api/admin/member-config          — 会员权益配置
 * POST /api/admin/member-config/update   — 更新权益配置
 * POST /api/admin/customers/:id/set-member — 手动设置/取消会员（押金桥接前临时）
 * GET  /api/charging-discount/check      — A 系统旁路折扣查询接口（阶段四对接）
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

/**
 * 三层身份推断规则
 *
 * member  — deposit_paid === true
 * user    — deposit_paid === false，但 has_used_charging=true 或 interactionCount > 0
 *           （曾缴纳押金后退款，或营销活动免费体验过充电宝）
 * fan     — 仅关注了 OA，interactionCount === 0，且无充电记录
 *
 * 阶段四 A 系统旁路对接后：
 *   has_used_charging 字段将由 A 系统推送写入，届时判断更准确
 */
function resolveIdentityTag(account, interactionCount = 0) {
  if (!account) return "fan";
  if (account.deposit_paid) return "member";
  // 明确标记过曾使用充电宝（押金退款/免费体验）
  if (account.has_used_charging) return "user";
  // 互动次数 > 0 推断曾产生业务行为
  if (interactionCount > 0) return "user";
  return "fan";
}

/**
 * 来源渠道推断
 * 优先读 account.source 字段（阶段四由 A 系统写入）；
 * 否则根据身份和 account.source_hint 推断展示标签
 */
function resolveSource(account, identityTag) {
  if (account.source) return account.source;
  if (identityTag === "member") return "押金缴纳";
  if (account.has_used_charging && account.source_hint === "marketing") return "营销活动体验";
  if (account.has_used_charging && account.source_hint === "refund") return "押金退款用户";
  if (account.has_used_charging) return "充电体验用户";
  return "LINE OA 关注";
}

/** GET /api/admin/customers */
export function handleListCustomers(req, res, url, sendJson) {
  const user = req._admin;
  if (!user) return sendError(res, sendJson, 401, "UNAUTH", "未登录");

  const accounts = readJsonArray(ACCOUNTS_FILE);
  const interactions = readJsonArray(INTERACTIONS_FILE);

  const filterTag = url.searchParams.get("tag") || "";  // member / user / fan / ""
  const keyword = url.searchParams.get("q") || "";

  // 互动次数 map
  const interactionCountMap = {};
  for (const ia of interactions) {
    const uid = ia.user_id || ia.line_user_id;
    if (uid) interactionCountMap[uid] = (interactionCountMap[uid] || 0) + 1;
  }

  let list = accounts.map((a) => {
    const uid = a.user_id || a.line_user_id || "";
    const iCount = interactionCountMap[uid] || 0;
    const tag = resolveIdentityTag(a, iCount);
    const source = resolveSource(a, tag);

    const LABEL = { member: "会员", user: "用户", fan: "粉丝" };

    // 权益（阶段三留空，阶段四/五扩展）
    const benefits = tag === "member"
      ? [{ key: "charging_discount", label: "充电9折", status: "active" }]
      : [];

    return {
      user_id: uid,
      line_user_id: a.line_user_id || "",
      line_display_name: a.line_display_name || "—",
      identity_tag: tag,
      identity_label: LABEL[tag] || tag,
      source,
      deposit_paid: a.deposit_paid || false,
      deposit_amount: a.deposit_amount || 0,
      has_used_charging: a.has_used_charging || false,
      available_points: a.available_points || 0,
      total_points: a.total_points || 0,
      interaction_count: iCount,
      benefits,          // 权益列表（会员有值，其余为空数组，后期填充）
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

  const allAccounts = readJsonArray(ACCOUNTS_FILE);
  const countFor = (tag) => allAccounts.filter((a, i) => {
    const uid = a.user_id || a.line_user_id || "";
    const ic = interactionCountMap[uid] || 0;
    return resolveIdentityTag(a, ic) === tag;
  }).length;

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      list,
      total: accounts.length,
      memberCount: countFor("member"),
      userCount: countFor("user"),
      fanCount: countFor("fan"),
    },
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
  if (body.charging_discount !== undefined)
    config.charging_discount = { ...config.charging_discount, ...body.charging_discount };
  if (body.deposit !== undefined)
    config.deposit = { ...config.deposit, ...body.deposit };
  if (body.extra_benefits !== undefined)
    config.extra_benefits = body.extra_benefits;

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
 *   本系统自行读取 member-config.json + points-accounts.json 判断折扣资格
 *   返回 discount_rate 和 discount_source="local"
 *
 * 阶段四（A 系统旁路对接）：
 *   A 系统在订单结算前调用本接口，本接口转发给 A 系统订单引擎
 *   将下方 TODO 块替换为真实 A 系统 API 调用
 *   discount_source 改为 "a_system"
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
      discount_source: "local",          // 阶段四改为 "a_system"
      apply_scope: discountConfig.apply_scope || "all_stations",
    },
  });
}

/** POST /api/admin/customers/:id/set-member */
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

// ── 旧函数名兼容导出（index.js 中引用的是 handleListMembers）──────────────
export const handleListMembers = handleListCustomers;
