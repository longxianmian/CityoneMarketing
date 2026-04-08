import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, "..", "..", "data");
const GP_FILE    = path.join(DATA_DIR, "game-programs.json");

function loadPrograms() {
  try { return JSON.parse(fs.readFileSync(GP_FILE, "utf8")); }
  catch { return []; }
}

function savePrograms(list) {
  fs.writeFileSync(GP_FILE, JSON.stringify(list, null, 2), "utf8");
}

export function handleGameProgramList(req, res, url, sendJson) {
  const type = url.searchParams.get("type");
  const list = loadPrograms();
  const result = type ? list.filter(p => p.type === type) : list;
  return sendJson(res, 200, { code: 200, data: result });
}

export function handleGameProgramCreate(req, res, url, sendJson, body) {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const list = loadPrograms();
  const prog = {
    id:          "gp_" + crypto.randomBytes(4).toString("hex"),
    type:        data.type        || "lucky_wheel",
    name:        data.name        || "",
    description: data.description || "",
    slot_count:  data.slot_count  || undefined,
    config:      data.config      || {},
    status:      data.status      || "active",
    created_at:  new Date().toISOString(),
  };
  list.push(prog);
  savePrograms(list);
  return sendJson(res, 200, { code: 200, data: prog });
}

export function handleGameProgramUpdate(req, res, url, sendJson, body) {
  const id   = url.pathname.split("/").pop();
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const list = loadPrograms();
  const idx  = list.findIndex(p => p.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, message: "Not found" });
  list[idx] = {
    ...list[idx],
    ...data,
    id,
    created_at: list[idx].created_at,
    updated_at: new Date().toISOString(),
  };
  savePrograms(list);
  return sendJson(res, 200, { code: 200, data: list[idx] });
}

export function handleGameProgramDelete(req, res, url, sendJson) {
  const id   = url.pathname.split("/").pop();
  const list = loadPrograms();
  const idx  = list.findIndex(p => p.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, message: "Not found" });
  list.splice(idx, 1);
  savePrograms(list);
  return sendJson(res, 200, { code: 200, message: "Deleted" });
}
