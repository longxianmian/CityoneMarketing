import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const BANNERS_FILE = path.join(DATA_DIR, "banners.json");

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
  return "bn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// GET /api/growth/banners — list (公开端: enabled=true; 管理端: 全量)
export function handleGetBanners(req, res, sendJson, url) {
  let list = loadJsonArray(BANNERS_FILE);
  const onlyEnabled = url.searchParams.get("enabled") === "true";
  if (onlyEnabled) list = list.filter(b => b.enabled !== false);
  list = list.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return sendOk(res, sendJson, "ok", { list, total: list.length });
}

// POST /api/growth/banners — create
export function handleCreateBanner(req, res, sendJson, body) {
  const list = loadJsonArray(BANNERS_FILE);
  const banner = {
    ...body,
    id: generateId(),
    title: body.title || {},
    sub_title: body.sub_title || {},
    image_url: body.image_url || "",
    link_type: body.link_type || "internal",
    link_url: body.link_url || "",
    sort_order: body.sort_order != null ? Number(body.sort_order) : list.length,
    enabled: body.enabled !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  list.push(banner);
  saveJsonArray(BANNERS_FILE, list);
  return sendOk(res, sendJson, "created", banner);
}

// PUT /api/growth/banners/:id — update
export function handleUpdateBanner(req, res, sendJson, body, bannerId) {
  const list = loadJsonArray(BANNERS_FILE);
  const idx = list.findIndex(b => b.id === bannerId);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "Banner not found");
  list[idx] = { ...list[idx], ...body, id: list[idx].id, updated_at: new Date().toISOString() };
  saveJsonArray(BANNERS_FILE, list);
  return sendOk(res, sendJson, "updated", list[idx]);
}

// DELETE /api/growth/banners/:id
export function handleDeleteBanner(req, res, sendJson, bannerId) {
  const list = loadJsonArray(BANNERS_FILE);
  const next = list.filter(b => b.id !== bannerId);
  if (next.length === list.length) return sendError(res, sendJson, 404, "NOT_FOUND", "Banner not found");
  saveJsonArray(BANNERS_FILE, next);
  return sendOk(res, sendJson, "deleted", null);
}
