import crypto from "node:crypto";

let programs = [
  { id: "gp_001", type: "lucky_wheel", name: "标准大转盘", description: "经典8格转盘，奖品均衡分布", config: { segments: 8 }, status: "active", created_at: new Date().toISOString() },
  { id: "gp_002", type: "lucky_wheel", name: "精简大转盘", description: "4格转盘，大奖集中，适合高回报活动", config: { segments: 4 }, status: "active", created_at: new Date().toISOString() },
  { id: "gp_003", type: "lucky_wheel", name: "豪华大转盘", description: "12格转盘，奖品多样，适合大型活动", config: { segments: 12 }, status: "active", created_at: new Date().toISOString() },
  { id: "gp_004", type: "scratch_card", name: "标准刮刮卡", description: "3连刮，默认60%刮开阈值", config: { threshold: 60 }, status: "active", created_at: new Date().toISOString() },
  { id: "gp_005", type: "scratch_card", name: "轻松刮刮卡", description: "3连刮，40%刮开阈值，体验更流畅", config: { threshold: 40 }, status: "active", created_at: new Date().toISOString() },
  { id: "gp_006", type: "thai_fortune_draw", name: "标准祈福抽签", description: "经典泰式祈福，支持多主题", config: {}, status: "active", created_at: new Date().toISOString() },
  { id: "gp_007", type: "thai_fortune_draw", name: "节日祈福抽签", description: "节日专属主题，喜庆氛围强", config: {}, status: "active", created_at: new Date().toISOString() },
];

export function handleGameProgramList(req, res, url, sendJson) {
  const type = url.searchParams.get("type");
  const list = type ? programs.filter(p => p.type === type) : programs;
  return sendJson(res, 200, { code: 200, data: list });
}

export function handleGameProgramCreate(req, res, url, sendJson, body) {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const prog = {
    id: "gp_" + crypto.randomBytes(4).toString("hex"),
    type: data.type || "lucky_wheel",
    name: data.name || "",
    description: data.description || "",
    config: data.config || {},
    status: data.status || "active",
    created_at: new Date().toISOString(),
  };
  programs.push(prog);
  return sendJson(res, 200, { code: 200, data: prog });
}

export function handleGameProgramUpdate(req, res, url, sendJson, body) {
  const id = url.pathname.split("/").pop();
  const data = typeof body === "string" ? JSON.parse(body) : body;
  const idx = programs.findIndex(p => p.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, message: "Not found" });
  programs[idx] = { ...programs[idx], ...data, id, created_at: programs[idx].created_at };
  return sendJson(res, 200, { code: 200, data: programs[idx] });
}

export function handleGameProgramDelete(req, res, url, sendJson) {
  const id = url.pathname.split("/").pop();
  const idx = programs.findIndex(p => p.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, message: "Not found" });
  programs.splice(idx, 1);
  return sendJson(res, 200, { code: 200, message: "Deleted" });
}
