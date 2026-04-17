/**
 * 卡券路由 — PostgreSQL 版
 * 替代原 JSON 文件存储；保持与前端完全相同的 API 响应结构
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { resolveOssUrl, normalizeManagedAssetRef } from "../services/ossService.js";
import { completeMlFieldMap, normalizeMlValue, syncMlSnapshotToOss } from "../services/multilingual-service.js";

// ── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, code, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: code });
}

function buildAttributionSnapshot(source = {}) {
  return {
    source_entry_id: String(source.source_entry_id || "").trim(),
    source_landing_id: String(source.source_landing_id || "").trim(),
    source_banner_id: String(source.source_banner_id || "").trim(),
    source_channel_id: String(source.source_channel_id || "").trim(),
    source_station_code: String(source.source_station_code || "").trim(),
    source_a_system_station_id: String(source.source_a_system_station_id || "").trim(),
    source_device_code: String(source.source_device_code || source.device_code || "").trim(),
  };
}

const BENEFIT_ACTION_TYPES = new Set([
  "benefit_detail",
  "charge_scan",
  "product_exchange",
  "physical_delivery",
]);

function createHttpError(statusCode, errorCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
}

async function normalizeBenefitConfig({ benefitActionType, linkedMallItemId, couponStatus }) {
  const actionType = String(benefitActionType || "benefit_detail").trim() || "benefit_detail";
  if (!BENEFIT_ACTION_TYPES.has(actionType)) {
    throw createHttpError(400, "INVALID_BENEFIT_ACTION", "不支持的权益动作类型");
  }

  const mallItemId = String(linkedMallItemId || "").trim();
  if (actionType !== "product_exchange") {
    return {
      benefitActionType: actionType,
      linkedMallItemId: null,
    };
  }

  if (!mallItemId) {
    throw createHttpError(400, "MISSING_LINKED_MALL_ITEM", "商品兑换券必须绑定一个积分商城商品");
  }

  const itemRes = await query(
    "SELECT id, on_shelf FROM mall_items WHERE id = $1 LIMIT 1",
    [mallItemId]
  );
  if (!itemRes.rows.length) {
    throw createHttpError(400, "LINKED_MALL_ITEM_NOT_FOUND", "所绑定的积分商城商品不存在");
  }

  const item = itemRes.rows[0];
  if (Number(couponStatus ?? 1) === 1 && !item.on_shelf) {
    throw createHttpError(400, "LINKED_MALL_ITEM_OFF_SHELF", "启用中的商品兑换券必须绑定上架商品");
  }

  return {
    benefitActionType: actionType,
    linkedMallItemId: mallItemId,
  };
}

async function getCouponById(couponId) {
  const result = await query(`
    SELECT
      c.*,
      mi.name AS linked_mall_item_name,
      mi.on_shelf AS linked_mall_item_on_shelf
    FROM coupons c
    LEFT JOIN mall_items mi ON mi.id = c.linked_mall_item_id
    WHERE c.id = $1
    LIMIT 1
  `, [couponId]);
  return result.rows[0] || null;
}

async function getCouponRewardBindingStats(couponId) {
  const result = await query(`
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE a.status = 'active') AS active_count
    FROM activity_product_bindings apb
    JOIN activities a ON a.activity_id = apb.activity_code
    WHERE apb.product_id = $1
      AND apb.binding_type = 'coupon'
      AND apb.trigger_event = 'participate'
  `, [couponId]);
  return {
    totalCount: Number(result.rows[0]?.total_count || 0),
    activeCount: Number(result.rows[0]?.active_count || 0),
  };
}

/** 将 pg 行规范化为 API 格式 */
function couponRow(row) {
  return {
    ...row,
    cover_image:    resolveOssUrl(row.cover_image),
    cover_video:    resolveOssUrl(row.cover_video),
    status:         Number(row.status),
    discount_value: Number(row.discount_value ?? 0),
    min_amount:     Number(row.min_amount ?? 0),
    total_count:    Number(row.total_count ?? 0),
    claimed_count:  Number(row.claimed_count ?? 0),
    benefit_action_type: row.benefit_action_type || "benefit_detail",
    linked_mall_item_id: row.linked_mall_item_id || "",
    linked_mall_item_name: row.linked_mall_item_name || null,
    linked_mall_item_on_shelf: row.linked_mall_item_on_shelf == null ? null : Boolean(row.linked_mall_item_on_shelf),
    valid_from:     row.valid_from  ? new Date(row.valid_from).toISOString()  : null,
    valid_to:       row.valid_to    ? new Date(row.valid_to).toISOString()    : null,
    created_at:     row.created_at  ? new Date(row.created_at).toISOString()  : null,
    updated_at:     row.updated_at  ? new Date(row.updated_at).toISOString()  : null,
  };
}

