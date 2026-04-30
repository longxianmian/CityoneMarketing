/**
 * 积分商城路由 — PostgreSQL 版
 * 替代原 JSON 文件存储；保持与前端完全相同的 API 响应结构
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { resolveOssUrl, normalizeManagedAssetRef } from "../services/ossService.js";
import { completeMlFieldMap, normalizeMlValue, syncMlSnapshotToOss } from "../services/multilingual-service.js";
import {
  isDatabaseConnectionError,
  readFallbackList,
  warnReadFallback,
} from "../services/read-fallback-data.js";

// ── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}

function buildAttributionSnapshot(source = {}) {
  return {
    source_entry_id: String(source.source_entry_id || "").trim(),
    source_activity_id: String(source.source_activity_id || "").trim(),
    source_landing_id: String(source.source_landing_id || "").trim(),
    source_banner_id: String(source.source_banner_id || "").trim(),
    source_channel_id: String(source.source_channel_id || "").trim(),
    source_station_code: String(source.source_station_code || "").trim(),
    source_a_system_station_id: String(source.source_a_system_station_id || "").trim(),
    source_device_code: String(source.source_device_code || source.device_code || "").trim(),
  };
}

/** 将 pg mall_items 行规范化为 API 格式 */
function itemRow(row) {
  return {
    ...row,
    cover_image:     resolveOssUrl(row.cover_image),
    cover_video:     resolveOssUrl(row.cover_video),
    price_thb:       row.price_thb       != null ? Number(row.price_thb)       : null,
    points_required: row.points_required != null ? Number(row.points_required) : 0,
    stock:           row.stock           != null ? Number(row.stock)           : -1,
    delivery_type:   row.delivery_type   || "courier",
    sort_order:      Number(row.sort_order ?? 0),
    created_at:      row.created_at  ? new Date(row.created_at).toISOString()  : null,
    updated_at:      row.updated_at  ? new Date(row.updated_at).toISOString()  : null,
  };
}

function buildMallItemFallbackResult(rows, { onlyOnShelf, page, pageSize }) {
  const filtered = rows
    .filter((row) => !onlyOnShelf || row.on_shelf === true)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const offset = (page - 1) * pageSize;
  return {
    list: filtered.slice(offset, offset + pageSize).map(itemRow),
    total: filtered.length,
  };
}

