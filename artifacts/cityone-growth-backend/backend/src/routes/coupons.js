/**
 * 卡券路由 — PostgreSQL 版
 * 替代原 JSON 文件存储；保持与前端完全相同的 API 响应结构
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { resolveOssUrl, revertOssUrl } from "../services/ossService.js";

// ── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, code, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: code });
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
      SELECT * FROM coupons
      WHERE status = 1
        AND (valid_to IS NULL OR valid_to > $1)
      ORDER BY created_at DESC
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
    let params = [];
    let paramIdx = 1;

    if (name) {
      whereClauses.push(`(
        name::text ILIKE $${paramIdx}
        OR name->>'zh' ILIKE $${paramIdx}
        OR name->>'th' ILIKE $${paramIdx}
        OR name->>'en' ILIKE $${paramIdx}
      )`);
      params.push(`%${name}%`);
      paramIdx++;
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) AS total FROM coupons ${where}`, params);
    const total = Number(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT * FROM coupons ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
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

// ── 管理端：新增卡券 ─────────────────────────────────────────────────────────
// POST /api/growth/coupon/add
export async function handleCouponAdd(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const { name, couponType, itemType, discountType, discountValue, minAmount, totalCount,
            status, validFrom, validTo, coverImage, coverVideo } = body;

    if (!name)         return sendError(res, sendJson, 400, "MISSING_NAME",  "券名称不能为空");
    if (!discountType) return sendError(res, sendJson, 400, "MISSING_DTYPE", "优惠方式不能为空");

    const id = await nextCouponId();
    const nameVal = JSON.stringify(name); // 确保 JSONB 合法（字符串自动加引号）

    const stationScope = body.station_scope ? JSON.stringify(body.station_scope) : "{}";

    const result = await query(`
      INSERT INTO coupons
        (id, name, coupon_type, item_type, discount_type, discount_value, min_amount, total_count,
         claimed_count, status, valid_from, valid_to, cover_image, cover_video, station_scope, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `, [
      id,
      nameVal,
      couponType    || "general",
      itemType      || "digital",
      discountType,
      discountValue != null ? Number(discountValue) : 0,
      minAmount     != null ? Number(minAmount)     : 0,
      totalCount    != null ? Number(totalCount)    : 0,
      status        != null ? Number(status)        : 1,
      validFrom     || null,
      validTo       || null,
      revertOssUrl(coverImage) || "",
      revertOssUrl(coverVideo) || "",
      stationScope,
    ]);

    return sendOk(res, sendJson, "创建成功", couponRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── 管理端：更新卡券 ─────────────────────────────────────────────────────────
// POST /api/growth/coupon/update
export async function handleCouponUpdate(req, res, url, sendJson, readBody) {
  try {
    let body;
    try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

    const { id, name, couponType, itemType, discountType, discountValue, minAmount, totalCount,
            status, validFrom, validTo, coverImage, coverVideo } = body;

    if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少券ID");

    // 检查存在
    const existing = await query("SELECT id FROM coupons WHERE id = $1", [id]);
    if (!existing.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该券");

    const sets = [];
    const params = [];
    let idx = 1;

    const addSet = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

    if (name          != null) addSet("name",           JSON.stringify(name));
    if (couponType    != null) addSet("coupon_type",    couponType);
    if (itemType      != null) addSet("item_type",      itemType);
    if (discountType  != null) addSet("discount_type",  discountType);
    if (discountValue != null) addSet("discount_value", Number(discountValue));
    if (minAmount     != null) addSet("min_amount",     Number(minAmount));
    if (totalCount    != null) addSet("total_count",    Number(totalCount));
    if (status        != null) addSet("status",         Number(status));
    if (validFrom     != null) addSet("valid_from",     validFrom || null);
    if (validTo       != null) addSet("valid_to",       validTo   || null);
    if (coverImage    != null) addSet("cover_image",    revertOssUrl(coverImage));
    if (coverVideo    != null) addSet("cover_video",    revertOssUrl(coverVideo));
    if (body.station_scope != null) addSet("station_scope", JSON.stringify(body.station_scope));
    addSet("updated_at", new Date().toISOString());

    params.push(id);
    const result = await query(
      `UPDATE coupons SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );

    return sendOk(res, sendJson, "更新成功", couponRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
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

    const now = new Date().toISOString();

    const result = await withTransaction(async (client) => {
      // 1. 获取卡券（行锁）
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

      // 2. 防重复领取
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

      // 3. 检查库存
      if (Number(coupon.total_count) > 0) {
        const claimedRes = await client.query(
          "SELECT COUNT(*) AS cnt FROM user_coupons WHERE coupon_id = $1 AND source_type = 'coupon_claim'",
          [couponId]
        );
        if (Number(claimedRes.rows[0].cnt) >= Number(coupon.total_count)) {
          return { error: { code: 400, key: "OUT_OF_STOCK", msg: "该卡券已被领完" } };
        }
      }

      // 4. 写领取记录（含落地页/渠道归因 + 实物配送信息）
      const ucId = `up_coupon_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const srcLandingId  = body.source_landing_id  || "";
      const srcChannelId  = body.source_channel_id  || "";
      const deliveryType  = body.delivery_type   || null;
      const deliveryName  = body.delivery_name   || null;
      const deliveryPhone = body.delivery_phone  || null;
      const deliveryAddr  = body.delivery_address|| null;
      const pickupName    = body.pickup_name     || null;
      const pickupPhone   = body.pickup_phone    || null;
      // 实物卡券领取时，若无配送信息则拦截
      if (coupon.item_type === 'physical') {
        const isPickup  = deliveryType === 'pickup';
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
           source_landing_id, source_channel_id,
           a_system_user_id,
           delivery_type, delivery_name, delivery_phone, delivery_address,
           pickup_name, pickup_phone, shipping_status,
           claimed_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'claimed', 'coupon_claim', $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15,
                $16, $16, $16)
        RETURNING *
      `, [
        ucId,
        userId,
        body.line_user_id || userId,
        couponId,
        couponId,
        srcLandingId,
        srcChannelId,
        body.a_system_user_id || null,
        deliveryType,
        deliveryName,
        deliveryPhone,
        deliveryAddr,
        pickupName,
        pickupPhone,
        shippingStatus,
        now,
      ]);

      // 5. 更新已领取计数
      await client.query(
        "UPDATE coupons SET claimed_count = claimed_count + 1, updated_at = NOW() WHERE id = $1",
        [couponId]
      );

      const couponName = typeof coupon.name === "object"
        ? (coupon.name.zh || coupon.name.en || coupon.name.th || couponId)
        : (coupon.name || couponId);

      return {
        already_claimed: false,
        user_product:    userCouponRow(ucRes.rows[0]),
        coupon_name:     couponName,
        coupon_data:     couponRow(coupon),
      };
    });

    if (result.error) {
      return sendError(res, sendJson, result.error.code, result.error.key, result.error.msg);
    }

    return sendOk(res, sendJson, result.already_claimed ? "already_claimed" : "领取成功", result);
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message || "领取失败");
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