/** 将 user_coupons 行规范化 */
function userCouponRow(row) {
  return {
    ...row,
    claimed_at:  row.claimed_at  ? new Date(row.claimed_at).toISOString()  : null,
    used_at:     row.used_at     ? new Date(row.used_at).toISOString()     : null,
    expired_at:  row.expired_at  ? new Date(row.expired_at).toISOString()  : null,
    created_at:  row.created_at  ? new Date(row.created_at).toISOString()  : null,
    updated_at:  row.updated_at  ? new Date(row.updated_at).toISOString()  : null,
  };
}

/** 生成下一个顺序 coupon ID（形如 coupon_003） */
async function nextCouponId() {
  const res = await query(
    "SELECT id FROM coupons WHERE id ~ '^coupon_[0-9]+$'"
  );
  const max = res.rows.reduce((m, r) => {
    const matched = r.id.match(/^coupon_(\d+)$/);
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `coupon_${String(max + 1).padStart(3, "0")}`;
}

// ── 用户端：有效卡券列表 ─────────────────────────────────────────────────────
// GET /api/user/coupons
export async function handleUserCouponList(req, res, url, sendJson) {
  try {
    const now = new Date().toISOString();
    const result = await query(`
      SELECT
        c.*,
        mi.name AS linked_mall_item_name,
        mi.on_shelf AS linked_mall_item_on_shelf
      FROM coupons c
      LEFT JOIN mall_items mi ON mi.id = c.linked_mall_item_id
      WHERE c.status = 1
        AND (valid_to IS NULL OR valid_to > $1)
      ORDER BY c.created_at DESC
    `, [now]);
    return sendOk(res, sendJson, "ok", result.rows.map(couponRow));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：卡券列表（分页 + 搜索） ─────────────────────────────────────────
// GET /api/growth/coupon/list?pageNum=1&pageSize=10&name=xxx
export async function handleCouponList(req, res, url, sendJson) {
  try {
    const pageNum  = Math.max(1, Number(url.searchParams.get("pageNum")  || 1));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 10));
    const name     = (url.searchParams.get("name") || "").trim();
    const offset   = (pageNum - 1) * pageSize;

    let whereClauses = [];
    let dataWhereClauses = [];
    let params = [];
    let paramIdx = 1;

    if (name) {
      whereClauses.push(`(
        name::text ILIKE $${paramIdx}
        OR name->>'zh' ILIKE $${paramIdx}
        OR name->>'th' ILIKE $${paramIdx}
        OR name->>'en' ILIKE $${paramIdx}
      )`);
      dataWhereClauses.push(`(
        c.name::text ILIKE $${paramIdx}
        OR c.name->>'zh' ILIKE $${paramIdx}
        OR c.name->>'th' ILIKE $${paramIdx}
        OR c.name->>'en' ILIKE $${paramIdx}
      )`);
      params.push(`%${name}%`);
      paramIdx++;
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const dataWhere = dataWhereClauses.length ? `WHERE ${dataWhereClauses.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) AS total FROM coupons ${where}`, params);
    const total = Number(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT
         c.*,
         mi.name AS linked_mall_item_name,
         mi.on_shelf AS linked_mall_item_on_shelf
       FROM coupons c
       LEFT JOIN mall_items mi ON mi.id = c.linked_mall_item_id
       ${dataWhere}
       ORDER BY c.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return sendOk(res, sendJson, "ok", {
      rows:  dataRes.rows.map(couponRow),
      total,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// 安全数值转换：避免 NaN 写入数据库
function safeNum(val, fallback = 0) {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ── 管理端：新增卡券 ─────────────────────────────────────────────────────────
// POST /api/growth/coupon/add
export async function handleCouponAdd(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const { name, couponType, itemType, discountType, discountValue, minAmount, totalCount,
            status, validFrom, validTo, coverImage, coverVideo,
            benefitActionType, linkedMallItemId } = body;

    if (!name)         return sendError(res, sendJson, 400, "MISSING_NAME",  "券名称不能为空");
    if (!discountType) return sendError(res, sendJson, 400, "MISSING_DTYPE", "优惠方式不能为空");

    const normalizedConfig = await normalizeBenefitConfig({
      benefitActionType,
      linkedMallItemId,
      couponStatus: safeNum(status, 1),
    });
    const translatedFields = await completeMlFieldMap({
      name,
    }, body._sourceLang || body.sourceLang || "zh");

    const id = await nextCouponId();
    const nameVal = JSON.stringify(normalizeMlValue(translatedFields.name)); // 确保 JSONB 合法（字符串自动加引号）

    const stationScope = body.station_scope ? JSON.stringify(body.station_scope) : "{}";

    const result = await query(`
      INSERT INTO coupons
        (id, name, coupon_type, item_type, discount_type, discount_value, min_amount, total_count,
         claimed_count, status, valid_from, valid_to, cover_image, cover_video, station_scope,
         benefit_action_type, linked_mall_item_id, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `, [
      id,
      nameVal,
      couponType    || "general",
      itemType      || "digital",
      discountType,
      safeNum(discountValue, 0),
      safeNum(minAmount,     0),
      safeNum(totalCount,    0),
      safeNum(status,        1),
      validFrom     || null,
      validTo       || null,
      normalizeManagedAssetRef(coverImage, "cover_image") || "",
      normalizeManagedAssetRef(coverVideo, "cover_video") || "",
      stationScope,
      normalizedConfig.benefitActionType,
      normalizedConfig.linkedMallItemId,
    ]);

    const created = await getCouponById(result.rows[0].id);
    await syncMlSnapshotToOss("coupon", id, translatedFields).catch(() => null);
    return sendOk(res, sendJson, "创建成功", couponRow(created || result.rows[0]));
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "DB_ERROR",
      err.message
    );
  }
}

// ── 管理端：更新卡券 ─────────────────────────────────────────────────────────
// POST /api/growth/coupon/update
export async function handleCouponUpdate(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const { id, name, couponType, itemType, discountType, discountValue, minAmount, totalCount,
            status, validFrom, validTo, coverImage, coverVideo,
            benefitActionType, linkedMallItemId } = body;

    if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少券ID");

    // 检查存在
    const existing = await query("SELECT * FROM coupons WHERE id = $1", [id]);
    if (!existing.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该券");
    const existingCoupon = existing.rows[0];

    const nextStatus = status != null ? safeNum(status, 1) : Number(existingCoupon.status ?? 1);
    const nextBenefitActionType = benefitActionType != null
      ? (benefitActionType || "benefit_detail")
      : (existingCoupon.benefit_action_type || "benefit_detail");
    const nextLinkedMallItemId = linkedMallItemId !== undefined
      ? linkedMallItemId
      : existingCoupon.linked_mall_item_id;
    const normalizedConfig = await normalizeBenefitConfig({
      benefitActionType: nextBenefitActionType,
      linkedMallItemId: nextLinkedMallItemId,
      couponStatus: nextStatus,
    });
    const translatedFields = await completeMlFieldMap(
      name != null ? { name } : {},
      body._sourceLang || body.sourceLang || "zh"
    );

    if (nextStatus !== 1 && Number(existingCoupon.status ?? 1) === 1) {
      const rewardBindingStats = await getCouponRewardBindingStats(id);
      if (rewardBindingStats.activeCount > 0) {
        return sendError(
          res,
          sendJson,
          400,
          "COUPON_BOUND_TO_ACTIVE_ACTIVITY",
          "该卡券仍被上线中的活动作为奖励绑定，请先下线活动或解除绑定"
        );
      }
    }

    const sets = [];
    const params = [];
    let idx = 1;

    const addSet = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

    if (name          != null) addSet("name",           JSON.stringify(normalizeMlValue(translatedFields.name)));
    if (couponType    != null) addSet("coupon_type",    couponType);
    if (itemType      != null) addSet("item_type",      itemType);
    if (discountType  != null) addSet("discount_type",  discountType);
    if (discountValue != null) addSet("discount_value", safeNum(discountValue, 0));
    if (minAmount     != null) addSet("min_amount",     safeNum(minAmount, 0));
    if (totalCount    != null) addSet("total_count",    safeNum(totalCount, 0));
    if (status        != null) addSet("status",         safeNum(status, 1));
    if (validFrom     != null) addSet("valid_from",     validFrom || null);
    if (validTo       != null) addSet("valid_to",       validTo   || null);
    if (coverImage    != null) addSet("cover_image",    normalizeManagedAssetRef(coverImage, "cover_image"));
    if (coverVideo    != null) addSet("cover_video",    normalizeManagedAssetRef(coverVideo, "cover_video"));
    if (body.station_scope != null) addSet("station_scope", JSON.stringify(body.station_scope));
    if (
      benefitActionType != null ||
      linkedMallItemId !== undefined ||
      normalizedConfig.benefitActionType !== (existingCoupon.benefit_action_type || "benefit_detail")
    ) {
      addSet("benefit_action_type", normalizedConfig.benefitActionType);
    }
    if (
      linkedMallItemId !== undefined ||
      normalizedConfig.linkedMallItemId !== (existingCoupon.linked_mall_item_id || null)
    ) {
      addSet("linked_mall_item_id", normalizedConfig.linkedMallItemId);
    }
    addSet("updated_at", new Date().toISOString());

    params.push(id);
    const result = await query(
      `UPDATE coupons SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );

    const updated = await getCouponById(result.rows[0].id);
    if (translatedFields.name) {
      await syncMlSnapshotToOss("coupon", id, translatedFields).catch(() => null);
    }
    return sendOk(res, sendJson, "更新成功", couponRow(updated || result.rows[0]));
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "DB_ERROR",
      err.message
    );
  }
}

// ── 管理端：删除卡券 ─────────────────────────────────────────────────────────
// POST /api/growth/coupon/delete
export async function handleCouponDelete(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const { id } = body;
    if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少券ID");

    await query(
      `DELETE FROM activity_product_bindings apb
        WHERE apb.product_id = $1
          AND apb.binding_type = 'coupon'
          AND NOT EXISTS (
            SELECT 1 FROM activities a WHERE a.activity_id = apb.activity_code
          )`,
      [id]
    );

    const rewardBindingStats = await getCouponRewardBindingStats(id);
    if (rewardBindingStats.totalCount > 0) {
      return sendError(
        res,
        sendJson,
        400,
        "COUPON_BOUND_TO_ACTIVITY",
        "该卡券已被活动奖励绑定，请先在活动管理中解除绑定后再删除"
      );
    }

    const result = await query("DELETE FROM coupons WHERE id = $1 RETURNING id", [id]);
    if (!result.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该券");

    return sendOk(res, sendJson, "删除成功", null);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 用户端：领取卡券 ─────────────────────────────────────────────────────────
// POST /api/user/coupons/claim
// body: { user_id | line_user_id, coupon_id }
export async function handleCouponClaim(req, res, url, sendJson, readBody) {
  try {
    const body     = await readBody(req);
    const userId   = String(body.user_id || body.line_user_id || "").trim();
    const couponId = String(body.coupon_id || "").trim();
    if (!userId)   return sendError(res, sendJson, 400, "MISSING_USER_ID",   "缺少 user_id");
    if (!couponId) return sendError(res, sendJson, 400, "MISSING_COUPON_ID", "缺少 coupon_id");

    const result = await claimCouponForUser({
      userId,
      lineUserId: body.line_user_id || userId,
      couponId,
      source: body,
    });

    if (result.error) {
      return sendError(res, sendJson, result.error.code, result.error.key, result.error.msg);
    }

    return sendOk(res, sendJson, result.already_claimed ? "already_claimed" : "领取成功", result);
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message || "领取失败");
  }
}

export async function claimCouponTx(client, {
  userId,
  lineUserId,
  couponId,
  source = {},
}) {
  const now = new Date().toISOString();

  const couponRes = await client.query(
    "SELECT * FROM coupons WHERE id = $1 FOR UPDATE",
    [couponId]
  );
  if (!couponRes.rows.length) {
    return { error: { code: 404, key: "NOT_FOUND", msg: "未找到该卡券" } };
  }
  const coupon = couponRes.rows[0];
  if (Number(coupon.status) !== 1) {
    return { error: { code: 400, key: "INACTIVE", msg: "该卡券已停用" } };
  }

  const alreadyRes = await client.query(`
    SELECT id FROM user_coupons
    WHERE (user_id = $1 OR line_user_id = $1)
      AND coupon_id = $2
      AND source_type = 'coupon_claim'
    LIMIT 1
  `, [userId, couponId]);

  if (alreadyRes.rows.length) {
    const upRes = await client.query("SELECT * FROM user_coupons WHERE id = $1", [alreadyRes.rows[0].id]);
    return { already_claimed: true, user_product: userCouponRow(upRes.rows[0]) };
  }

  if (Number(coupon.total_count) > 0) {
    const claimedRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM user_coupons WHERE coupon_id = $1 AND source_type = 'coupon_claim'",
      [couponId]
    );
    if (Number(claimedRes.rows[0].cnt) >= Number(coupon.total_count)) {
      return { error: { code: 400, key: "OUT_OF_STOCK", msg: "该卡券已被领完" } };
    }
  }

  const ucId = `up_coupon_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const attribution = buildAttributionSnapshot(source);
  const deliveryType = source.delivery_type || null;
  const deliveryName = source.delivery_name || null;
  const deliveryPhone = source.delivery_phone || null;
  const deliveryAddr = source.delivery_address || null;
  const pickupName = source.pickup_name || null;
  const pickupPhone = source.pickup_phone || null;

  if (coupon.item_type === 'physical') {
    const isPickup = deliveryType === 'pickup';
    const isCourier = deliveryType === 'courier';
    if (isPickup && (!pickupName || !pickupPhone)) {
      return { error: { code: 400, key: "MISSING_PICKUP_INFO", msg: "请填写取货人信息" } };
    }
    if (isCourier && (!deliveryName || !deliveryPhone || !deliveryAddr)) {
      return { error: { code: 400, key: "MISSING_DELIVERY_INFO", msg: "请填写完整配送信息" } };
    }
    if (!deliveryType) {
      return { error: { code: 400, key: "MISSING_DELIVERY_TYPE", msg: "请选择配送方式" } };
    }
  }
  const shippingStatus = coupon.item_type === 'physical' ? 'pending' : null;

  const ucRes = await client.query(`
    INSERT INTO user_coupons
      (id, user_id, line_user_id, coupon_id, product_status, source_type, source_id,
       source_entry_id, source_landing_id, source_banner_id, source_channel_id,
       source_station_code, source_a_system_station_id, source_device_code, source_device_id,
       a_system_user_id,
       delivery_type, delivery_name, delivery_phone, delivery_address,
       pickup_name, pickup_phone, shipping_status,
       claimed_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'claimed', 'coupon_claim', $5, $6, $7, $8, $9,
            $10, $11, $12, $12, $13,
            $14, $15, $16, $17, $18, $19, $20,
            $21, $21, $21)
    RETURNING *
  `, [
    ucId,
    userId,
    lineUserId || userId,
    couponId,
    couponId,
    attribution.source_entry_id,
    attribution.source_landing_id,
    attribution.source_banner_id,
    attribution.source_channel_id,
    attribution.source_station_code,
    attribution.source_a_system_station_id,
    attribution.source_device_code,
    source.a_system_user_id || null,
    deliveryType,
    deliveryName,
    deliveryPhone,
    deliveryAddr,
    pickupName,
    pickupPhone,
    shippingStatus,
    now,
  ]);

  await client.query(
    "UPDATE coupons SET claimed_count = claimed_count + 1, updated_at = NOW() WHERE id = $1",
    [couponId]
  );

  const couponName = typeof coupon.name === "object"
    ? (coupon.name.zh || coupon.name.en || coupon.name.th || couponId)
    : (coupon.name || couponId);

  return {
    already_claimed: false,
    user_product: userCouponRow(ucRes.rows[0]),
    coupon_name: couponName,
    coupon_data: couponRow(coupon),
  };
}

export async function claimCouponForUser({
  userId,
  lineUserId,
  couponId,
  source = {},
}) {
  return withTransaction(async (client) =>
    claimCouponTx(client, { userId, lineUserId, couponId, source })
  );
}

// ── 用户端：使用已拥有卡券兑换关联商品 ───────────────────────────────────────
// POST /api/user/coupons/exchange-mall-item
// body: { user_id | line_user_id, coupon_id, user_product_id?, item_id? }
export async function handleCouponExchangeMallItem(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const userId = String(body.user_id || body.line_user_id || "").trim();
    const couponId = String(body.coupon_id || "").trim();
    const userProductId = String(body.user_product_id || "").trim();
    const requestedItemId = String(body.item_id || "").trim();
    const deliveryType = body.delivery_type || null;
    const deliveryName = body.delivery_name || null;
    const deliveryPhone = body.delivery_phone || null;
    const deliveryAddress = body.delivery_address || null;
    const deliveryStationId = body.delivery_station_id || null;

    if (!userId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "缺少 user_id");
    if (!couponId) return sendError(res, sendJson, 400, "MISSING_COUPON_ID", "缺少 coupon_id");

    const result = await withTransaction(async (client) => {
      const couponRes = await client.query(
        "SELECT * FROM coupons WHERE id = $1 FOR UPDATE",
        [couponId]
      );
      if (!couponRes.rows.length) {
        return { error: { code: 404, key: "COUPON_NOT_FOUND", msg: "未找到该卡券" } };
      }

      const coupon = couponRes.rows[0];
      const linkedItemId = String(coupon.linked_mall_item_id || "").trim();
      if ((coupon.benefit_action_type || "benefit_detail") !== "product_exchange") {
        return { error: { code: 400, key: "COUPON_ACTION_INVALID", msg: "该卡券未配置为商品兑换权益" } };
      }
      if (!linkedItemId) {
        return { error: { code: 400, key: "COUPON_NOT_LINKED_ITEM", msg: "该卡券尚未绑定兑换商品" } };
      }
      if (requestedItemId && requestedItemId !== linkedItemId) {
        return { error: { code: 400, key: "COUPON_ITEM_MISMATCH", msg: "卡券绑定商品与当前商品不一致" } };
      }

      const userCouponParams = [userId, couponId];
      let userCouponWhere = `
        (user_id = $1 OR line_user_id = $1)
        AND coupon_id = $2
        AND product_status = 'claimed'
      `;
      if (userProductId) {
        userCouponWhere += ` AND id = $3`;
        userCouponParams.push(userProductId);
      }

      const userCouponRes = await client.query(
        `SELECT * FROM user_coupons WHERE ${userCouponWhere} ORDER BY claimed_at DESC NULLS LAST LIMIT 1 FOR UPDATE`,
        userCouponParams
      );
      if (!userCouponRes.rows.length) {
        return { error: { code: 400, key: "USER_COUPON_NOT_AVAILABLE", msg: "未找到可用的已拥有卡券" } };
      }
      const userCoupon = userCouponRes.rows[0];
      const attribution = buildAttributionSnapshot(userCoupon);

      const itemRes = await client.query(
        "SELECT * FROM mall_items WHERE id = $1 FOR UPDATE",
        [linkedItemId]
      );
      if (!itemRes.rows.length) {
        return { error: { code: 404, key: "ITEM_NOT_FOUND", msg: "绑定商品不存在" } };
      }
      const item = itemRes.rows[0];
      if (!item.on_shelf) {
        return { error: { code: 400, key: "ITEM_OFF_SHELF", msg: "绑定商品已下架" } };
      }

      if (item.item_type === "physical") {
        const effectiveDeliveryType = deliveryType || item.delivery_type || "courier";
        if (effectiveDeliveryType === "courier" || effectiveDeliveryType === "both") {
          if (!deliveryName || String(deliveryName).trim() === "") {
            return { error: { code: 400, key: "MISSING_DELIVERY_NAME", msg: "请填写收货人姓名" } };
          }
          if (!deliveryPhone || String(deliveryPhone).trim() === "") {
            return { error: { code: 400, key: "MISSING_DELIVERY_PHONE", msg: "请填写收货人手机号" } };
          }
          if (!deliveryAddress || String(deliveryAddress).trim() === "") {
            return { error: { code: 400, key: "MISSING_DELIVERY_ADDRESS", msg: "请填写收货地址" } };
          }
        }
        if (effectiveDeliveryType === "pickup") {
          if (!deliveryName || String(deliveryName).trim() === "") {
            return { error: { code: 400, key: "MISSING_PICKUP_NAME", msg: "请填写领取人姓名" } };
          }
          if (!deliveryPhone || String(deliveryPhone).trim() === "") {
            return { error: { code: 400, key: "MISSING_PICKUP_PHONE", msg: "请填写领取人手机号" } };
          }
        }
      }

      if (Number(item.stock) >= 0) {
        const stockRes = await client.query(
          "SELECT COUNT(*) AS cnt FROM mall_redeems WHERE item_id = $1 AND status != 'cancelled'",
          [linkedItemId]
        );
        if (Number(stockRes.rows[0].cnt) >= Number(item.stock)) {
          return { error: { code: 400, key: "OUT_OF_STOCK", msg: "商品库存不足" } };
        }
      }

      const now = new Date().toISOString();
      const redeemId = `mr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const isPhysical = item.item_type === "physical";
      const effectiveDeliveryType = isPhysical ? (deliveryType || item.delivery_type || "courier") : null;
      const redeemStatus = isPhysical ? "processing" : "success";

      const redeemRes = await client.query(`
        INSERT INTO mall_redeems
          (id, user_id, line_user_id, item_id, item_name, points_spent, price_thb, status,
           source_coupon_id, source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
           source_station_code, source_a_system_station_id, source_device_code,
           delivery_type, delivery_name, delivery_phone, delivery_address,
           delivery_station_id, shipping_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 0, 0, $6,
                $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19,
                $20, $21, $22, $22)
        RETURNING *
      `, [
        redeemId,
        userId,
        userCoupon.line_user_id || userId,
        linkedItemId,
        JSON.stringify(item.name || {}),
        redeemStatus,
        userCoupon.coupon_id || couponId,
        attribution.source_entry_id,
        userCoupon.source_activity_id || "",
        attribution.source_landing_id,
        attribution.source_banner_id,
        userCoupon.source_channel_id || "",
        attribution.source_station_code,
        attribution.source_a_system_station_id,
        attribution.source_device_code,
        effectiveDeliveryType,
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        deliveryStationId,
        isPhysical ? "pending" : null,
        now,
      ]);

      const usedRes = await client.query(`
        UPDATE user_coupons
           SET product_status = 'used', used_at = $2, updated_at = $2
         WHERE id = $1
         RETURNING *
      `, [userCoupon.id, now]);

      return {
        redeem_id: redeemId,
        item_id: linkedItemId,
        is_physical: isPhysical,
        delivery_type: effectiveDeliveryType,
        mall_redeem: redeemRes.rows[0],
        user_coupon: userCouponRow(usedRes.rows[0]),
        redeem_status: redeemStatus,
      };
    });

    if (result.error) {
      return sendError(res, sendJson, result.error.code, result.error.key, result.error.msg);
    }

    return sendOk(res, sendJson, "兑换成功", result);
  } catch (err) {
    return sendError(res, sendJson, 500, "COUPON_EXCHANGE_FAILED", err.message || "券兑换失败");
  }
}

// ── 管理端：核销 — 查询用户券 ────────────────────────────────────────────────
// GET /api/growth/coupon/verify/lookup?uc_id=xxx
export async function handleVerifyLookup(req, res, url, sendJson) {
  try {
    const ucId = (url.searchParams.get("uc_id") || "").trim();
    if (!ucId) return sendError(res, sendJson, 400, "MISSING_ID", "缺少用户券ID");

    const ucRes = await query(
      `SELECT uc.*, c.name AS coupon_name, c.coupon_type, c.discount_type, c.discount_value,
              c.valid_from, c.valid_to
       FROM user_coupons uc
       JOIN coupons c ON c.id = uc.coupon_id
       WHERE uc.id = $1`,
      [ucId]
    );
    if (!ucRes.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该用户券");
    const row = ucRes.rows[0];
    return sendOk(res, sendJson, "ok", userCouponRow(row));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：核销 — 核销用户券 ─────────────────────────────────────────────────
// POST /api/growth/coupon/verify/use  body: { uc_id, operator }
export async function handleVerifyUse(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const ucId    = String(body.uc_id    || "").trim();
    const operator = String(body.operator || "").trim();
    if (!ucId) return sendError(res, sendJson, 400, "MISSING_ID", "缺少用户券ID");

    const now = new Date().toISOString();

    // 先查状态
    const checkRes = await query(
      `SELECT uc.*, c.name AS coupon_name, c.discount_type, c.discount_value,
              c.valid_from, c.valid_to
       FROM user_coupons uc
       JOIN coupons c ON c.id = uc.coupon_id
       WHERE uc.id = $1`,
      [ucId]
    );
    if (!checkRes.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该用户券");
    const uc = checkRes.rows[0];

    if (uc.product_status === 'used') return sendError(res, sendJson, 400, "ALREADY_USED", "该券已核销");
    if (uc.product_status === 'expired') return sendError(res, sendJson, 400, "EXPIRED", "该券已过期");
    if (uc.product_status === 'cancelled') return sendError(res, sendJson, 400, "CANCELLED", "该券已作废");

    // 检查有效期
    if (uc.valid_to && new Date(uc.valid_to) < new Date()) {
      return sendError(res, sendJson, 400, "EXPIRED", "该券已超过有效期");
    }

    const upRes = await query(
      `UPDATE user_coupons
          SET product_status = 'used', used_at = $2, updated_at = $2
        WHERE id = $1
        RETURNING *`,
      [ucId, now]
    );
    return sendOk(res, sendJson, "核销成功", userCouponRow(upRes.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：核销 — 用户券列表 ─────────────────────────────────────────────────
// GET /api/growth/coupon/verify/list?pageNum=1&pageSize=20&status=all&keyword=
export async function handleVerifyList(req, res, url, sendJson) {
  try {
    const pageNum  = Math.max(1, Number(url.searchParams.get("pageNum")  || 1));
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || 20)));
    const offset   = (pageNum - 1) * pageSize;
    const status   = url.searchParams.get("status") || "all";
    const keyword  = (url.searchParams.get("keyword") || "").trim();

    const conditions = [];
    const params     = [];
    let   pi         = 1;

    if (status && status !== "all") {
      conditions.push(`uc.product_status = $${pi++}`);
      params.push(status);
    }
    if (keyword) {
      conditions.push(`(uc.id ILIKE $${pi} OR uc.user_id ILIKE $${pi} OR uc.line_user_id ILIKE $${pi})`);
      params.push(`%${keyword}%`);
      pi++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM user_coupons uc ${where}`,
      params
    );
    const total = Number(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT uc.*, c.name AS coupon_name, c.coupon_type, c.discount_type,
              c.discount_value, c.valid_from, c.valid_to
       FROM user_coupons uc
       JOIN coupons c ON c.id = uc.coupon_id
       ${where}
       ORDER BY uc.created_at DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    );

    return sendOk(res, sendJson, "ok", {
      rows: dataRes.rows.map(userCouponRow),
      total,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：卡券统计（含已使用/已过期数） ───────────────────────────────────
// GET /api/growth/coupon/stats
export async function handleCouponStats(req, res, url, sendJson) {
  try {
    const now = new Date().toISOString();

    // 所有卡券基本信息
    const couponsRes = await query(
      `SELECT id, name, coupon_type, discount_type, discount_value,
              total_count, claimed_count, status, created_at
       FROM coupons ORDER BY created_at DESC`
    );
    const coupons = couponsRes.rows;
    if (!coupons.length) return sendOk(res, sendJson, "ok", []);

    const ids = coupons.map(c => c.id);

    // 从 user_coupons 查各券的使用数和过期数
    const ucRes = await query(
      `SELECT coupon_id,
              COUNT(*) FILTER (WHERE product_status = 'used')                          AS used_count,
              COUNT(*) FILTER (WHERE product_status = 'expired'
                               OR (expired_at IS NOT NULL AND expired_at < $2)) AS expired_count
       FROM user_coupons
       WHERE coupon_id = ANY($1::text[])
       GROUP BY coupon_id`,
      [ids, now]
    );
    const ucMap = {};
    for (const r of ucRes.rows) {
      ucMap[r.coupon_id] = {
        used_count:    Number(r.used_count),
        expired_count: Number(r.expired_count),
      };
    }

    const rows = coupons.map(c => ({
      id:            c.id,
      name:          c.name,
      coupon_type:   c.coupon_type,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value ?? 0),
      total_count:   Number(c.total_count ?? 0),
      claimed_count: Number(c.claimed_count ?? 0),
      used_count:    ucMap[c.id]?.used_count    ?? 0,
      expired_count: ucMap[c.id]?.expired_count ?? 0,
      status:        Number(c.status),
      created_at:    c.created_at ? new Date(c.created_at).toISOString() : null,
    }));

    return sendOk(res, sendJson, "ok", rows);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}
