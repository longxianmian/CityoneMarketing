import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const SESSIONS_FILE = path.join(DATA_DIR, "agent-sessions.json");
const MESSAGES_FILE = path.join(DATA_DIR, "agent-messages.json");

const SESSION_MAX = 5000;
const MESSAGE_MAX = 20000;
const SESSION_TTL_DAYS = 7;

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
  return `${prefix}_${String(max + 1).padStart(5, "0")}`;
}

// ─── 会话管理 ────────────────────────────────────────────────────────────────

/**
 * 查找该用户最近的活跃主会话（scene=agent_main, status=active）
 * 7 天内有活动的会话认为可恢复
 */
export function getLatestActiveSession(lineUserId, scene = "agent_main") {
  if (!lineUserId) return null;
  const list = loadJsonArray(SESSIONS_FILE);
  const cutoff = new Date(Date.now() - SESSION_TTL_DAYS * 86400 * 1000).toISOString();
  const candidates = list.filter(
    (s) =>
      s.line_user_id === lineUserId &&
      s.scene === scene &&
      s.status === "active" &&
      s.last_active_at >= cutoff
  );
  if (!candidates.length) return null;
  // 返回 last_active_at 最新的一个
  return candidates.sort((a, b) => b.last_active_at.localeCompare(a.last_active_at))[0];
}

export function createSession({ lineUserId, userId, siteId, entryType, entryCode, language, identityTier, scene = "agent_main" }) {
  const list = loadJsonArray(SESSIONS_FILE);
  const now = new Date().toISOString();
  const session = {
    session_id: nextId(list, "as", "session_id"),
    line_user_id: lineUserId || "",
    user_id: userId || "",
    site_id: siteId || "",
    entry_type: entryType || "",
    entry_code: entryCode || "",
    language: language || "zh",
    identity_tier: identityTier || "guest_unfollowed",
    scene,
    status: "active",
    message_count: 0,
    created_at: now,
    last_active_at: now,
    updated_at: now
  };
  list.push(session);
  if (list.length > SESSION_MAX) list.splice(0, list.length - SESSION_MAX);
  saveJsonArray(SESSIONS_FILE, list);
  return session;
}

/**
 * 优先恢复该用户最近活跃会话，没有则创建新会话
 * 返回 { session, restored: boolean }
 */
export function getOrCreateSession({ lineUserId, userId, siteId, entryType, entryCode, language, identityTier, scene = "agent_main" }) {
  const existing = getLatestActiveSession(lineUserId, scene);
  if (existing) {
    // 若旧 session 的 user_id 为空，用本次传入的设备 ID 补填，保证工具查询身份一致
    if (!existing.user_id && userId) {
      const list = loadJsonArray(SESSIONS_FILE);
      const idx = list.findIndex((s) => s.session_id === existing.session_id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], user_id: userId };
        saveJsonArray(SESSIONS_FILE, list);
        existing.user_id = userId;
      }
    }
    touchSession(existing.session_id);
    return { session: existing, restored: true };
  }
  const session = createSession({ lineUserId, userId, siteId, entryType, entryCode, language, identityTier, scene });
  return { session, restored: false };
}

export function getSession(sessionId) {
  const list = loadJsonArray(SESSIONS_FILE);
  return list.find((s) => s.session_id === sessionId) || null;
}

/**
 * 更新会话最近活跃时间
 */
export function touchSession(sessionId) {
  const list = loadJsonArray(SESSIONS_FILE);
  const idx = list.findIndex((s) => s.session_id === sessionId);
  if (idx >= 0) {
    const now = new Date().toISOString();
    list[idx] = { ...list[idx], last_active_at: now, updated_at: now };
    saveJsonArray(SESSIONS_FILE, list);
  }
}

export function updateSessionCount(sessionId) {
  const list = loadJsonArray(SESSIONS_FILE);
  const idx = list.findIndex((s) => s.session_id === sessionId);
  if (idx >= 0) {
    const now = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      message_count: (list[idx].message_count || 0) + 1,
      last_active_at: now,
      updated_at: now
    };
    saveJsonArray(SESSIONS_FILE, list);
  }
}

// ─── 消息管理 ────────────────────────────────────────────────────────────────

/**
 * 写入消息
 * role: "user" | "agent"
 * type: "text" | "tool_card" | "welcome" | "confirm_request" 等
 * payload: 前端渲染用的结构化数据（cards / suggestions 等）
 */
export function addMessage({ sessionId, role, text, type, payload, intentCode, replyPayload }) {
  const list = loadJsonArray(MESSAGES_FILE);

  // 兼容旧调用（replyPayload -> payload）；新调用直接传 payload
  const resolvedPayload = payload !== undefined ? payload : (replyPayload || null);
  // type 优先从参数取，若未传则从 replyPayload 推断
  const resolvedType = type || (resolvedPayload?.reply_type) || "text";

  const msg = {
    message_id: nextId(list, "am", "message_id"),
    session_id: sessionId,
    role,
    type: resolvedType,
    text: text || "",
    payload: resolvedPayload,
    intent_code: intentCode || "",
    created_at: new Date().toISOString()
  };
  list.push(msg);
  if (list.length > MESSAGE_MAX) list.splice(0, list.length - MESSAGE_MAX);
  saveJsonArray(MESSAGES_FILE, list);
  updateSessionCount(sessionId);
  return msg;
}

export function getSessionMessages(sessionId, limit = 50) {
  const list = loadJsonArray(MESSAGES_FILE);
  const msgs = list.filter((m) => m.session_id === sessionId);
  return msgs.slice(-limit);
}
