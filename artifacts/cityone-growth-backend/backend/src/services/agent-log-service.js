import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LOGS_FILE = path.join(DATA_DIR, "agent-action-logs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadLogs() {
  ensureDataDir();
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveLogs(data) {
  ensureDataDir();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function nextLogId(list) {
  const max = list.reduce((m, item) => {
    const matched = String(item.log_id || "").match(/^al_(\d+)$/);
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `al_${String(max + 1).padStart(5, "0")}`;
}

export function writeAgentLog({
  sessionId, messageId, lineUserId, userId,
  identityTier, inputText, intentCode, intentConfidence,
  toolCode, toolResultStatus, needConfirm, finalAction
}) {
  const list = loadLogs();
  const record = {
    log_id: nextLogId(list),
    session_id: sessionId || "",
    message_id: messageId || "",
    line_user_id: lineUserId || "",
    user_id: userId || "",
    identity_tier: identityTier || "",
    input_text: inputText || "",
    intent_code: intentCode || "",
    intent_confidence: intentConfidence || 0,
    tool_code: toolCode || "",
    tool_result_status: toolResultStatus || "",
    need_confirm: !!needConfirm,
    final_action: finalAction || "",
    created_at: new Date().toISOString()
  };
  list.push(record);
  // 只保留最近 2000 条，防止文件过大
  if (list.length > 2000) list.splice(0, list.length - 2000);
  saveLogs(list);
  return record;
}

export function queryAgentLogs({ sessionId, lineUserId, intentCode, limit = 50, offset = 0 } = {}) {
  let list = loadLogs();
  if (sessionId) list = list.filter((l) => l.session_id === sessionId);
  if (lineUserId) list = list.filter((l) => l.line_user_id === lineUserId);
  if (intentCode) list = list.filter((l) => l.intent_code === intentCode);
  const total = list.length;
  const items = list.slice(-total).reverse().slice(offset, offset + limit);
  return { total, items };
}

export function computeAgentMetrics() {
  const list = loadLogs();
  const total = list.length;
  const byIntent = {};
  const byTool = {};
  let blocked = 0;
  let confirmed = 0;

  for (const l of list) {
    if (l.intent_code) byIntent[l.intent_code] = (byIntent[l.intent_code] || 0) + 1;
    if (l.tool_code) byTool[l.tool_code] = (byTool[l.tool_code] || 0) + 1;
    if (l.tool_result_status === "blocked") blocked++;
    if (l.need_confirm) confirmed++;
  }

  return {
    total_interactions: total,
    blocked_count: blocked,
    need_confirm_count: confirmed,
    top_intents: Object.entries(byIntent).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ intent: k, count: v })),
    top_tools: Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ tool: k, count: v })),
    computed_at: new Date().toISOString()
  };
}
