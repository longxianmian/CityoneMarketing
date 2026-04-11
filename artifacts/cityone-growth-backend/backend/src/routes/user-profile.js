import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function loadJsonArray(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}

function sendError(res, sendJson, status, code, msg) {
  return sendJson(res, status, { code: status, error: code, msg });
}

// ─── 用户身份规则映射 ─────────────────────────────────────────────────────────
// identityTag 判断规则（本系统内）：
// - member：depositPaid === true
// - fan：仅关注 OA，尚未进入任何业务链路（points_account 中无记录）
// - user：已进入业务链路（有 points 账户记录，但未缴押金）
function resolveIdentityTag(account, depositPaid) {
  if (depositPaid) return "member";
  if (!account) return "fan";
  return "user";
}

// ─── GET /api/user/profile ────────────────────────────────────────────────────
// 返回用户综合资料对象（积分账户 + 身份字段）
// 阶段三：identityTag 由系统规则推断；depositPaid 目前固定 false（待阶段四 A 系统押金桥接）
export function handleUserProfile(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";

  const accounts = loadJsonArray(dataFile("points-accounts.json"));
  const account = accounts.find(
    (a) => userId && (a.user_id === userId || a.line_user_id === userId)
  ) || null;

  // 阶段三：押金状态来自 user-deposit 字段（若账户中存在），否则 false
  // 阶段四会接 A 系统真实押金状态
  const depositPaid = account?.deposit_paid ?? false;
  const depositAmount = account?.deposit_amount ?? 0;

  const identityTag = resolveIdentityTag(account, depositPaid);

  const profile = {
    user_id: userId,
    line_user_id: userId,
    line_display_name: account?.line_display_name || "",
    line_picture_url: account?.line_picture_url || "",
    identity_tag: identityTag,
    deposit_paid: depositPaid,
    deposit_amount: depositAmount,
    member_level: account?.member_level || "standard",
    available_points: account?.available_points ?? 0,
    total_points: account?.total_points ?? 0,
    coupon_count: 0,
    data_source: "system_derived",
    data_note: "identity_tag 由系统规则推断；deposit_paid 阶段三为本系统内字段，阶段四接 A 系统",
    updated_at: account?.updated_at || new Date().toISOString(),
  };

  // 计算可用卡券数
  const userProducts = loadJsonArray(dataFile("user-products.json"));
  const availableBenefits = userProducts.filter(
    (up) =>
      (up.line_user_id === userId || up.user_id === userId) &&
      up.product_status === "claimed"
  );
  profile.coupon_count = availableBenefits.length;

  return sendOk(res, sendJson, "user profile loaded", profile);
}

// ─── GET /api/user/prizes ─────────────────────────────────────────────────────
// 返回用户活动互动中获得的奖品记录（result_type = 'prize'）
// 数据来源：activity-interactions.json + activity-prizes.json + digital-products.json
export function handleUserPrizes(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  if (!userId) {
    return sendOk(res, sendJson, "no user_id", {
      items: [],
      total: 0,
      page,
      page_size: pageSize,
      data_note: "请传入 user_id 或 line_user_id",
    });
  }

  const interactions = loadJsonArray(dataFile("activity-interactions.json"));
  const prizes = loadJsonArray(dataFile("activity-prizes.json"));
  const digitalProducts = loadJsonArray(dataFile("digital-products.json"));

  const userInteractions = interactions
    .filter(
      (ia) =>
        (ia.line_user_id === userId || ia.user_id === userId) &&
        ia.result_type === "prize"
    )
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = userInteractions.length;
  const paged = userInteractions.slice((page - 1) * pageSize, page * pageSize);

  const items = paged.map((ia) => {
    const prize = prizes.find((p) => p.prize_id === ia.action_result_id) || null;
    const product = ia.related_product_id
      ? digitalProducts.find((d) => d.product_id === ia.related_product_id) || null
      : null;

    return {
      interaction_id: ia.interaction_id,
      activity_id: ia.activity_id || "",
      interaction_type: ia.interaction_type || "",
      prize_id: ia.action_result_id || "",
      prize_name: prize?.prize_name || ia.prize_name || "活动奖品",
      prize_type: prize?.prize_type || "coupon",
      product_id: ia.related_product_id || "",
      product_name: product?.product_name || "",
      prize_status: ia.prize_status || "granted",
      result_type: ia.result_type,
      created_at: ia.created_at,
    };
  });

  return sendOk(res, sendJson, "user prizes loaded", {
    items,
    total,
    page,
    page_size: pageSize,
    data_source: "activity_interactions",
    data_note: "来自本系统活动互动记录，仅包含 result_type=prize 的中奖记录",
  });
}

