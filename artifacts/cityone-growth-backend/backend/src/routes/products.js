import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const PRODUCT_TEMPLATES_FILE = path.join(DATA_DIR, "product-templates.json");
const DIGITAL_PRODUCTS_FILE = path.join(DATA_DIR, "digital-products.json");
const USER_PRODUCTS_FILE = path.join(DATA_DIR, "user-products.json");

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadJsonArray(filePath) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveJsonArray(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
function nextId(list, prefix, field) {
  const max = list.reduce((m, item) => {
    const matched = String(item[field] || "").match(new RegExp(`^${prefix}_(\\d+)$`));
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
}
function idFromPath(pathname, pattern) {
  return pathname.match(pattern)?.[1] || "";
}

// ─── 商品模板 ────────────────────────────────────────────────────────────────

const VALID_PRODUCT_TYPES = [
  "coupon", "free_time_voucher", "benefit_package", "gift_pack",
  "points_exchange_item", "cash_purchase_item"
];

export function handleProductTemplateGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/product-templates\/([^/]+)$/);
  const list = loadJsonArray(PRODUCT_TEMPLATES_FILE);
  const item = list.find((t) => t.template_id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到商品模板");
  return sendOk(res, sendJson, "product template loaded", item);
}

export async function handleProductTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const productType = String(body.product_type || "").trim();
    if (!templateName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "template_name 必填");
    if (!VALID_PRODUCT_TYPES.includes(productType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `product_type 必须是: ${VALID_PRODUCT_TYPES.join(" | ")}`);

    const list = loadJsonArray(PRODUCT_TEMPLATES_FILE);
    const now = new Date().toISOString();
    const item = {
      template_id: nextId(list, "pt", "template_id"),
      template_name: templateName,
      product_type: productType,
      header_json: body.header_json || null,
      media_assets_json: body.media_assets_json || null,
      pricing_block_json: body.pricing_block_json || null,
      content_block_json: body.content_block_json || null,
      usage_block_json: body.usage_block_json || null,
      notice_block_json: body.notice_block_json || null,
      cta_block_json: body.cta_block_json || null,
      status: "enabled",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(PRODUCT_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "product template created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleProductTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/product-templates\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "template_id 必填");
    const body = await readBody(req);
    const list = loadJsonArray(PRODUCT_TEMPLATES_FILE);
    const idx = list.findIndex((t) => t.template_id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到商品模板");

    const updatableFields = [
      "template_name","product_type","header_json","media_assets_json","pricing_block_json",
      "content_block_json","usage_block_json","notice_block_json","cta_block_json","status",
    ];
    const updated = { ...list[idx] };
    for (const f of updatableFields) {
      if (body[f] !== undefined) updated[f] = body[f];
    }
    updated.updated_at = new Date().toISOString();
    list[idx] = updated;
    saveJsonArray(PRODUCT_TEMPLATES_FILE, list);
    return sendOk(res, sendJson, "product template updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

// ─── 数字商品 ────────────────────────────────────────────────────────────────

const VALID_SOURCE_MODES = ["activity_reward", "points_exchange", "cash_purchase", "mixed"];

export function handleDigitalProductGet(req, res, url, sendJson) {
  const id = idFromPath(url.pathname, /^\/api\/digital-products\/([^/]+)$/);
  const list = loadJsonArray(DIGITAL_PRODUCTS_FILE);
  const item = list.find((p) => p.product_id === id);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到数字商品");
  return sendOk(res, sendJson, "digital product loaded", item);
}

export async function handleDigitalProductCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const productName = String(body.product_name || "").trim();
    const productType = String(body.product_type || "").trim();
    const sourceMode = String(body.source_mode || "activity_reward").trim();

    if (!productName) return sendError(res, sendJson, 400, "NAME_REQUIRED", "product_name 必填");
    if (!VALID_PRODUCT_TYPES.includes(productType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `product_type 必须是: ${VALID_PRODUCT_TYPES.join(" | ")}`);
    if (!VALID_SOURCE_MODES.includes(sourceMode))
      return sendError(res, sendJson, 400, "SOURCE_MODE_INVALID", `source_mode 必须是: ${VALID_SOURCE_MODES.join(" | ")}`);

    const list = loadJsonArray(DIGITAL_PRODUCTS_FILE);
    const now = new Date().toISOString();
    const item = {
      product_id: nextId(list, "dp", "product_id"),
      product_type: productType,
      product_name: productName,
      product_subtitle: body.product_subtitle || "",
      short_benefit_text: body.short_benefit_text || "",
      template_id: body.template_id || "",
      cover_image: body.cover_image || "",
      cover_video: body.cover_video || "",
      source_mode: sourceMode,
      cash_enabled: !!body.cash_enabled,
      cash_price: Number(body.cash_price || 0),
      cash_currency: body.cash_currency || "THB",
      points_enabled: !!body.points_enabled,
      points_price: Number(body.points_price || 0),
      stock_enabled: !!body.stock_enabled,
      stock_qty: Number(body.stock_qty || 0),
      user_limit: Number(body.user_limit || 1),
      valid_type: body.valid_type || "days",
      valid_days: Number(body.valid_days || 30),
      valid_start_at: body.valid_start_at || "",
      valid_end_at: body.valid_end_at || "",
      refundable: !!body.refundable,
      transferable: !!body.transferable,
      stackable: !!body.stackable,
      rule_text: body.rule_text || "",
      status: "enabled",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(DIGITAL_PRODUCTS_FILE, list);
    return sendOk(res, sendJson, "digital product created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handleDigitalProductUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = idFromPath(url.pathname, /^\/api\/digital-products\/([^/]+)$/);
    if (!id) return sendError(res, sendJson, 400, "ID_REQUIRED", "product_id 必填");
    const body = await readBody(req);
    const list = loadJsonArray(DIGITAL_PRODUCTS_FILE);
    const idx = list.findIndex((p) => p.product_id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到数字商品");

    const updatableFields = [
      "product_name","product_subtitle","short_benefit_text","template_id","cover_image","cover_video",
      "source_mode","cash_enabled","cash_price","cash_currency","points_enabled","points_price",
      "stock_enabled","stock_qty","user_limit","valid_type","valid_days","valid_start_at","valid_end_at",
      "refundable","transferable","stackable","rule_text","status",
    ];
    const updated = { ...list[idx] };
    for (const f of updatableFields) {
      if (body[f] !== undefined) updated[f] = body[f];
    }
    updated.updated_at = new Date().toISOString();
    list[idx] = updated;
    saveJsonArray(DIGITAL_PRODUCTS_FILE, list);
    return sendOk(res, sendJson, "digital product updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

// ─── 商品到账（内部通用函数）────────────────────────────────────────────────

export function issueUserProduct({ lineUserId, userId, productId, sourceType, sourceId }) {
  const products = loadJsonArray(DIGITAL_PRODUCTS_FILE);
  const product = products.find((p) => p.product_id === productId && p.status === "enabled");
  if (!product) return { ok: false, error: "PRODUCT_NOT_FOUND", msg: "商品不存在或已下架" };

  if (product.stock_enabled && product.stock_qty <= 0)
    return { ok: false, error: "OUT_OF_STOCK", msg: "商品库存不足" };

  const userProducts = loadJsonArray(USER_PRODUCTS_FILE);

  // 校验用户限额
  if (product.user_limit > 0) {
    const userOwned = userProducts.filter(
      (up) => up.product_id === productId &&
        (up.line_user_id === lineUserId || up.user_id === userId) &&
        !["cancelled", "refunded"].includes(up.product_status)
    );
    if (userOwned.length >= product.user_limit)
      return { ok: false, error: "USER_LIMIT_EXCEEDED", msg: "已超出个人领取上限" };
  }

  // 扣库存
  if (product.stock_enabled) {
    const pIdx = products.findIndex((p) => p.product_id === productId);
    products[pIdx] = { ...products[pIdx], stock_qty: products[pIdx].stock_qty - 1 };
    saveJsonArray(DIGITAL_PRODUCTS_FILE, products);
  }

  // 计算有效期
  const now = new Date();
  let expiredAt = "";
  if (product.valid_type === "days" && product.valid_days > 0) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + product.valid_days);
    expiredAt = exp.toISOString();
  } else if (product.valid_end_at) {
    expiredAt = product.valid_end_at;
  }

  const userProduct = {
    user_product_id: nextId(userProducts, "up", "user_product_id"),
    line_user_id: lineUserId || "",
    user_id: userId || "",
    product_id: productId,
    source_type: sourceType,
    source_id: sourceId || "",
    product_status: "claimed",
    claimed_at: now.toISOString(),
    used_at: "",
    expired_at: expiredAt,
    order_id: "",
    station_id: "",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  userProducts.push(userProduct);
  saveJsonArray(USER_PRODUCTS_FILE, userProducts);
  return { ok: true, userProduct };
}

// ─── 商品领取（活动奖励）─────────────────────────────────────────────────────

export async function handleProductClaim(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const lineUserId = String(body.line_user_id || "").trim();
    const productId = String(body.product_id || "").trim();
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");
    if (!productId) return sendError(res, sendJson, 400, "PRODUCT_ID_REQUIRED", "product_id 必填");

    const result = issueUserProduct({
      lineUserId,
      userId: body.user_id || "",
      productId,
      sourceType: "activity",
      sourceId: body.source_id || "",
    });

    if (!result.ok) return sendError(res, sendJson, 400, result.error, result.msg);
    return sendOk(res, sendJson, "商品领取成功", result.userProduct);
  } catch (err) {
    return sendError(res, sendJson, 500, "CLAIM_FAILED", err.message || "领取失败");
  }
}

// ─── 积分兑换 ────────────────────────────────────────────────────────────────

export async function handleProductExchange(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const lineUserId = String(body.line_user_id || "").trim();
    const productId = String(body.product_id || "").trim();
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");
    if (!productId) return sendError(res, sendJson, 400, "PRODUCT_ID_REQUIRED", "product_id 必填");

    const products = loadJsonArray(DIGITAL_PRODUCTS_FILE);
    const product = products.find((p) => p.product_id === productId);
    if (!product) return sendError(res, sendJson, 404, "PRODUCT_NOT_FOUND", "商品不存在");
    if (!product.points_enabled) return sendError(res, sendJson, 400, "EXCHANGE_NOT_AVAILABLE", "该商品不支持积分兑换");

    const result = issueUserProduct({
      lineUserId,
      userId: body.user_id || "",
      productId,
      sourceType: "exchange",
      sourceId: body.source_id || "",
    });
    if (!result.ok) return sendError(res, sendJson, 400, result.error, result.msg);
    return sendOk(res, sendJson, "积分兑换成功", {
      ...result.userProduct,
      points_spent: product.points_price,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "EXCHANGE_FAILED", err.message || "兑换失败");
  }
}

// ─── 现金购买 ────────────────────────────────────────────────────────────────

export async function handleProductPurchase(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const lineUserId = String(body.line_user_id || "").trim();
    const productId = String(body.product_id || "").trim();
    const orderId = String(body.order_id || "").trim();
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");
    if (!productId) return sendError(res, sendJson, 400, "PRODUCT_ID_REQUIRED", "product_id 必填");
    if (!orderId) return sendError(res, sendJson, 400, "ORDER_ID_REQUIRED", "order_id 必填");

    const products = loadJsonArray(DIGITAL_PRODUCTS_FILE);
    const product = products.find((p) => p.product_id === productId);
    if (!product) return sendError(res, sendJson, 404, "PRODUCT_NOT_FOUND", "商品不存在");
    if (!product.cash_enabled) return sendError(res, sendJson, 400, "PURCHASE_NOT_AVAILABLE", "该商品不支持现金购买");

    const result = issueUserProduct({
      lineUserId,
      userId: body.user_id || "",
      productId,
      sourceType: "purchase",
      sourceId: orderId,
    });
    if (!result.ok) return sendError(res, sendJson, 400, result.error, result.msg);

    // 写入 order_id
    const userProducts = loadJsonArray(USER_PRODUCTS_FILE);
    const upIdx = userProducts.findIndex((up) => up.user_product_id === result.userProduct.user_product_id);
    if (upIdx >= 0) {
      userProducts[upIdx].order_id = orderId;
      saveJsonArray(USER_PRODUCTS_FILE, userProducts);
    }

    return sendOk(res, sendJson, "商品购买成功", { ...result.userProduct, order_id: orderId });
  } catch (err) {
    return sendError(res, sendJson, 500, "PURCHASE_FAILED", err.message || "购买失败");
  }
}

// ─── 商品使用 & 回写 ─────────────────────────────────────────────────────────

export async function handleProductUse(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const userProductId = String(body.user_product_id || "").trim();
    const stationId = String(body.station_id || "").trim();
    if (!userProductId) return sendError(res, sendJson, 400, "USER_PRODUCT_ID_REQUIRED", "user_product_id 必填");

    const list = loadJsonArray(USER_PRODUCTS_FILE);
    const idx = list.findIndex((up) => up.user_product_id === userProductId);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到用户商品记录");

    const userProduct = list[idx];
    if (userProduct.product_status === "used")
      return sendError(res, sendJson, 400, "ALREADY_USED", "该商品已使用");
    if (userProduct.product_status === "expired")
      return sendError(res, sendJson, 400, "EXPIRED", "该商品已过期");
    if (["cancelled", "refunded"].includes(userProduct.product_status))
      return sendError(res, sendJson, 400, "INVALID_STATUS", "该商品状态不可使用");

    const now = new Date().toISOString();
    list[idx] = {
      ...userProduct,
      product_status: "used",
      used_at: now,
      station_id: stationId || userProduct.station_id,
      bridge_status: body.bridge_status || "completed",
      updated_at: now,
    };
    saveJsonArray(USER_PRODUCTS_FILE, list);

    return sendOk(res, sendJson, "商品使用成功", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "USE_FAILED", err.message || "使用失败");
  }
}
