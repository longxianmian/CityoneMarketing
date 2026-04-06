import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MALL_ITEMS_FILE = path.join(DATA_DIR, "mall-items.json");

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
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const item = {
    id: generateId(),
    name: body.name || "",
    item_type: body.item_type || "digital",
    exchange_mode: body.exchange_mode || "points",
    price_thb: body.price_thb || null,
    points_required: body.points_required || null,
    stock: body.stock == null ? -1 : Number(body.stock),
    on_shelf: body.on_shelf !== false,
    cover_image: body.cover_image || "",
    description: body.description || "",
    sort_order: body.sort_order || list.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  list.push(item);
  saveJsonArray(MALL_ITEMS_FILE, list);
  return sendOk(res, sendJson, "created", item);
}

// PUT /growth/mall/items/:id  — update
export function handleUpdateMallItem(req, res, sendJson, body, itemId) {
  const list = loadJsonArray(MALL_ITEMS_FILE);
  const idx = list.findIndex(i => i.id === itemId);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "Item not found");
  list[idx] = { ...list[idx], ...body, id: list[idx].id, updated_at: new Date().toISOString() };
  saveJsonArray(MALL_ITEMS_FILE, list);
  return sendOk(res, sendJson, "updated", list[idx]);
}

// DELETE /growth/mall/items/:id
export function handleDeleteMallItem(req, res, sendJson, itemId) {
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
