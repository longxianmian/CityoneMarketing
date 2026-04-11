import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "../db/pool.js";

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
export async function handleUserProfile(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";

  const accounts = loadJsonArray(dataFile("points-accounts.json"));
  const account = accounts.find(
    (a) => userId && (a.user_id === userId || a.line_user_id === userId)
  ) || null;

  const depositPaid = account?.deposit_paid ?? false;
  const depositAmount = account?.deposit_amount ?? 0;
  const identityTag = resolveIdentityTag(account, depositPaid);

  // 可用卡券数：从 user_coupons DB 表查（与领取写入路径一致）
  let couponCount = 0;
  try {
    if (userId) {
      const cRes = await query(
        `SELECT COUNT(*) AS cnt FROM user_coupons
         WHERE (user_id = $1 OR line_user_id = $1) AND product_status = 'claimed'`,
        [userId]
      );
      couponCount = Number(cRes.rows[0]?.cnt || 0);
    }
  } catch { /* DB 不可用时降级为 0 */ }

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
    coupon_count: couponCount,
    data_source: "system_derived",
    updated_at: account?.updated_at || new Date().toISOString(),
  };

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
// 返回用户已领取的卡券/权益（读取 user_coupons DB 表，与领取写入路径完全一致）
// status 映射：claimed → available；used → used；expired/revoked → expired
//
// 数据来源：user_coupons JOIN coupons（PostgreSQL）
// 不再读取 user-products.json（旧 JSON 文件，已废弃）
export async function handleUserBenefits(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const statusFilter = url.searchParams.get("status") || "";  // available | used | expired
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  if (!userId) {
    return sendOk(res, sendJson, "no user_id", {
      items: [], total: 0, page, page_size: pageSize,
    });
  }

  // 将前端 status 参数映射为 DB 中的 product_status 值
  const dbStatusFilter = {
    available: ["claimed"],
    used:      ["used"],
    expired:   ["expired", "revoked"],
  }[statusFilter] || null;

  try {
    // 统计总数
    const countParams = [userId, userId];
    let countWhere = "(uc.user_id = $1 OR uc.line_user_id = $2)";
    if (dbStatusFilter) {
      countWhere += ` AND uc.product_status = ANY($3::text[])`;
      countParams.push(dbStatusFilter);
    }
    const countRes = await query(
      `SELECT COUNT(*) AS cnt FROM user_coupons uc WHERE ${countWhere}`,
      countParams
    );
    const total = Number(countRes.rows[0]?.cnt || 0);

    // 分页数据：JOIN coupons 获取名称/类型/到期时间
    const dataParams = [userId, userId];
    let dataWhere = "(uc.user_id = $1 OR uc.line_user_id = $2)";
    if (dbStatusFilter) {
      dataWhere += ` AND uc.product_status = ANY($3::text[])`;
      dataParams.push(dbStatusFilter);
    }
    const limitIdx  = dataParams.length + 1;
    const offsetIdx = dataParams.length + 2;
    dataParams.push(pageSize, (page - 1) * pageSize);

    const dataRes = await query(`
      SELECT
        uc.id                         AS user_product_id,
        uc.coupon_id                  AS product_id,
        c.name                        AS product_name,
        c.coupon_type                 AS product_type,
        c.discount_type,
        c.discount_value,
        uc.product_status,
        uc.claimed_at                 AS issued_at,
        uc.used_at,
        c.valid_to                    AS expire_at,
        uc.source_type                AS source,
        uc.source_landing_id,
        uc.source_channel_id,
        uc.updated_at
      FROM user_coupons uc
      LEFT JOIN coupons c ON c.id = uc.coupon_id
      WHERE ${dataWhere}
      ORDER BY uc.claimed_at DESC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, dataParams);

    function mapStatus(ps) {
      if (ps === "claimed") return "available";
      if (ps === "used")    return "used";
      return "expired";
    }

    // 将 discount_type + discount_value 构建简短权益文案（前端 short_benefit_text）
    function buildBenefitText(discountType, discountValue) {
      const val = Number(discountValue || 0);
      if (discountType === "percentage_off")        return val ? `${val}% off` : "";
      if (discountType === "free_minutes" ||
          discountType === "free_time")             return val ? `免费充电 ${val} 分钟` : "";
      if (discountType === "fixed_off")             return val ? `减 ฿${val}` : "";
      if (discountType === "free_order")            return val ? `免费商品 (价值 ฿${val})` : "";
      return "";
    }

    const items = dataRes.rows.map((row) => ({
      user_product_id:    row.user_product_id,
      product_id:         row.product_id  || "",
      product_name:       row.product_name || "权益卡券",   // JSONB {zh,th,en} 或 null
      product_type:       row.product_type || "coupon",
      product_subtitle:   "",
      short_benefit_text: buildBenefitText(row.discount_type, row.discount_value),
      status:             mapStatus(row.product_status),
      product_status:     row.product_status,
      issued_at:          row.issued_at   ? new Date(row.issued_at).toISOString()  : "",
      used_at:            row.used_at     ? new Date(row.used_at).toISOString()    : "",
      expire_at:          row.expire_at   ? new Date(row.expire_at).toISOString()  : "",
      source:             row.source      || "system",
      source_landing_id:  row.source_landing_id  || "",
      source_channel_id:  row.source_channel_id  || "",
      bridge_status:      "",
    }));

    return sendOk(res, sendJson, "user benefits loaded", {
      items,
      total,
      page,
      page_size: pageSize,
      data_source: "user_coupons_db",
    });
  } catch (err) {
    return sendJson(res, 500, { code: 500, error: "DB_ERROR", msg: err.message });
  }
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
