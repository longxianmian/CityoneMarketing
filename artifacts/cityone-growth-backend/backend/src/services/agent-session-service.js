import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const SESSIONS_FILE = path.join(DATA_DIR, "agent-sessions.json");
const MESSAGES_FILE = path.join(DATA_DIR, "agent-messages.json");

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

export function createSession({ lineUserId, userId, siteId, entryType, entryCode, language, identityTier }) {
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
    status: "active",
    message_count: 0,
    created_at: now,
    updated_at: now
  };
  list.push(session);
  // 保留最近 5000 个会话
  if (list.length > 5000) list.splice(0, list.length - 5000);
  saveJsonArray(SESSIONS_FILE, list);
  return session;
}

export function getSession(sessionId) {
  const list = loadJsonArray(SESSIONS_FILE);
  return list.find((s) => s.session_id === sessionId) || null;
}

export function updateSessionCount(sessionId) {
  const list = loadJsonArray(SESSIONS_FILE);
  const idx = list.findIndex((s) => s.session_id === sessionId);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      message_count: (list[idx].message_count || 0) + 1,
      updated_at: new Date().toISOString()
    };
    saveJsonArray(SESSIONS_FILE, list);
  }
}

// ─── 消息管理 ────────────────────────────────────────────────────────────────

export function addMessage({ sessionId, role, text, intentCode, replyPayload }) {
  const list = loadJsonArray(MESSAGES_FILE);
  const msg = {
    message_id: nextId(list, "am", "message_id"),
    session_id: sessionId,
    role, // "user" | "agent"
    text: text || "",
    intent_code: intentCode || "",
    reply_payload: replyPayload || null,
    created_at: new Date().toISOString()
  };
  list.push(msg);
  // 保留最近 20000 条消息
  if (list.length > 20000) list.splice(0, list.length - 20000);
  saveJsonArray(MESSAGES_FILE, list);
  updateSessionCount(sessionId);
  return msg;
}

export function getSessionMessages(sessionId, limit = 50) {
  const list = loadJsonArray(MESSAGES_FILE);
  const msgs = list.filter((m) => m.session_id === sessionId);
  return msgs.slice(-limit);
}
