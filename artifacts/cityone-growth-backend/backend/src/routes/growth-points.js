import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function loadJsonArray(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

function saveJsonArray(file, arr) {
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf-8");
}

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}

function sendError(res, sendJson, status, code, msg) {
  return sendJson(res, status, { code: status, error: code, msg });
}

// ── 文件路径常量 ────────────────────────────────────────────────────────────
const ACCOUNTS_FILE        = dataFile("points-accounts.json");
const LEDGER_FILE          = dataFile("points-ledger.json");
const SHARE_RELATIONS_FILE = dataFile("share-relations.json");
const CONSUME_FILE         = dataFile("consume-relations.json");
const RULES_FILE           = dataFile("points-rules.json");

// ── 用户端：积分总览 ────────────────────────────────────────────────────────
// GET /growth/user/points/summary?user_id=xxx
export function handleUserPointsSummary(req, res, url, sendJson) {
  const userId = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");
  const accounts = loadJsonArray(ACCOUNTS_FILE);
  let account = accounts.find(
    (a) => (userId && (a.user_id === userId || a.line_user_id === userId))
  );
  if (!account && userId) {
    // 首次访问自动初始化账户
    const now = new Date().toISOString();
    account = {
      user_id: userId,
      line_user_id: userId,
      total_points: 0,
      available_points: 0,
      pending_points: 0,
      consumed_points: 0,
      revoked_points: 0,
      updated_at: now,
    };
    accounts.push(account);
    saveJsonArray(ACCOUNTS_FILE, accounts);
  }
  if (!account) {
    return sendError(res, sendJson, 400, "MISSING_USER_ID", "请传入 user_id 或 line_user_id");
  }
  return sendOk(res, sendJson, "success", account);
}

// ── 用户端：积分流水 ────────────────────────────────────────────────────────
// GET /growth/user/points/ledger?user_id=xxx&page=1&page_size=20
export function handleUserPointsLedger(req, res, url, sendJson) {
  const userId   = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");
  const page     = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  let ledger = loadJsonArray(LEDGER_FILE);
  if (userId) {
    ledger = ledger.filter((l) => l.user_id === userId || l.line_user_id === userId);
  }
  ledger = ledger.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = ledger.length;
  const items = ledger.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
}

// ── 用户端：兑换记录 ────────────────────────────────────────────────────────
// GET /growth/user/points/redeems?user_id=xxx
export function handleUserPointsRedeems(req, res, url, sendJson) {
  const userId   = url.searchParams.get("user_id") || url.searchParams.get("line_user_id");
  const page     = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));

  let ledger = loadJsonArray(LEDGER_FILE).filter((l) => l.ref_type === "exchange");
  if (userId) {
    ledger = ledger.filter((l) => l.user_id === userId || l.line_user_id === userId);
  }
  ledger = ledger.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = ledger.length;
  const items = ledger.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
}

// ── 管理端：积分账户列表 ────────────────────────────────────────────────────
// GET /growth/admin/points/accounts?page=1&page_size=20
export function handleAdminPointsAccounts(req, res, url, sendJson) {
  const page     = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
  const keyword  = url.searchParams.get("keyword") || "";

  let accounts = loadJsonArray(ACCOUNTS_FILE);
  if (keyword) {
    const kw = keyword.toLowerCase();
    accounts = accounts.filter(
      (a) => a.user_id.toLowerCase().includes(kw) || a.line_user_id.toLowerCase().includes(kw)
    );
  }
  accounts = accounts.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const total = accounts.length;
  const items = accounts.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
}

// ── 管理端：分享归因列表 ────────────────────────────────────────────────────
// GET /growth/admin/points/share-relations?page=1&page_size=20
export function handleAdminShareRelations(req, res, url, sendJson) {
  const page      = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize  = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
  const campaignId = url.searchParams.get("campaign_id") || "";
  const status    = url.searchParams.get("points_status") || "";

  let relations = loadJsonArray(SHARE_RELATIONS_FILE);
  if (campaignId) {
    relations = relations.filter((r) => r.campaign_id === campaignId);
  }
  if (status) {
    relations = relations.filter((r) => r.points_status === status);
  }
  relations = relations.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = relations.length;
  const items = relations.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
}

