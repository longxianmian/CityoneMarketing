// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止 profile / check-follow / identify 各自维护不同身份真源。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "../db/pool.js";
import { resolveOssUrl } from "../services/ossService.js";

// 先读规范再改代码：
// - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
// - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
//
// 强约束：
// - user-profile / check-follow 是用户端身份与关注状态真源
// - 前端不得再根据昵称、头像、points 账户自行推断身份
// - identity_level 只能由后端统一计算

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

function resolveBenefitActionType(row) {
  const explicit = String(row?.benefit_action_type || "").trim();
  if (
    explicit === "charge_scan" ||
    explicit === "product_exchange" ||
    explicit === "physical_delivery" ||
    explicit === "benefit_detail"
  ) {
    return explicit;
  }

  const itemType = String(row?.item_type || "").toLowerCase();
  const couponType = String(row?.coupon_type || "").toLowerCase();
  const discountType = String(row?.discount_type || "").toLowerCase();

  if (itemType === "physical") return "physical_delivery";
  if (
    discountType === "free_order" ||
    couponType.includes("exchange") ||
    couponType.includes("gift") ||
    couponType.includes("product")
  ) {
    return "product_exchange";
  }
  if (
    discountType === "free_time" ||
    discountType === "free_minutes" ||
    discountType === "fixed" ||
    discountType === "fixed_off" ||
    discountType === "percent" ||
    discountType === "percentage_off"
  ) {
    return "charge_scan";
  }
  return "benefit_detail";
}

// ─── 用户身份与业务身份真源 ────────────────────────────────────────────────────
// 唯一身份：
//   line_user_id -> user_id
// 业务身份等级：
//   visitor -> fan -> customer -> member
function deriveIdentityLevel({ lineUserId = "", isFan = false, hasChargeOrder = false, depositPaid = false } = {}) {
  if (!lineUserId) return "visitor";
  if (!isFan) return "visitor";
  if (depositPaid) return "member";
  if (hasChargeOrder) return "customer";
  return "fan";
}