// ─── GET /api/user/benefits ───────────────────────────────────────────────────
// 返回用户的权益/卡券记录（来自 user-products.json）
// status 映射：claimed → available；used → used；expired → expired；cancelled/refunded → cancelled
export function handleUserBenefits(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  if (!userId) {
    return sendOk(res, sendJson, "no user_id", {
      items: [],
      total: 0,
      page,
      page_size: pageSize,
      data_note: "请传入 user_id 或 line_user_id",
    });
  }

  const userProducts = loadJsonArray(dataFile("user-products.json"));
  const digitalProducts = loadJsonArray(dataFile("digital-products.json"));

  const VALID_STATUSES = ["claimed", "used", "expired", "cancelled", "refunded"];

  let userBenefits = userProducts.filter(
    (up) => up.line_user_id === userId || up.user_id === userId
  );

  // 状态映射
  function mapStatus(productStatus) {
    if (productStatus === "claimed") return "available";
    if (productStatus === "used") return "used";
    if (productStatus === "expired") return "expired";
    return "cancelled";
  }

  // 外部 status 过滤（available/used/expired）
  if (statusFilter) {
    userBenefits = userBenefits.filter(
      (up) => mapStatus(up.product_status) === statusFilter
    );
  }

  userBenefits = userBenefits
    .sort((a, b) => new Date(b.issued_at || b.created_at || 0) - new Date(a.issued_at || a.created_at || 0));

  const total = userBenefits.length;
  const paged = userBenefits.slice((page - 1) * pageSize, page * pageSize);

  const items = paged.map((up) => {
    const product = digitalProducts.find((d) => d.product_id === up.product_id) || null;
    const statusDisplay = mapStatus(up.product_status);

    return {
      user_product_id: up.user_product_id,
      product_id: up.product_id || "",
      product_name: up.product_name || product?.product_name || "权益卡券",
      product_type: up.product_type || product?.product_type || "coupon",
      product_subtitle: product?.product_subtitle || "",
      short_benefit_text: product?.short_benefit_text || "",
      status: statusDisplay,
      product_status: up.product_status,
      issued_at: up.issued_at || up.created_at || "",
      used_at: up.used_at || "",
      expire_at: up.expire_at || product?.expire_at || "",
      source: up.grant_source || up.source || "system",
      bridge_status: up.bridge_status || "",
    };
  });

  return sendOk(res, sendJson, "user benefits loaded", {
    items,
    total,
    page,
    page_size: pageSize,
    data_source: "user_products",
    data_note: "来自本系统用户产品记录（卡券/权益），status=available/used/expired",
  });
}

// ─── GET /api/user/check-follow ───────────────────────────────────────────────
// 判断用户是否已关注 LINE OA
//
// 判断规则（按优先级）：
//   1. userId 以 'U' 开头（真实 LINE User ID）→ 检查 fans.json（LINE webhook 写入）
//   2. 其他（设备 UUID dev_xxx）→ 兼容旧逻辑：检查 points-accounts.json
//
// fans.json 由 LINE webhook follow 事件写入（见 handleLineWebhook）
export function handleCheckFollow(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  if (!userId) {
    return sendJson(res, 200, { code: 200, data: { is_fan: false, reason: "no_user_id" } });
  }

  // 真实 LINE User ID（以大写 U 开头，长度约 33 位）
  const isRealLineUser = /^U[0-9a-f]{32}$/i.test(userId);

  if (isRealLineUser) {
    // 检查粉丝专用列表（LINE webhook 写入）
    const fans = loadJsonArray(dataFile("fans.json"));
    const isFan = fans.some((f) => f.user_id === userId || f.line_user_id === userId);
    return sendJson(res, 200, {
      code: 200,
      data: { is_fan: isFan, identity_tag: isFan ? "fan" : "visitor", source: "fans_list" },
    });
  }

  // 设备 UUID：兼容旧逻辑，保持开发环境可测试
  const accounts = loadJsonArray(dataFile("points-accounts.json"));
  const account = accounts.find(
    (a) => a.user_id === userId || a.line_user_id === userId
  ) || null;
  const isFan = !!account;
  return sendJson(res, 200, {
    code: 200,
    data: { is_fan: isFan, identity_tag: isFan ? (account?.identity_tag || "fan") : "visitor", source: "device_compat" },
  });
}

