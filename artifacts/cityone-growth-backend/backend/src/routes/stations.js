import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STATIONS_FILE = path.join(DATA_DIR, "stations.json");

export const CITY_DISTRICTS = [
  { code: "bangkok", zh: "曼谷", th: "กรุงเทพฯ", en: "Bangkok", districts: [
    { code: "siam", zh: "暹罗商圈", th: "สยาม", en: "Siam" },
    { code: "sukhumvit", zh: "素坤逸", th: "สุขุมวิท", en: "Sukhumvit" },
    { code: "silom", zh: "是隆", th: "สีลม", en: "Silom" },
    { code: "chatuchak", zh: "恰图恰", th: "จตุจักร", en: "Chatuchak" },
    { code: "ladprao", zh: "拉差达/拉玛九", th: "ลาดพร้าว", en: "Lat Phrao" },
    { code: "bangna", zh: "邦纳", th: "บางนา", en: "Bang Na" },
  ]},
  { code: "chiang-mai", zh: "清迈", th: "เชียงใหม่", en: "Chiang Mai", districts: [
    { code: "old-city", zh: "古城区", th: "เมืองเก่า", en: "Old City" },
    { code: "nimman", zh: "尼曼区", th: "นิมมาน", en: "Nimmanhaemin" },
    { code: "airport", zh: "机场区", th: "แม่เหียะ", en: "Airport Area" },
  ]},
  { code: "pattaya", zh: "芭堤雅", th: "พัทยา", en: "Pattaya", districts: [
    { code: "central", zh: "中央区", th: "พัทยากลาง", en: "Central Pattaya" },
    { code: "north", zh: "北区", th: "พัทยาเหนือ", en: "North Pattaya" },
    { code: "south", zh: "南区", th: "พัทยาใต้", en: "South Pattaya" },
  ]},
  { code: "phuket", zh: "普吉", th: "ภูเก็ต", en: "Phuket", districts: [
    { code: "patong", zh: "芭东", th: "ป่าตอง", en: "Patong" },
    { code: "phuket-town", zh: "普吉镇", th: "เมืองภูเก็ต", en: "Phuket Town" },
    { code: "kata-karon", zh: "卡塔卡隆", th: "กะตะ-กะรน", en: "Kata-Karon" },
  ]},
  { code: "khon-kaen", zh: "孔敬", th: "ขอนแก่น", en: "Khon Kaen", districts: [
    { code: "city-center", zh: "市中心", th: "ใจกลางเมือง", en: "City Center" },
    { code: "university", zh: "大学区", th: "มหาวิทยาลัย", en: "University Area" },
  ]},
  { code: "hat-yai", zh: "合艾", th: "หาดใหญ่", en: "Hat Yai", districts: [
    { code: "downtown", zh: "市区", th: "ตัวเมือง", en: "Downtown" },
    { code: "lee-garden", zh: "Lee Garden", th: "ลีการ์เด้น", en: "Lee Garden" },
  ]},
];

