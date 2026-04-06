import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const COUPONS_FILE = path.join(DATA_DIR, "coupons.json");

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, code, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: code });
}
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadCoupons() {
  ensureDataDir();
  if (!fs.existsSync(COUPONS_FILE)) {
    fs.writeFileSync(COUPONS_FILE, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(COUPONS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveCoupons(list) {
  ensureDataDir();
  fs.writeFileSync(COUPONS_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function nextId(list) {
  const max = list.reduce((m, c) => {
    const matched = String(c.id || "").match(/^coupon_(\d+)$/);
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `coupon_${String(max + 1).padStart(3, "0")}`;
}

// GET /api/user/coupons  —— 用户端：仅返回有效卡券
export function handleUserCouponList(req, res, url, sendJson) {
  const now = new Date();
  const list = loadCoupons().filter(c => {
    if (Number(c.status) !== 1) return false;
    if (c.valid_to && new Date(c.valid_to) < now) return false;
    return true;
  });
  return sendOk(res, sendJson, "ok", list);
}

// GET /api/growth/coupon/list?pageNum=1&pageSize=10&name=xxx
export function handleCouponList(req, res, url, sendJson) {
  const pageNum  = Math.max(1, Number(url.searchParams.get("pageNum")  || 1));
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 10));
  const name     = (url.searchParams.get("name") || "").toLowerCase();

  let list = loadCoupons();
  if (name) list = list.filter(c => {
    const n = c.name
    if (!n) return false
    if (typeof n === 'object') return Object.values(n).some(v => (v || '').toLowerCase().includes(name))
    return n.toLowerCase().includes(name)
  });

  const total = list.length;
  const rows  = list
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice((pageNum - 1) * pageSize, pageNum * pageSize);

  return sendOk(res, sendJson, "ok", { rows, total });
}

// POST /api/growth/coupon/add
export async function handleCouponAdd(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

  const { name, couponType, discountType, discountValue, minAmount, totalCount,
          status, validFrom, validTo, coverImage, coverVideo } = body;

  if (!name)          return sendError(res, sendJson, 400, "MISSING_NAME", "券名称不能为空");
  if (!discountType)  return sendError(res, sendJson, 400, "MISSING_DTYPE", "优惠方式不能为空");

  const list = loadCoupons();
  const coupon = {
    id:             nextId(list),
    name,
    coupon_type:    couponType   || "general",
    discount_type:  discountType,
    discount_value: discountValue != null ? Number(discountValue) : 0,
    min_amount:     minAmount    != null ? Number(minAmount)    : 0,
    total_count:    totalCount   != null ? Number(totalCount)   : 0,
    claimed_count:  0,
    status:         status != null ? Number(status) : 1,
    valid_from:     validFrom || null,
    valid_to:       validTo   || null,
    cover_image:    coverImage || "",
    cover_video:    coverVideo || "",
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  };
  list.push(coupon);
  saveCoupons(list);
  return sendOk(res, sendJson, "创建成功", coupon);
}

// POST /api/growth/coupon/update
export async function handleCouponUpdate(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

  const { id, name, couponType, discountType, discountValue, minAmount, totalCount,
          status, validFrom, validTo, coverImage, coverVideo } = body;

  if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少券ID");

  const list = loadCoupons();
  const idx  = list.findIndex(c => c.id === id);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该券");

  const coupon = list[idx];
  if (name          != null)  coupon.name           = name;
  if (couponType    != null)  coupon.coupon_type    = couponType;
  if (discountType  != null)  coupon.discount_type  = discountType;
  if (discountValue != null)  coupon.discount_value = Number(discountValue);
  if (minAmount     != null)  coupon.min_amount     = Number(minAmount);
  if (totalCount    != null)  coupon.total_count    = Number(totalCount);
  if (status        != null)  coupon.status         = Number(status);
  if (validFrom     != null)  coupon.valid_from     = validFrom;
  if (validTo       != null)  coupon.valid_to       = validTo;
  if (coverImage    != null)  coupon.cover_image    = coverImage;
  if (coverVideo    != null)  coupon.cover_video    = coverVideo;
  coupon.updated_at = new Date().toISOString();

  list[idx] = coupon;
  saveCoupons(list);
  return sendOk(res, sendJson, "更新成功", coupon);
}

// POST /api/growth/coupon/delete
export async function handleCouponDelete(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return sendError(res, sendJson, 400, "BAD_BODY", "请求体解析失败"); }

  const { id } = body;
  if (!id) return sendError(res, sendJson, 400, "MISSING_ID", "缺少券ID");

  const list = loadCoupons();
  const idx  = list.findIndex(c => c.id === id);
  if (idx === -1) return sendError(res, sendJson, 404, "NOT_FOUND", "未找到该券");

  list.splice(idx, 1);
  saveCoupons(list);
  return sendOk(res, sendJson, "删除成功", null);
}