// ─── POST /api/user/sync-profile ──────────────────────────────────────────────
// LIFF 初始化完成后，前端将 LINE 用户资料同步至后端
// body: { line_user_id, line_display_name, line_picture_url }
// 若 points-accounts.json 有该用户 → 更新 name/picture；无 → 不创建（关注门控负责）
export function handleSyncProfile(req, res, body, sendJson) {
  const {
    line_user_id = "",
    line_display_name = "",
    line_picture_url = "",
  } = body || {};

  if (!line_user_id) {
    return sendJson(res, 400, { code: 400, error: "missing_line_user_id" });
  }

  // 更新 fans.json 中的头像/昵称
  const fansFile = dataFile("fans.json");
  const fans = loadJsonArray(fansFile);
  const fanIdx = fans.findIndex(
    (f) => f.user_id === line_user_id || f.line_user_id === line_user_id
  );
  if (fanIdx >= 0) {
    fans[fanIdx].line_display_name = line_display_name || fans[fanIdx].line_display_name;
    fans[fanIdx].line_picture_url = line_picture_url || fans[fanIdx].line_picture_url;
    fans[fanIdx].updated_at = new Date().toISOString();
    try { fs.writeFileSync(fansFile, JSON.stringify(fans, null, 2)); } catch {}
  }

  // 同样更新 points-accounts.json（用于 user-profile 接口返回头像昵称）
  const accountsFile = dataFile("points-accounts.json");
  const accounts = loadJsonArray(accountsFile);
  const accIdx = accounts.findIndex(
    (a) => a.user_id === line_user_id || a.line_user_id === line_user_id
  );
  if (accIdx >= 0) {
    accounts[accIdx].line_display_name = line_display_name || accounts[accIdx].line_display_name;
    accounts[accIdx].line_picture_url = line_picture_url || accounts[accIdx].line_picture_url;
    accounts[accIdx].updated_at = new Date().toISOString();
    try { fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2)); } catch {}
  }

  return sendJson(res, 200, { code: 200, msg: "profile synced" });
}

// ─── POST /api/line/webhook ───────────────────────────────────────────────────
// LINE Messaging API Webhook 接收端
// 处理 follow 事件 → 写入 fans.json（粉丝列表）
// 处理 unfollow 事件 → 从 fans.json 移除
// 其他事件忽略
export async function handleLineWebhook(req, res, body, sendJson) {
  const events = body?.events || [];

  const fansFile = dataFile("fans.json");
  let fans = loadJsonArray(fansFile);
  let changed = false;

  for (const event of events) {
    const lineUserId = event?.source?.userId;
    if (!lineUserId) continue;

    if (event.type === "follow") {
      // 添加到粉丝列表（去重）
      const exists = fans.some((f) => f.user_id === lineUserId || f.line_user_id === lineUserId);
      if (!exists) {
        fans.push({
          user_id: lineUserId,
          line_user_id: lineUserId,
          line_display_name: "",
          line_picture_url: "",
          followed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        changed = true;
      }
    } else if (event.type === "unfollow") {
      const before = fans.length;
      fans = fans.filter((f) => f.user_id !== lineUserId && f.line_user_id !== lineUserId);
      if (fans.length !== before) changed = true;
    }
  }

  if (changed) {
    try { fs.writeFileSync(fansFile, JSON.stringify(fans, null, 2)); } catch (e) {
      console.error("[Webhook] Failed to write fans.json:", e);
    }
  }

  // LINE 要求 webhook 返回 200
  return sendJson(res, 200, { code: 200, msg: "ok", processed: events.length });
}

// ─── POST /api/user/set-fan ───────────────────────────────────────────────────
// 用户点击「关注 LINE OA」按钮时前端主动调用，预写入 fans.json
// 这样不需要等待 LINE webhook 配置即可让粉丝路径正常走通
// body: { user_id, line_display_name?, line_picture_url? }
export function handleSetFan(req, res, body, sendJson) {
  const { user_id = "", line_display_name = "", line_picture_url = "" } = body || {};
  if (!user_id) {
    return sendJson(res, 400, { code: 400, error: "missing_user_id" });
  }

  const fansFile = dataFile("fans.json");
  const fans = loadJsonArray(fansFile);
  const exists = fans.findIndex((f) => f.user_id === user_id || f.line_user_id === user_id);

  if (exists >= 0) {
    // 已存在 → 更新资料
    fans[exists].line_display_name = line_display_name || fans[exists].line_display_name;
    fans[exists].line_picture_url  = line_picture_url  || fans[exists].line_picture_url;
    fans[exists].updated_at = new Date().toISOString();
  } else {
    fans.push({
      user_id,
      line_user_id: user_id,
      line_display_name,
      line_picture_url,
      followed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: "follow_button",   // 区分于 webhook 写入
    });
  }

  try {
    fs.writeFileSync(fansFile, JSON.stringify(fans, null, 2));
  } catch (e) {
    return sendJson(res, 500, { code: 500, error: "write_failed" });
  }

  return sendJson(res, 200, { code: 200, msg: "fan registered", user_id });
}

// ─── GET /api/user/orders ─────────────────────────────────────────────────────
// 本系统内订单记录（当前阶段三：借电订单待阶段四 A 系统桥接）
// 返回真实空列表 + 明确说明
export function handleUserOrders(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  return sendOk(res, sendJson, "user orders loaded", {
    items: [],
    total: 0,
    page,
    page_size: pageSize,
    borrow_orders_status: "pending_bridge",
    data_source: "pending_a_system_bridge",
    data_note: "借电订单来自 A 系统，阶段三尚未桥接。阶段四完成 A 系统借电订单真实回流后，此接口将返回真实数据。",
  });
}