function pickLatestTruthy(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

async function findUserRow(identityKey) {
  if (!identityKey) return null;
  const res = await query(
    `SELECT user_id, line_user_id, device_id, display_name, picture_url, language,
            is_fan, has_charge_order, deposit_paid, identity_level,
            created_at, updated_at, last_identified_at, last_follow_checked_at
       FROM users
      WHERE user_id = $1 OR line_user_id = $1 OR device_id = $1
      ORDER BY CASE
        WHEN user_id = $1 THEN 0
        WHEN line_user_id = $1 THEN 1
        ELSE 2
      END
      LIMIT 1`,
    [identityKey]
  );
  return res.rows[0] || null;
}

async function readBusinessFlags(identityKey, lineUserId = "") {
  const jsonAccounts = loadJsonArray(dataFile("points-accounts.json"));
  const jsonAccount = jsonAccounts.find(
    (a) =>
      (identityKey && (a.user_id === identityKey || a.line_user_id === identityKey)) ||
      (lineUserId && (a.user_id === lineUserId || a.line_user_id === lineUserId))
  ) || null;

  let dbAccount = null;
  if (identityKey || lineUserId) {
    const probe = lineUserId || identityKey;
    const res = await query(
      `SELECT deposit_paid, has_used_charging, updated_at
         FROM points_accounts
        WHERE user_id = $1 OR line_user_id = $1
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1`,
      [probe]
    ).catch(() => ({ rows: [] }));
    dbAccount = res.rows[0] || null;
  }

  return {
    depositPaid:
      dbAccount?.deposit_paid === true ||
      jsonAccount?.deposit_paid === true,
    hasChargeOrder:
      dbAccount?.has_used_charging === true ||
      jsonAccount?.has_used_charging === true,
    jsonAccount,
    dbAccount,
  };
}

async function ensureUserState(
  identityKey,
  {
    displayName = "",
    pictureUrl = "",
    lineUserHint = "",
    friendshipHint = false,
    touchFollowAt = false,
    touchIdentifyAt = false,
  } = {}
) {
  if (!identityKey && !lineUserHint) {
    return {
      userId: "",
      lineUserId: "",
      displayName: "",
      pictureUrl: "",
      isFan: false,
      hasChargeOrder: false,
      depositPaid: false,
      identityLevel: "visitor",
      source: "none",
      memberLevel: "standard",
    };
  }

  const fans = loadJsonArray(dataFile("fans.json"));
  let row = null;
  try {
    row = await findUserRow(identityKey || lineUserHint);
  } catch {
    row = null;
  }

  const lineUserId = String(
    pickLatestTruthy(
      lineUserHint,
      row?.line_user_id,
      /^U[0-9a-f]{32}$/i.test(identityKey || "") ? identityKey : ""
    )
  ).trim();
  const canonicalUserId = String(pickLatestTruthy(row?.user_id, lineUserId, identityKey)).trim();
  const fanMatched = !!lineUserId && fans.some((f) => f.user_id === lineUserId || f.line_user_id === lineUserId);

  const businessFlags = await readBusinessFlags(canonicalUserId || identityKey, lineUserId);
  const isFan = friendshipHint === true || row?.is_fan === true || fanMatched;
  const depositPaid = row?.deposit_paid === true || businessFlags.depositPaid;
  const hasChargeOrder = row?.has_charge_order === true || businessFlags.hasChargeOrder;
  const identityLevel = deriveIdentityLevel({
    lineUserId,
    isFan,
    hasChargeOrder,
    depositPaid,
  });

  const mergedDisplayName = isFan
    ? pickLatestTruthy(displayName, row?.display_name, businessFlags.jsonAccount?.line_display_name)
    : "";
  const mergedPictureUrl = isFan
    ? pickLatestTruthy(pictureUrl, row?.picture_url, businessFlags.jsonAccount?.line_picture_url)
    : "";
  const memberLevel = identityLevel === "member" ? "member" : "standard";

  if (canonicalUserId) {
    await query(
      `INSERT INTO users (
         user_id, line_user_id, device_id, display_name, picture_url, language,
         is_fan, has_charge_order, deposit_paid, identity_level,
         created_at, updated_at, last_identified_at, last_follow_checked_at
       )
       VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), 'zh',
               $6, $7, $8, $9, NOW(), NOW(),
               CASE WHEN $10 THEN NOW() ELSE NULL END,
               CASE WHEN $11 THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id) DO UPDATE SET
         line_user_id = COALESCE(EXCLUDED.line_user_id, users.line_user_id),
         device_id = COALESCE(EXCLUDED.device_id, users.device_id),
         display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
         picture_url = COALESCE(NULLIF(EXCLUDED.picture_url, ''), users.picture_url),
         is_fan = EXCLUDED.is_fan,
         has_charge_order = EXCLUDED.has_charge_order,
         deposit_paid = EXCLUDED.deposit_paid,
         identity_level = EXCLUDED.identity_level,
         updated_at = NOW(),
         last_identified_at = CASE WHEN $10 THEN NOW() ELSE users.last_identified_at END,
         last_follow_checked_at = CASE WHEN $11 THEN NOW() ELSE users.last_follow_checked_at END`,
      [
        canonicalUserId,
        lineUserId || null,
        lineUserId ? null : canonicalUserId,
        mergedDisplayName,
        mergedPictureUrl,
        isFan,
        hasChargeOrder,
        depositPaid,
        identityLevel,
        touchIdentifyAt,
        touchFollowAt,
      ]
    ).catch(() => {});
  }

  return {
    userId: canonicalUserId,
    lineUserId,
    displayName: mergedDisplayName || "",
    pictureUrl: mergedPictureUrl || "",
    isFan,
    hasChargeOrder,
    depositPaid,
    identityLevel,
    source: row ? "users_table" : fanMatched ? "fans_bootstrap" : "runtime_identity",
    memberLevel,
  };
}

async function resolveFollowState(identityKey) {
  const state = await ensureUserState(identityKey, { touchFollowAt: true });
  return {
    lineUserId: state.lineUserId,
    isFan: state.isFan,
    source: state.source,
  };
}

// ─── GET /api/user/profile ────────────────────────────────────────────────────
// 返回用户综合资料对象（积分账户 + 身份字段）
// 阶段三：identityTag 由系统规则推断；depositPaid 目前固定 false（待阶段四 A 系统押金桥接）
export async function handleUserProfile(req, res, url, sendJson) {
  const identityKey = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const state = await ensureUserState(identityKey, { touchFollowAt: true });

  let availablePoints = 0;
  let totalPoints = 0;
  let depositAmount = 0;
  let memberLevel = state.identityLevel === "member" ? "member" : "standard";

  if (state.userId || state.lineUserId) {
    try {
      const pRes = await query(
        `SELECT available_points, total_points, deposit_amount, member_level
           FROM points_accounts
          WHERE user_id = $1
             OR line_user_id = $1
             OR ($2 <> '' AND (user_id = $2 OR line_user_id = $2))
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1`,
        [state.userId || identityKey, state.lineUserId || ""]
      );
      if (pRes.rows.length) {
        availablePoints = Number(pRes.rows[0].available_points || 0);
        totalPoints = Number(pRes.rows[0].total_points || 0);
        depositAmount = Number(pRes.rows[0].deposit_amount || 0);
        memberLevel = pRes.rows[0].member_level || memberLevel;
      }
    } catch {
      // keep zero defaults
    }
  }

  let couponCount = 0;
  if (state.userId || state.lineUserId) {
    try {
      const cRes = await query(
        `SELECT COUNT(*) AS cnt
           FROM user_coupons
          WHERE ((user_id = $1 OR line_user_id = $1)
             OR ($2 <> '' AND (user_id = $2 OR line_user_id = $2)))
            AND product_status = 'claimed'`,
        [state.userId || identityKey, state.lineUserId || ""]
      );
      couponCount = Number(cRes.rows[0]?.cnt || 0);
    } catch {
      // keep zero defaults
    }
  }

  const profile = {
    user_id: state.userId || "",
    line_user_id: state.lineUserId || "",
    display_name: state.isFan ? state.displayName : "",
    picture_url: state.isFan ? state.pictureUrl : "",
    line_display_name: state.isFan ? state.displayName : "",
    line_picture_url: state.isFan ? state.pictureUrl : "",
    is_fan: state.isFan,
    identity_level: state.identityLevel,
    identity_tag: state.identityLevel,
    follow_source: state.source,
    deposit_paid: state.depositPaid,
    has_charge_order: state.hasChargeOrder,
    deposit_amount: depositAmount,
    member_level: memberLevel,
    available_points: availablePoints,
    total_points: totalPoints,
    coupon_count: couponCount,
    data_source: "users_profile_me",
    updated_at: new Date().toISOString(),
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
        c.coupon_type                 AS coupon_type,
        c.item_type,
        c.discount_type,
        c.discount_value,
        c.cover_image,
        c.cover_video,
        c.benefit_action_type,
        c.linked_mall_item_id,
        mi.name                       AS linked_mall_item_name,
        mi.on_shelf                   AS linked_mall_item_on_shelf,
        uc.product_status,
        uc.claimed_at                 AS issued_at,
        uc.used_at,
        c.valid_from,
        c.valid_to                    AS expire_at,
        c.min_amount,
        c.total_count,
        c.claimed_count,
        uc.source_type                AS source,
        uc.source_entry_id,
        uc.source_landing_id,
        uc.source_banner_id,
        uc.source_channel_id,
        uc.source_station_code,
        uc.source_a_system_station_id,
        uc.source_device_code,
        uc.updated_at
      FROM user_coupons uc
      LEFT JOIN coupons c ON c.id = uc.coupon_id
      LEFT JOIN mall_items mi ON mi.id = c.linked_mall_item_id
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
      coupon_type:        row.coupon_type  || row.product_type || "general",
      item_type:          row.item_type    || "digital",
      discount_type:      row.discount_type || "",
      discount_value:     Number(row.discount_value || 0),
      cover_image:        resolveOssUrl(row.cover_image || ""),
      cover_video:        resolveOssUrl(row.cover_video || ""),
      linked_mall_item_id: row.linked_mall_item_id || "",
      linked_mall_item_name: row.linked_mall_item_name || null,
      linked_mall_item_on_shelf: row.linked_mall_item_on_shelf == null ? null : Boolean(row.linked_mall_item_on_shelf),
      product_subtitle:   "",
      short_benefit_text: buildBenefitText(row.discount_type, row.discount_value),
      status:             mapStatus(row.product_status),
      product_status:     row.product_status,
      issued_at:          row.issued_at   ? new Date(row.issued_at).toISOString()  : "",
      used_at:            row.used_at     ? new Date(row.used_at).toISOString()    : "",
      valid_from:         row.valid_from  ? new Date(row.valid_from).toISOString() : "",
      expire_at:          row.expire_at   ? new Date(row.expire_at).toISOString()  : "",
      min_amount:         Number(row.min_amount || 0),
      total_count:        Number(row.total_count || 0),
      claimed_count:      Number(row.claimed_count || 0),
      source:             row.source      || "system",
      source_entry_id:    row.source_entry_id || "",
      source_landing_id:  row.source_landing_id  || "",
      source_banner_id:   row.source_banner_id || "",
      source_channel_id:  row.source_channel_id  || "",
      source_station_code: row.source_station_code || "",
      source_a_system_station_id: row.source_a_system_station_id || "",
      source_device_code: row.source_device_code || "",
      benefit_action_type: resolveBenefitActionType(row),
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
//   1. userId 以 'U' 开头（真实 LINE User ID）→ 优先检查 users.is_fan
//   2. users 未命中或仍为 false → 回退检查 fans.json（LINE webhook / set-fan 写入）
//   3. 其他（设备 UUID dev_xxx）→ 兼容旧逻辑：检查 points-accounts.json
//
// fans.json 由 LINE webhook follow 事件写入（见 handleLineWebhook）
export async function handleCheckFollow(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  if (!userId) {
    return sendJson(res, 200, { code: 200, data: { is_fan: false, reason: "no_user_id" } });
  }
  const followState = await resolveFollowState(userId);
  return sendJson(res, 200, {
    code: 200,
    data: {
      line_user_id: followState.lineUserId || (/^U/i.test(userId) ? userId : ""),
      is_fan: followState.isFan,
      source: followState.source,
    },
  });
}

// ─── POST /api/user/sync-profile ──────────────────────────────────────────────
// LIFF 初始化完成后，前端将 LINE 用户资料同步至后端
// body: { line_user_id, line_display_name, line_picture_url }
// 若 points-accounts.json 有该用户 → 更新 name/picture；无 → 不创建（关注门控负责）
export async function handleSyncProfile(req, res, body, sendJson) {
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

  await query(
    `UPDATE users
        SET display_name = COALESCE(NULLIF($2, ''), display_name),
            picture_url = COALESCE(NULLIF($3, ''), picture_url),
            updated_at = NOW()
      WHERE user_id = $1 OR line_user_id = $1`,
    [line_user_id, line_display_name, line_picture_url]
  ).catch(() => {});

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
      await query(
        `UPDATE users
            SET is_fan = TRUE,
                line_user_id = COALESCE(line_user_id, $1),
                identity_level = CASE
                  WHEN deposit_paid = TRUE THEN 'member'
                  WHEN has_charge_order = TRUE THEN 'customer'
                  ELSE 'fan'
                END,
                updated_at = NOW(),
                last_follow_checked_at = NOW()
          WHERE user_id = $1 OR line_user_id = $1`,
        [lineUserId]
      ).catch(() => {});
    } else if (event.type === "unfollow") {
      const before = fans.length;
      fans = fans.filter((f) => f.user_id !== lineUserId && f.line_user_id !== lineUserId);
      if (fans.length !== before) changed = true;
      await query(
        `UPDATE users
            SET is_fan = FALSE,
                identity_level = 'visitor',
                updated_at = NOW(),
                last_follow_checked_at = NOW()
          WHERE user_id = $1 OR line_user_id = $1`,
        [lineUserId]
      ).catch(() => {});
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
// body: { user_id, line_user_id?, line_display_name?, line_picture_url? }
// line_user_id 是真实 LINE UID（U...），user_id 可能是 canonical UUID 或设备 ID
export async function handleSetFan(req, res, body, sendJson) {
  const { user_id = "", line_user_id = "", line_display_name = "", line_picture_url = "" } = body || {};
  if (!user_id) {
    return sendJson(res, 400, { code: 400, error: "missing_user_id" });
  }

  // 用于查找的有效 LINE UID（优先用显式传入的 line_user_id，否则回退到 user_id）
  const effectiveLineId = line_user_id || user_id;

  const fansFile = dataFile("fans.json");
  const fans = loadJsonArray(fansFile);
  // 同时按 user_id 和 line_user_id 查找，避免同一人因不同 ID 格式重复写入
  const exists = fans.findIndex(
    (f) => f.user_id === user_id || f.line_user_id === user_id ||
           (effectiveLineId && (f.user_id === effectiveLineId || f.line_user_id === effectiveLineId))
  );

  if (exists >= 0) {
    // 已存在 → 更新资料，同时补全 line_user_id 字段（如之前用设备ID存入的记录）
    if (line_user_id && fans[exists].line_user_id !== line_user_id) {
      fans[exists].line_user_id = line_user_id;
    }
    fans[exists].line_display_name = line_display_name || fans[exists].line_display_name;
    fans[exists].line_picture_url  = line_picture_url  || fans[exists].line_picture_url;
    fans[exists].updated_at = new Date().toISOString();
  } else {
    fans.push({
      user_id,
      line_user_id: effectiveLineId,
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

  await ensureUserState(line_user_id || user_id, {
    lineUserHint: line_user_id || effectiveLineId,
    displayName: line_display_name,
    pictureUrl: line_picture_url,
    friendshipHint: true,
    touchFollowAt: true,
  });

  return sendJson(res, 200, { code: 200, msg: "fan registered", user_id });
}

// ─── POST /api/user/identify ──────────────────────────────────────────────────
// 全系统统一用户身份解析入口
// LIFF 初始化后前端必须调用此接口，获取 canonical user_id
//
// 输入：{ line_user_id?, device_id?, display_name?, picture_url?, language? }
// 输出：{ user_id, line_user_id, device_id, display_name, is_fan, identity_level, is_new }
export async function handleUserIdentify(req, res, body, sendJson) {
  const {
    line_user_id = "",
    device_id = "",
    display_name = "",
    picture_url = "",
    language = "zh",
    is_fan = false,
  } = body || {};

  if (!line_user_id && !device_id) {
    return sendError(res, sendJson, 400, "MISSING_IDENTITY", "必须传入 line_user_id 或 device_id");
  }

  try {
    const existing = await findUserRow(line_user_id || device_id);
    const state = await ensureUserState(line_user_id || device_id, {
      lineUserHint: line_user_id,
      displayName: display_name,
      pictureUrl: picture_url,
      friendshipHint: is_fan === true,
      touchFollowAt: true,
      touchIdentifyAt: true,
    });
    const isNew = !existing;

    if (line_user_id && state.isFan) {
      const now = new Date().toISOString();
      const fansFile = dataFile("fans.json");
      const fansArr = loadJsonArray(fansFile);
      const fi = fansArr.findIndex((f) => f.user_id === line_user_id || f.line_user_id === line_user_id);
      if (fi >= 0) {
        if (display_name) fansArr[fi].line_display_name = display_name;
        if (picture_url) fansArr[fi].line_picture_url = picture_url;
        fansArr[fi].updated_at = now;
      } else {
        fansArr.push({
          user_id: state.userId,
          line_user_id,
          line_display_name: display_name || "",
          line_picture_url: picture_url || "",
          followed_at: now,
          updated_at: now,
          source: "identify_friendship",
        });
      }
      try { fs.writeFileSync(fansFile, JSON.stringify(fansArr, null, 2)); } catch {}
    }

    return sendOk(res, sendJson, "identity resolved", {
      user_id: state.userId || line_user_id || device_id,
      line_user_id: state.lineUserId || null,
      device_id: device_id || null,
      display_name: state.isFan ? (state.displayName || null) : null,
      picture_url: state.isFan ? (state.pictureUrl || null) : null,
      is_fan: state.isFan,
      identity_level: state.identityLevel,
      identity_tag: state.identityLevel,
      deposit_paid: state.depositPaid,
      has_charge_order: state.hasChargeOrder,
      member_level: state.memberLevel,
      is_new: isNew,
    });
  } catch (err) {
    console.error("[identify] error:", err);
    // 降级：即使 DB 失败也返回基本信息（不阻塞用户）
    return sendOk(res, sendJson, "identity resolved (degraded)", {
      user_id: line_user_id || device_id,
      line_user_id: line_user_id || null,
      device_id: device_id || null,
      is_fan: false,
      identity_level: line_user_id ? "visitor" : "visitor",
      identity_tag: "visitor",
      is_new: false,
    });
  }
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