/** 将 mall_redeems 行规范化 */
function redeemRow(row) {
  return {
    ...row,
    points_spent: Number(row.points_spent ?? 0),
    price_thb:    row.price_thb != null ? Number(row.price_thb) : null,
    created_at:   row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at:   row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/** 生成商品 ID */
function generateId() {
  return "mi_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

/** 序列化 JSONB 字段（字符串也需要 JSON.stringify 以确保合法 JSON） */
function toJsonb(v) {
  if (v == null) return null;
  return JSON.stringify(v);
}

async function countLinkedCoupons(itemId, { activeOnly = false } = {}) {
  const result = await query(
    `SELECT COUNT(*) AS cnt
       FROM coupons
      WHERE linked_mall_item_id = $1
        ${activeOnly ? "AND benefit_action_type = 'product_exchange' AND status = 1" : ""}`,
    [itemId]
  );
  return Number(result.rows[0]?.cnt || 0);
}

// ── GET /api/growth/mall/items/:id  — 单件商品 ──────────────────────────────
export async function handleGetMallItemById(req, res, sendJson, itemId) {
  try {
    const result = await query("SELECT * FROM mall_items WHERE id = $1", [itemId]);
    if (!result.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
    return sendOk(res, sendJson, "ok", itemRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "DB_ERROR", err.message);
  }
}

// ── GET /api/growth/mall/items  — 商品列表（管理端 + 用户端） ─────────────────
export async function handleGetMallItems(req, res, sendJson, url, deps = {}) {
  const queryFn = deps.queryFn || query;
  const readFallbackListFn = deps.readFallbackListFn || readFallbackList;
  const warnReadFallbackFn = deps.warnReadFallbackFn || warnReadFallback;
  const isDatabaseConnectionErrorFn = deps.isDatabaseConnectionErrorFn || isDatabaseConnectionError;
  const onlyOnShelf = url.searchParams.get("onShelf") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("pageNum") || "1", 10));
  const pageSize = Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10));
  const offset = (page - 1) * pageSize;
  try {
    const where  = onlyOnShelf ? "WHERE on_shelf = TRUE" : "";
    const params = [pageSize, offset];

    const countRes = await queryFn(`SELECT COUNT(*) AS total FROM mall_items ${where}`);
    const total    = Number(countRes.rows[0].total);

    const dataRes = await queryFn(
      `SELECT * FROM mall_items ${where} ORDER BY sort_order ASC, created_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    return sendOk(res, sendJson, "ok", {
      list:  dataRes.rows.map(itemRow),
      total,
    });
  } catch (err) {
    if (isDatabaseConnectionErrorFn(err)) {
      try {
        const fallback = await readFallbackListFn("mall-items.json");
        const result = buildMallItemFallbackResult(fallback.list, { onlyOnShelf, page, pageSize });
        warnReadFallbackFn("GET /api/growth/mall/items", err, result.list.length, { filePath: fallback.filePath });
        return sendOk(res, sendJson, "ok", result);
      } catch (fallbackError) {
        console.warn(`[ContentFallback] GET /api/growth/mall/items fallback failed: ${fallbackError?.message || fallbackError}`);
      }
    }
    return sendError(res, sendJson, err.statusCode || 500, err.errorCode || "DB_ERROR", err.message);
  }
}

// ── POST /api/growth/mall/items  — 创建商品 ───────────────────────────────────
// body 已由 router 解析（await readBody 在 index.js 完成）
export async function handleCreateMallItem(req, res, sendJson, body) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  try {
    const countRes = await query("SELECT COUNT(*) AS cnt FROM mall_items");
    const sortOrder = Number(body.sort_order ?? Number(countRes.rows[0].cnt));
    const translatedFields = await completeMlFieldMap({
      name: body.name,
      description: body.description,
      detail_title: body.detail_title || body.detailTitle,
      highlights: body.highlights,
      rules: body.rules,
    }, body._sourceLang || body.sourceLang || "zh");
    const itemId = generateId();

    const result = await query(`
      INSERT INTO mall_items
        (id, name, item_type, sub_type, is_flash_sale, exchange_mode, price_thb, points_required, stock,
         on_shelf, cover_image, cover_video, description, detail_title, highlights,
         rules, tag, badge, sort_order, delivery_type, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
      RETURNING *
    `, [
      itemId,
      toJsonb(normalizeMlValue(translatedFields.name)) || "",
      body.item_type     || "digital",
      body.sub_type      || null,
      body.is_flash_sale === true || body.is_flash_sale === "true",
      body.exchange_mode || "points",
      body.price_thb     != null ? Number(body.price_thb)     : null,
      body.points_required != null ? Number(body.points_required) : null,
      body.stock         == null  ? -1 : Number(body.stock),
      body.on_shelf      !== false,
      normalizeManagedAssetRef(body.cover_image, "cover_image") || "",
      normalizeManagedAssetRef(body.cover_video, "cover_video") || "",
      toJsonb(normalizeMlValue(translatedFields.description)),
      toJsonb(normalizeMlValue(translatedFields.detail_title)),
      toJsonb(normalizeMlValue(translatedFields.highlights)),
      toJsonb(normalizeMlValue(translatedFields.rules)),
      body.tag           || null,
      body.badge         || null,
      sortOrder,
      body.delivery_type || "courier",
    ]);

    await syncMlSnapshotToOss("mall_item", itemId, translatedFields).catch(() => null);
    return sendOk(res, sendJson, "created", itemRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── PUT /api/growth/mall/items/:id  — 更新商品 ───────────────────────────────
export async function handleUpdateMallItem(req, res, sendJson, body, itemId) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  try {
    const existing = await query("SELECT id FROM mall_items WHERE id = $1", [itemId]);
    if (!existing.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");

    if (body.on_shelf === false || body.on_shelf === "false") {
      const activeLinkedCoupons = await countLinkedCoupons(itemId, { activeOnly: true });
      if (activeLinkedCoupons > 0) {
        return sendError(
          res,
          sendJson,
          400,
          "ITEM_LINKED_BY_ACTIVE_COUPONS",
          "该商品仍被启用中的商品兑换券绑定，请先停用或解绑相关卡券"
        );
      }
    }

    const sets   = [];
    const params = [];
    let   idx    = 1;
    const translatedFields = await completeMlFieldMap({
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.description != null ? { description: body.description } : {}),
      ...((body.detail_title != null || body.detailTitle != null) ? { detail_title: body.detail_title ?? body.detailTitle } : {}),
      ...(body.highlights != null ? { highlights: body.highlights } : {}),
      ...(body.rules != null ? { rules: body.rules } : {}),
    }, body._sourceLang || body.sourceLang || "zh");

    const addSet = (col, val) => { sets.push(`${col} = $${idx++}`); params.push(val); };

    if (body.name             != null) addSet("name",            toJsonb(normalizeMlValue(translatedFields.name)));
    if (body.item_type        != null) addSet("item_type",       body.item_type);
    if (body.sub_type         !== undefined) addSet("sub_type",  body.sub_type || null);
    if (body.is_flash_sale    != null) addSet("is_flash_sale",   body.is_flash_sale === true || body.is_flash_sale === "true");
    if (body.exchange_mode    != null) addSet("exchange_mode",   body.exchange_mode);
    if (body.price_thb        != null) addSet("price_thb",       Number(body.price_thb));
    if (body.points_required  != null) addSet("points_required", Number(body.points_required));
    if (body.stock             != null) addSet("stock",            Number(body.stock));
    if (body.on_shelf          != null) addSet("on_shelf",         Boolean(body.on_shelf));
    if (body.cover_image       != null) addSet("cover_image",      normalizeManagedAssetRef(body.cover_image, "cover_image"));
    if (body.cover_video       != null) addSet("cover_video",      normalizeManagedAssetRef(body.cover_video, "cover_video"));
    if (body.description       != null) addSet("description",      toJsonb(normalizeMlValue(translatedFields.description)));
    if (body.detail_title      != null) addSet("detail_title",     toJsonb(normalizeMlValue(translatedFields.detail_title)));
    if (body.detailTitle       != null) addSet("detail_title",     toJsonb(normalizeMlValue(translatedFields.detail_title)));
    if (body.highlights        != null) addSet("highlights",       toJsonb(normalizeMlValue(translatedFields.highlights)));
    if (body.rules             != null) addSet("rules",            toJsonb(normalizeMlValue(translatedFields.rules)));
    if (body.tag               != null) addSet("tag",              body.tag);
    if (body.badge             != null) addSet("badge",            body.badge);
    if (body.sort_order        != null) addSet("sort_order",       Number(body.sort_order));
    if (body.delivery_type     != null) addSet("delivery_type",    body.delivery_type);
    addSet("updated_at", new Date().toISOString());

    params.push(itemId);
    const result = await query(
      `UPDATE mall_items SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (Object.keys(translatedFields).length) {
      await syncMlSnapshotToOss("mall_item", itemId, translatedFields).catch(() => null);
    }
    return sendOk(res, sendJson, "updated", itemRow(result.rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── DELETE /api/growth/mall/items/:id ────────────────────────────────────────
export async function handleDeleteMallItem(req, res, sendJson, itemId) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  try {
    const linkedCoupons = await countLinkedCoupons(itemId);
    if (linkedCoupons > 0) {
      return sendError(
        res,
        sendJson,
        400,
        "ITEM_LINKED_BY_COUPONS",
        "该商品已被卡券绑定，请先在卡券管理中解除绑定后再删除"
      );
    }

    const result = await query("DELETE FROM mall_items WHERE id = $1 RETURNING id", [itemId]);
    if (!result.rows.length) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
    return sendOk(res, sendJson, "deleted", null);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── GET /api/growth/mall/orders  — 兑换订单列表（管理端） ───────────────────
export async function handleGetMallOrders(req, res, sendJson, url) {
  try {
    const page     = Math.max(1, parseInt(url.searchParams.get("pageNum")  || "1",  10));
    const pageSize = Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10));
    const offset   = (page - 1) * pageSize;

    const countRes = await query("SELECT COUNT(*) AS total FROM mall_redeems");
    const total    = Number(countRes.rows[0].total);

    const dataRes = await query(
      "SELECT * FROM mall_redeems ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    );

    return sendOk(res, sendJson, "ok", {
      list:  dataRes.rows.map(redeemRow),
      total,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ── POST /api/growth/mall/redeem  — 积分兑换（原子事务） ─────────────────────
export async function redeemMallItemTx(client, {
  userId,
  lineUserId,
  itemId,
  source = {},
  deliveryType = null,
  deliveryName = null,
  deliveryPhone = null,
  deliveryAddress = null,
  deliveryStationId = null,
}) {
      const attribution = buildAttributionSnapshot(source);
      // 1. 获取商品（行锁）
      const itemRes = await client.query(
        "SELECT * FROM mall_items WHERE id = $1 FOR UPDATE",
        [itemId]
      );
      if (!itemRes.rows.length) return { error: { code: 404, key: "ITEM_NOT_FOUND", msg: "商品不存在" } };
      const item = itemRes.rows[0];
      if (!item.on_shelf) return { error: { code: 400, key: "ITEM_OFF_SHELF", msg: "商品已下架" } };

      // 实物商品：验证配送信息
      if (item.item_type === "physical") {
        const dt = deliveryType || item.delivery_type || "courier";
        if (dt === "courier" || dt === "both") {
          if (!deliveryName  || String(deliveryName).trim()  === "") return { error: { code: 400, key: "MISSING_DELIVERY_NAME",    msg: "请填写收货人姓名" } };
          if (!deliveryPhone || String(deliveryPhone).trim() === "") return { error: { code: 400, key: "MISSING_DELIVERY_PHONE",   msg: "请填写收货人手机号" } };
          if (!deliveryAddress || String(deliveryAddress).trim() === "") return { error: { code: 400, key: "MISSING_DELIVERY_ADDRESS", msg: "请填写收货地址" } };
        }
        if ((dt === "pickup" || dt === "both") && !deliveryName) {
          // pickup 模式最少需要姓名
        }
      }

      const pointsRequired = Number(item.points_required) || 0;
      if (pointsRequired <= 0) return { error: { code: 400, key: "NO_POINTS_PRICE", msg: "该商品无积分兑换价格" } };
      const deductedPoints = -pointsRequired;

      // 2. 检查库存
      if (Number(item.stock) >= 0) {
        const usedRes = await client.query(
          "SELECT COUNT(*) AS cnt FROM mall_redeems WHERE item_id = $1 AND status != 'cancelled'",
          [itemId]
        );
        if (Number(usedRes.rows[0].cnt) >= Number(item.stock)) {
          return { error: { code: 400, key: "OUT_OF_STOCK", msg: "商品库存不足" } };
        }
      }

      // 3. 获取用户积分（行锁）
      const accRes = await client.query(
        "SELECT * FROM points_accounts WHERE user_id = $1 OR line_user_id = $1 LIMIT 1 FOR UPDATE",
        [userId]
      );
      const available = accRes.rows.length ? Number(accRes.rows[0].available_points) : 0;
      if (available < pointsRequired) {
        return {
          error: {
            code: 400, key: "INSUFFICIENT_POINTS",
            msg: `积分不足，当前可用 ${available} 积分，兑换需 ${pointsRequired} 积分`,
          },
        };
      }

      const now = new Date().toISOString();
      const ledgerId = `ledger_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const itemNameDisplay = typeof item.name === "object"
        ? (item.name.zh || item.name.en || item.name.th || itemId)
        : (item.name || itemId);

      // 4. 写积分流水（debit）
      await client.query(`
        INSERT INTO points_ledger
          (id, user_id, line_user_id, type, points, ref_type, ref_id, reason,
           source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
           source_station_code, source_a_system_station_id, source_device_code,
           created_at)
        VALUES ($1,$2,$3,'debit',$4,'exchange',$5,$6,
                $7,$8,$9,$10,$11,
                $12,$13,$14,
                $15)
      `, [
        ledgerId, userId, userId, pointsRequired, itemId, `积分兑换：${itemNameDisplay}`,
        attribution.source_entry_id,
        attribution.source_activity_id,
        attribution.source_landing_id,
        attribution.source_banner_id,
        attribution.source_channel_id,
        attribution.source_station_code,
        attribution.source_a_system_station_id,
        attribution.source_device_code,
        now,
      ]);

      // 5. UPSERT 积分账户
      await client.query(`
        INSERT INTO points_accounts (user_id, line_user_id, available_points, consumed_points, updated_at)
        VALUES ($1, $2, $4, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          available_points = points_accounts.available_points - $3,
          consumed_points  = points_accounts.consumed_points  + $3,
          updated_at       = NOW()
      `, [userId, userId, pointsRequired, deductedPoints]);

      // 6. 写兑换记录（数字商品: status=success; 实物: status=processing/待配送）
      const redeemId = `mr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const isPhysical = item.item_type === "physical";
      const redeemStatus = isPhysical ? "processing" : "success";
      const effectiveDeliveryType = deliveryType || item.delivery_type || "courier";
      await client.query(`
        INSERT INTO mall_redeems
          (id, user_id, line_user_id, item_id, item_name, points_spent, status, ledger_id,
           source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
           source_station_code, source_a_system_station_id, source_device_code,
           delivery_type, delivery_name, delivery_phone, delivery_address, delivery_station_id,
           shipping_status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                $9,$10,$11,$12,$13,
                $14,$15,$16,
                $17,$18,$19,$20,$21,
                $22,$23,$23)
      `, [
        redeemId, userId, userId, itemId, toJsonb(item.name), pointsRequired,
        redeemStatus, ledgerId,
        attribution.source_entry_id,
        attribution.source_activity_id,
        attribution.source_landing_id,
        attribution.source_banner_id,
        attribution.source_channel_id,
        attribution.source_station_code,
        attribution.source_a_system_station_id,
        attribution.source_device_code,
        isPhysical ? effectiveDeliveryType : null,
        deliveryName, deliveryPhone, deliveryAddress, deliveryStationId,
        isPhysical ? "pending" : null, now,
      ]);

      // 7. 读取最新余额
      const newAccRes = await client.query(
        "SELECT available_points FROM points_accounts WHERE user_id = $1",
        [userId]
      );
      const remainingPoints = newAccRes.rows.length ? Number(newAccRes.rows[0].available_points) : 0;

      return {
        redeemId, itemId, pointsRequired, remainingPoints,
        isPhysical,
        deliveryType: isPhysical ? effectiveDeliveryType : null,
      };
}

export async function handleMallRedeem(req, res, sendJson, readBody) {
  try {
    const body   = await readBody(req);
    const userId = String(body.user_id || body.line_user_id || "").trim();
    const itemId = String(body.item_id || "").trim();

    if (!userId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
    if (!itemId) return sendError(res, sendJson, 400, "MISSING_ITEM_ID", "item_id 必填");

    const result = await withTransaction(async (client) => {
      return redeemMallItemTx(client, {
        userId,
        lineUserId: userId,
        itemId,
        source: body,
        deliveryType: body.delivery_type || null,
        deliveryName: body.delivery_name || null,
        deliveryPhone: body.delivery_phone || null,
        deliveryAddress: body.delivery_address || null,
        deliveryStationId: body.delivery_station_id || null,
      });
    });

    if (result.error) {
      return sendError(res, sendJson, result.error.code, result.error.key, result.error.msg);
    }

    return sendOk(res, sendJson, "兑换成功", {
      redeem_id:        result.redeemId,
      item_id:          result.itemId,
      points_spent:     result.pointsRequired,
      remaining_points: result.remainingPoints,
      is_physical:      result.isPhysical,
      delivery_type:    result.deliveryType,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "REDEEM_FAILED", err.message || "兑换失败");
  }
}

// ── GET /api/growth/mall/redeems  — 用户兑换记录 ─────────────────────────────
export async function handleGetMallRedeems(req, res, sendJson, url) {
  try {
    const userId   = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
    const page     = Math.max(1, parseInt(url.searchParams.get("pageNum")  || "1",  10));
    const pageSize = Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10));
    const offset   = (page - 1) * pageSize;

    // 为 count 和 data 分别构建参数，避免参数索引混乱
    const userFilter = userId ? "WHERE (user_id = $1 OR line_user_id = $1)" : "";

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM mall_redeems ${userFilter}`,
      userId ? [userId] : []
    );
    const total = Number(countRes.rows[0].total);

    const dataWhere  = userId ? "WHERE (user_id = $3 OR line_user_id = $3)" : "";
    const dataParams = userId ? [pageSize, offset, userId] : [pageSize, offset];

    const dataRes = await query(
      `SELECT * FROM mall_redeems ${dataWhere} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      dataParams
    );

    return sendOk(res, sendJson, "ok", {
      list:  dataRes.rows.map(redeemRow),
      total,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}
