import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadMessages() {
  ensureDataDir();
  if (!fs.existsSync(MESSAGES_FILE)) { fs.writeFileSync(MESSAGES_FILE, "[]", "utf-8"); return []; }
  try { const p = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8")); return Array.isArray(p) ? p : []; } catch { return []; }
}
function saveMessages(data) {
  ensureDataDir();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function ok(res, sendJson, data, msg = "ok") {
  return sendJson(res, 200, { code: 200, msg, data });
}
function fail(res, sendJson, code, msg) {
  return sendJson(res, code, { code, msg });
}

export function handleMessageList(req, res, url, sendJson) {
  const list = loadMessages();
  const { channel, event_type, page = 1, pageSize = 50 } = Object.fromEntries(url.searchParams);
  let filtered = list;
  if (channel) filtered = filtered.filter(m => m.channel === channel);
  if (event_type) filtered = filtered.filter(m => m.event_type === event_type);
  const p = Math.max(1, Number(page));
  const ps = Math.min(200, Math.max(1, Number(pageSize)));
  const rows = filtered.slice((p - 1) * ps, p * ps);
  return ok(res, sendJson, { rows, total: filtered.length, page: p, pageSize: ps });
}

export async function handleMessageSave(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const list = loadMessages();
    const now = new Date().toISOString();

    if (body.id) {
      const idx = list.findIndex(m => m.id === body.id);
      if (idx === -1) return fail(res, sendJson, 404, "消息不存在");
      list[idx] = { ...list[idx], ...body, updated_at: now };
      saveMessages(list);
      return ok(res, sendJson, list[idx], "消息已更新");
    }

    if (!body.name) return fail(res, sendJson, 400, "name 必填");
    const item = {
      id: `msg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      name: body.name,
      channel: body.channel || "line",
      event_type: body.event_type || "custom",
      content: body.content || {},
      enabled: body.enabled !== false,
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveMessages(list);
    return ok(res, sendJson, item, "消息已创建");
  } catch (e) {
    return fail(res, sendJson, 500, `操作失败: ${e.message}`);
  }
}

export async function handleMessageDelete(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.id) return fail(res, sendJson, 400, "id 必填");
    const list = loadMessages();
    const idx = list.findIndex(m => m.id === body.id);
    if (idx === -1) return fail(res, sendJson, 404, "消息不存在");
    list.splice(idx, 1);
    saveMessages(list);
    return ok(res, sendJson, null, "消息已删除");
  } catch (e) {
    return fail(res, sendJson, 500, `操作失败: ${e.message}`);
  }
}

export function handleMessageTest(req, res, url, sendJson) {
  return ok(res, sendJson, { tested: true }, "消息测试发送成功（模拟）");
}
