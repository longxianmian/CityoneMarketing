import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MALL_ITEMS_FILE   = path.join(DATA_DIR, "mall-items.json");
const ACCOUNTS_FILE     = path.join(DATA_DIR, "points-accounts.json");
const LEDGER_FILE       = path.join(DATA_DIR, "points-ledger.json");
const MALL_REDEEMS_FILE = path.join(DATA_DIR, "mall-redeems.json");

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
function generateId() {
  return "mi_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// GET /growth/mall/items/:id  — single item
export function handleGetMallItemById(req, res, sendJson, itemId) {
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const item = list.find(i => i.id === itemId);
  if (!item) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
  return sendOk(res, sendJson, "ok", item);
}

// GET /growth/mall/items  — list (admin + user)
export function handleGetMallItems(req, res, sendJson, url) {
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const onlyOnShelf = url.searchParams.get("onShelf") === "true";
  const result = onlyOnShelf ? list.filter(i => i.on_shelf === true) : list;
  const page = parseInt(url.searchParams.get("pageNum") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const start = (page - 1) * pageSize;
  const paged = result.slice(start, start + pageSize);
  return sendOk(res, sendJson, "ok", { list: paged, total: result.length });
}

// POST /growth/mall/items  — create
export function handleCreateMallItem(req, res, sendJson, body) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const item = {
    // 先铺一遍 body，保留 tag/badge/highlights/rules 等前端扩展字段
    ...body,
    // 再用明确字段覆盖，确保类型正确
    id: generateId(),
    name: body.name || "",
    item_type: body.item_type || "digital",
    exchange_mode: body.exchange_mode || "points",
    price_thb: body.price_thb != null ? Number(body.price_thb) : null,
    points_required: body.points_required != null ? Number(body.points_required) : null,
    stock: body.stock == null ? -1 : Number(body.stock),
    on_shelf: body.on_shelf !== false,
    cover_image: body.cover_image || "",
    description: body.description || "",
    sort_order: body.sort_order != null ? Number(body.sort_order) : list.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  list.push(item);
  saveJsonArray(MALL_ITEMS_FILE, list);
  return sendOk(res, sendJson, "created", item);
}

// PUT /growth/mall/items/:id  — update
export function handleUpdateMallItem(req, res, sendJson, body, itemId) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const idx = list.findIndex(i => i.id === itemId);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
  list[idx] = { ...list[idx], ...body, id: list[idx].id, updated_at: new Date().toISOString() };
  saveJsonArray(MALL_ITEMS_FILE, list);
  return sendOk(res, sendJson, "updated", list[idx]);
}

// DELETE /growth/mall/items/:id
export function handleDeleteMallItem(req, res, sendJson, itemId) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const next = list.filter(i => i.id !== itemId);
  if (next.length === list.length) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
  saveJsonArray(MALL_ITEMS_FILE, next);
  return sendOk(res, sendJson, "deleted", null);
}

// GET /api/growth/mall/orders  — list orders (stub)
export function handleGetMallOrders(req, res, sendJson, url) {
  const ORDERS_FILE = path.join(DATA_DIR, "mall-orders.json");
  const list = loadJsonArray(ORDERS_FILE);
  const page = parseInt(url.searchParams.get("pageNum") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const start = (page - 1) * pageSize;
  const paged = list.slice(start, start + pageSize);
  return sendOk(res, sendJson, "ok", { list: paged, total: list.length });
}

// POST /api/growth/mall/redeem  — 积分兑换商品（含余额验证 + 积分扣减）
export async function handleMallRedeem(req, res, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const userId = String(body.user_id || body.line_user_id || "").trim();
    const itemId = String(body.item_id || "").trim();

    if (!userId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "user_id 必填");
    if (!itemId) return sendError(res, sendJson, 400, "MISSING_ITEM_ID", "item_id 必填");

    // 1. 加载商品
    const items = loadJsonArray(MALL_ITEMS_FILE);
    const item = items.find(i => i.id === itemId);
    if (!item) return sendError(res, sendJson, 404, "ITEM_NOT_FOUND", "商品不存在");
    if (!item.on_shelf) return sendError(res, sendJson, 400, "ITEM_OFF_SHELF", "商品已下架");
    if (item.item_type === "physical") return sendError(res, sendJson, 400, "PHYSICAL_NOT_SUPPORTED", "实物商品暂不支持积分兑换");

    const pointsRequired = Number(item.points_required) || 0;
    if (pointsRequired <= 0) return sendError(res, sendJson, 400, "NO_POINTS_PRICE", "该商品无积分兑换价格");

    // 2. 检查库存
    if (item.stock != null && item.stock >= 0) {
      const redeems = loadJsonArray(MALL_REDEEMS_FILE);
      const used = redeems.filter(r => r.item_id === itemId && r.status !== "cancelled").length;
      if (used >= item.stock) return sendError(res, sendJson, 400, "OUT_OF_STOCK", "商品库存不足");
    }

    // 3. 加载用户积分账户
    const accounts = loadJsonArray(ACCOUNTS_FILE);
    let account = accounts.find(a => a.user_id === userId || a.line_user_id === userId);
    const available = account ? (account.available_points || 0) : 0;
    if (available < pointsRequired) {
      return sendError(res, sendJson, 400, "INSUFFICIENT_POINTS",
        `积分不足，当前可用 ${available} 积分，兑换需 ${pointsRequired} 积分`);
    }

    const now = new Date().toISOString();

    // 4. 写积分流水（debit / exchange）
    const ledger = loadJsonArray(LEDGER_FILE);
    const ledgerEntry = {
      id: `ledger_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      user_id: userId,
      line_user_id: userId,
      type: "debit",
      points: pointsRequired,
      ref_type: "exchange",
      ref_id: itemId,
      reason: `积分兑换：${typeof item.name === "object" ? (item.name.zh || item.name.en || itemId) : (item.name || itemId)}`,
      created_at: now,
    };
    ledger.push(ledgerEntry);
    saveJsonArray(LEDGER_FILE, ledger);

    // 5. 更新账户余额
    if (!account) {
      account = {
        user_id: userId, line_user_id: userId,
        total_points: 0, available_points: 0,
        pending_points: 0, consumed_points: 0,
        revoked_points: 0, updated_at: now,
      };
      accounts.push(account);
    }
    account.available_points = available - pointsRequired;
    account.consumed_points  = (account.consumed_points || 0) + pointsRequired;
    account.updated_at = now;
    saveJsonArray(ACCOUNTS_FILE, accounts);

    // 6. 写兑换记录
    const redeems = loadJsonArray(MALL_REDEEMS_FILE);
    const record = {
      id: `mr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      user_id: userId,
      item_id: itemId,
      item_name: item.name,
      points_spent: pointsRequired,
      status: "success",
      ledger_id: ledgerEntry.id,
      created_at: now,
    };
    redeems.push(record);
    saveJsonArray(MALL_REDEEMS_FILE, redeems);

    return sendOk(res, sendJson, "兑换成功", {
      redeem_id: record.id,
      item_id: itemId,
      points_spent: pointsRequired,
      remaining_points: account.available_points,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "REDEEM_FAILED", err.message || "兑换失败");
  }
}

// GET /api/growth/mall/redeems  — 用户兑换记录
export function handleGetMallRedeems(req, res, sendJson, url) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id") || "";
  const page = parseInt(url.searchParams.get("pageNum") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  let list = loadJsonArray(MALL_REDEEMS_FILE);
  if (userId) list = list.filter(r => r.user_id === userId);
  list = list.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = list.length;
  const paged = list.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "ok", { list: paged, total });
}