// ── 管理端：消费归因列表 ────────────────────────────────────────────────────
// GET /growth/admin/points/consume-relations?page=1&page_size=20
export function handleAdminConsumeRelations(req, res, url, sendJson) {
  const page     = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
  const userId   = url.searchParams.get("user_id") || "";
  const status   = url.searchParams.get("points_status") || "";

  let relations = loadJsonArray(CONSUME_FILE);
  if (userId) {
    relations = relations.filter((r) => r.user_id === userId || r.line_user_id === userId);
  }
  if (status) {
    relations = relations.filter((r) => r.points_status === status);
  }
  relations = relations.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = relations.length;
  const items = relations.slice((page - 1) * pageSize, page * pageSize);
  return sendOk(res, sendJson, "success", { total, page, page_size: pageSize, items });
}

// ── 积分规则读取 ────────────────────────────────────────────────────────────
// GET /growth/points/rules
export function handlePointsRules(req, res, url, sendJson) {
  const rules = loadJsonArray(RULES_FILE);
  return sendOk(res, sendJson, "success", { rules });
}

// ── 手工积分调整 ────────────────────────────────────────────────────────────
// POST /growth/points/adjust
// body: { user_id, line_user_id, type("credit"|"debit"), points, reason, operator_id }
export async function handlePointsAdjust(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);

    const userId     = body.user_id || body.line_user_id || "";
    const type       = body.type;
    const pts        = parseInt(body.points, 10);
    const reason     = body.reason || "";
    const operatorId = body.operator_id || "";

    if (!userId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "请传入 user_id 或 line_user_id");
    if (type !== "credit" && type !== "debit") return sendError(res, sendJson, 400, "INVALID_TYPE", "type 必须为 credit 或 debit");
    if (!pts || pts <= 0) return sendError(res, sendJson, 400, "INVALID_POINTS", "points 必须为正整数");
    if (!operatorId) return sendError(res, sendJson, 400, "MISSING_OPERATOR", "operator_id 必填，不允许匿名调整");
    if (!reason) return sendError(res, sendJson, 400, "MISSING_REASON", "reason 必填");

    const now = new Date().toISOString();

    // 写入流水
    const ledger = loadJsonArray(LEDGER_FILE);
    const entry = {
      id: `ledger_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      user_id: userId,
      line_user_id: body.line_user_id || userId,
      type,
      points: pts,
      ref_type: "manual_adjust",
      reason,
      operator_id: operatorId,
      created_at: now,
    };
    ledger.push(entry);
    saveJsonArray(LEDGER_FILE, ledger);

    // 更新账户余额
    const accounts = loadJsonArray(ACCOUNTS_FILE);
    let account = accounts.find((a) => a.user_id === userId || a.line_user_id === userId);
    if (!account) {
      account = {
        user_id: userId,
        line_user_id: body.line_user_id || userId,
        total_points: 0,
        available_points: 0,
        pending_points: 0,
        consumed_points: 0,
        revoked_points: 0,
        updated_at: now,
      };
      accounts.push(account);
    }
    if (type === "credit") {
      account.total_points    = (account.total_points || 0) + pts;
      account.available_points = (account.available_points || 0) + pts;
    } else {
      const deductible = account.available_points || 0;
      if (pts > deductible) {
        return sendError(res, sendJson, 400, "INSUFFICIENT_POINTS", `可用积分不足，当前可用 ${deductible}`);
      }
      account.available_points = deductible - pts;
      account.consumed_points  = (account.consumed_points || 0) + pts;
    }
    account.updated_at = now;
    saveJsonArray(ACCOUNTS_FILE, accounts);

    return sendOk(res, sendJson, "调整成功", { ledger_entry: entry, account });
  } catch (err) {
    return sendError(res, sendJson, 500, "SERVER_ERROR", err.message);
  }
}