const INITIAL_STATIONS = [
  {
    id: "st_001",
    name: { zh: "暹罗广场站点 A", th: "สยามสแควร์ A", en: "Siam Square A" },
    city: "bangkok", district: "siam",
    address: "Siam Square One, Pathum Wan, Bangkok",
    lat: 13.7455, lng: 100.5341,
    status: "active", capacity: 8, available: 5,
    source: "manual", external_id: "",
  },
  {
    id: "st_002",
    name: { zh: "MBK购物中心站点", th: "MBK Center", en: "MBK Center Station" },
    city: "bangkok", district: "siam",
    address: "MBK Center, Phaya Thai, Bangkok",
    lat: 13.7448, lng: 100.5299,
    status: "active", capacity: 12, available: 8,
    source: "manual", external_id: "",
  },
  {
    id: "st_003",
    name: { zh: "素坤逸11路站点", th: "สุขุมวิท 11", en: "Sukhumvit 11 Station" },
    city: "bangkok", district: "sukhumvit",
    address: "Sukhumvit Soi 11, Watthana, Bangkok",
    lat: 13.7426, lng: 100.5540,
    status: "active", capacity: 6, available: 3,
    source: "manual", external_id: "",
  },
  {
    id: "st_004",
    name: { zh: "尼曼1路站点", th: "นิมมาน 1", en: "Nimman 1 Station" },
    city: "chiang-mai", district: "nimman",
    address: "Nimmanhaemin Rd Soi 1, Chiang Mai",
    lat: 18.7995, lng: 98.9677,
    status: "active", capacity: 8, available: 6,
    source: "manual", external_id: "",
  },
  {
    id: "st_005",
    name: { zh: "芭东海滩站点", th: "ป่าตองบีช", en: "Patong Beach Station" },
    city: "phuket", district: "patong",
    address: "Patong Beach Rd, Kathu, Phuket",
    lat: 7.8955, lng: 98.2990,
    status: "active", capacity: 10, available: 7,
    source: "manual", external_id: "",
  },
  {
    id: "st_006",
    name: { zh: "是隆大厦站点", th: "สีลมคอมเพล็กซ์", en: "Silom Complex Station" },
    city: "bangkok", district: "silom",
    address: "Silom Complex, Silom Rd, Bangkok",
    lat: 13.7283, lng: 100.5333,
    status: "active", capacity: 8, available: 4,
    source: "manual", external_id: "",
  },
];

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadStations() {
  ensureDataDir();
  if (!fs.existsSync(STATIONS_FILE)) {
    fs.writeFileSync(STATIONS_FILE, JSON.stringify(INITIAL_STATIONS, null, 2), "utf-8");
    return [...INITIAL_STATIONS];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATIONS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveStations(data) {
  ensureDataDir();
  fs.writeFileSync(STATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function handleGetCityDistricts(req, res, sendJson) {
  return sendJson(res, 200, { code: 200, msg: "success", data: CITY_DISTRICTS });
}

export function handleGetStations(req, res, url, sendJson) {
  const city = url.searchParams.get("city") || "";
  const district = url.searchParams.get("district") || "";
  const status = url.searchParams.get("status") || "";
  const ids = url.searchParams.get("ids") || "";

  let list = loadStations();
  if (city) list = list.filter(s => s.city === city);
  if (district) list = list.filter(s => s.district === district);
  if (status) list = list.filter(s => s.status === status);
  if (ids) {
    const idSet = new Set(ids.split(",").map(x => x.trim()));
    list = list.filter(s => idSet.has(s.id));
  }
  return sendJson(res, 200, { code: 200, msg: "success", data: { list, total: list.length } });
}

export function handleGetNearbyStations(req, res, url, sendJson) {
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const radius = parseFloat(url.searchParams.get("radius") || "3");
  const city = url.searchParams.get("city") || "";

  let list = loadStations().filter(s => s.status === "active");
  if (city) list = list.filter(s => s.city === city);

  if (isNaN(lat) || isNaN(lng)) {
    return sendJson(res, 200, { code: 200, msg: "success", data: { list, total: list.length, located: false } });
  }

  const nearby = list
    .map(s => ({ ...s, distance_km: Math.round(haversine(lat, lng, s.lat, s.lng) * 10) / 10 }))
    .filter(s => s.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km);

  return sendJson(res, 200, { code: 200, msg: "success", data: { list: nearby, total: nearby.length, located: true, lat, lng, radius } });
}

export function handleGetStation(req, res, url, sendJson) {
  const id = url.pathname.split("/").pop();
  const station = loadStations().find(s => s.id === id);
  if (!station) return sendJson(res, 404, { code: 404, msg: "站点不存在" });
  return sendJson(res, 200, { code: 200, msg: "success", data: station });
}

export function handleCreateStation(req, res, sendJson, body) {
  const list = loadStations();
  const id = `st_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date().toISOString();
  const station = {
    id,
    name: body.name || { zh: "", th: "", en: "" },
    city: body.city || "",
    district: body.district || "",
    address: body.address || "",
    lat: Number(body.lat) || 0,
    lng: Number(body.lng) || 0,
    status: body.status || "active",
    capacity: Number(body.capacity) || 0,
    available: Number(body.available) || 0,
    source: body.source || "manual",
    external_id: body.external_id || "",
    createdAt: now,
    updatedAt: now,
  };
  list.push(station);
  saveStations(list);
  return sendJson(res, 200, { code: 200, msg: "创建成功", data: station });
}

export function handleUpdateStation(req, res, url, sendJson, body) {
  const id = url.pathname.split("/").pop();
  const list = loadStations();
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, msg: "站点不存在" });
  list[idx] = { ...list[idx], ...body, id, updatedAt: new Date().toISOString() };
  saveStations(list);
  return sendJson(res, 200, { code: 200, msg: "更新成功", data: list[idx] });
}

export function handleDeleteStation(req, res, url, sendJson) {
  const id = url.pathname.split("/").pop();
  const list = loadStations();
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return sendJson(res, 404, { code: 404, msg: "站点不存在" });
  list.splice(idx, 1);
  saveStations(list);
  return sendJson(res, 200, { code: 200, msg: "删除成功" });
}
