/**
 * stations.js — 站点与 A 系统旁路连接预留
 * 第二批第3份整改：全量走 PostgreSQL，移除 JSON 文件依赖
 */
import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

// ─── 城市/区域静态字典（无需落库，保持常量） ───────────────────────────────
export const CITY_DISTRICTS = [
  { code: "bangkok", zh: "曼谷", th: "กรุงเทพฯ", en: "Bangkok", districts: [
    { code: "siam",       zh: "暹罗商圈",  th: "สยาม",      en: "Siam" },
    { code: "sukhumvit",  zh: "素坤逸",    th: "สุขุมวิท",  en: "Sukhumvit" },
    { code: "silom",      zh: "是隆",      th: "สีลม",      en: "Silom" },
    { code: "chatuchak",  zh: "恰图恰",    th: "จตุจักร",   en: "Chatuchak" },
    { code: "ladprao",    zh: "拉差达/拉玛九", th: "ลาดพร้าว", en: "Lat Phrao" },
    { code: "bangna",     zh: "邦纳",      th: "บางนา",     en: "Bang Na" },
  ]},
  { code: "chiang-mai", zh: "清迈", th: "เชียงใหม่", en: "Chiang Mai", districts: [
    { code: "old-city",  zh: "古城区", th: "เมืองเก่า", en: "Old City" },
    { code: "nimman",    zh: "尼曼区", th: "นิมมาน",   en: "Nimmanhaemin" },
    { code: "airport",   zh: "机场区", th: "แม่เหียะ",  en: "Airport Area" },
  ]},
  { code: "pattaya", zh: "芭堤雅", th: "พัทยา", en: "Pattaya", districts: [
    { code: "central", zh: "中央区", th: "พัทยากลาง", en: "Central Pattaya" },
    { code: "north",   zh: "北区",   th: "พัทยาเหนือ", en: "North Pattaya" },
    { code: "south",   zh: "南区",   th: "พัทยาใต้",  en: "South Pattaya" },
  ]},
  { code: "phuket", zh: "普吉", th: "ภูเก็ต", en: "Phuket", districts: [
    { code: "patong",      zh: "芭东",   th: "ป่าตอง",       en: "Patong" },
    { code: "phuket-town", zh: "普吉镇", th: "เมืองภูเก็ต", en: "Phuket Town" },
    { code: "kata-karon",  zh: "卡塔卡隆", th: "กะตะ-กะรน",  en: "Kata-Karon" },
  ]},
  { code: "khon-kaen", zh: "孔敬", th: "ขอนแก่น", en: "Khon Kaen", districts: [
    { code: "city-center", zh: "市中心", th: "ใจกลางเมือง",   en: "City Center" },
    { code: "university",  zh: "大学区", th: "มหาวิทยาลัย",  en: "University Area" },
  ]},
  { code: "hat-yai", zh: "合艾", th: "หาดใหญ่", en: "Hat Yai", districts: [
    { code: "downtown",   zh: "市区",      th: "ตัวเมือง",    en: "Downtown" },
    { code: "lee-garden", zh: "Lee Garden", th: "ลีการ์เด้น", en: "Lee Garden" },
  ]},
];

// ─── Haversine 距离计算 ─────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─── DB 行 → API 响应映射（向后兼容前端字段名） ────────────────────────────
function rowToStation(row) {
  return {
    // 向后兼容：前端使用 id / name / city / lat / lng / available
    id:           row.station_code,
    name:         row.station_name,
    city:         row.city_code,
    district:     row.district,
    address:      row.address,
    lat:          Number(row.latitude),
    lng:          Number(row.longitude),
    status:       row.status,
    capacity:     row.capacity,
    available:    row.available_count,
    source:       row.source,
    external_id:  row.a_system_station_id,
    // 新增字段（前端可渐进使用）
    station_code:        row.station_code,
    station_type:        row.station_type,
    country_code:        row.country_code,
    venue_name:          row.venue_name,
    venue_type:          row.venue_type,
    source_channel_id:   row.source_channel_id,
    entry_code:          row.entry_code,
    landing_code:        row.landing_code,
    default_activity_id: row.default_activity_id,
    a_system_station_id: row.a_system_station_id,
    device_code:         row.device_code,
    device_group_code:   row.device_group_code,
    a_system_device_id:  row.a_system_device_id,
    sort_order:          row.sort_order,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
  };
}

function parseJsonObject(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickML(value, lang = "zh") {
  if (!value) return "";
  const obj = parseJsonObject(value, null);
  if (obj && typeof obj === "object") return obj[lang] || obj.zh || obj.en || obj.th || "";
  return String(value);
}

function matchesStationScope(rawScope, station) {
  const scope = parseJsonObject(rawScope, { type: "all" }) || { type: "all" };
  if (!scope || scope.type === "all") return true;
  if (scope.type !== "selected") return false;

  const city = String(scope.city || "").trim();
  const district = String(scope.district || "").trim();
  const stationIds = Array.isArray(scope.station_ids) ? scope.station_ids.map((id) => String(id)) : [];

  if (city && station.city !== city) return false;
  if (district && station.district !== district) return false;
  if (stationIds.length > 0 && !stationIds.includes(station.station_code || station.id)) return false;
  return true;
}

function activityBenefitSummary(row) {
  return {
    id: row.activity_id,
    name: pickML(row.activity_name, "zh") || row.activity_id,
    status: row.status || "",
    type: row.activity_type || "",
    match_mode: row.match_mode || "site_scope",
  };
}

function couponBenefitSummary(row) {
  return {
    id: row.id,
    name: pickML(row.name, "zh") || row.id,
    status: Number(row.status) === 1 ? "active" : "inactive",
    coupon_type: row.coupon_type || "",
    benefit_action_type: row.benefit_action_type || "benefit_detail",
  };
}

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, status, error, msg) {
  return sendJson(res, status, { code: status, error, msg });
}

// ─── 内部：A系统字段程序级防重校验 ──────────────────────────────────────────
// DB 层已有部分唯一索引（WHERE != ''），此处作为前置程序守卫提供清晰错误信息
async function validateASystemFieldUniqueness(res, sendJson, fields, excludeCode = null) {
  const checks = [
    { col: "a_system_station_id", val: fields.a_system_station_id, label: "A系统站点ID" },
    { col: "device_code",         val: fields.device_code,         label: "设备编码" },
    { col: "a_system_device_id",  val: fields.a_system_device_id,  label: "A系统设备ID" },
  ];
  for (const { col, val, label } of checks) {
    if (!val) continue;
    const whereExtra = excludeCode ? ` AND station_code <> $3` : "";
    const params = [col, val];
    if (excludeCode) params.push(excludeCode);
    // 动态列名不能参数化，但 col 来自内部常量列表，安全
    const { rows } = await query(
      `SELECT station_code FROM stations WHERE ${col}=$1 AND ${col} <> ''${excludeCode ? ` AND station_code <> $2` : ""}`,
      excludeCode ? [val, excludeCode] : [val]
    );
    if (rows.length > 0)
      return sendError(res, sendJson, 409, "A_SYSTEM_FIELD_DUPLICATE",
        `${label} "${val}" 已被站点 ${rows[0].station_code} 使用，A系统字段必须全局唯一`);
  }
  return null;
}

// ─── GET /api/stations/city-districts ────────────────────────────────────────
export function handleGetCityDistricts(req, res, sendJson) {
  return sendJson(res, 200, { code: 200, msg: "success", data: CITY_DISTRICTS });
}

// ─── GET /api/stations ────────────────────────────────────────────────────────
export async function handleGetStations(req, res, url, sendJson) {
  try {
    const city     = url.searchParams.get("city")     || "";
    const district = url.searchParams.get("district") || "";
    const status   = url.searchParams.get("status")   || "";
    const ids      = url.searchParams.get("ids")      || "";
    const page     = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") || 200)));

    const params = [];
    const where  = [];
    if (city)     { params.push(city);     where.push(`city_code=$${params.length}`); }
    if (district) { params.push(district); where.push(`district=$${params.length}`); }
    if (status)   { params.push(status);   where.push(`status=$${params.length}`); }
    if (ids) {
      const idList = ids.split(",").map(x => x.trim()).filter(Boolean);
      if (idList.length > 0) {
        params.push(idList);
        where.push(`station_code = ANY($${params.length})`);
      }
    }
    const whereClause = where.length ? " WHERE " + where.join(" AND ") : "";
    const { rows: countRows } = await query(`SELECT COUNT(*) AS cnt FROM stations${whereClause}`, params);
    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const { rows } = await query(
      `SELECT * FROM stations${whereClause} ORDER BY sort_order ASC, station_code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const list = rows.map(rowToStation);
    return sendOk(res, sendJson, "success", { list, total: Number(countRows[0].cnt) });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── GET /api/stations/nearby ─────────────────────────────────────────────────
export async function handleGetNearbyStations(req, res, url, sendJson) {
  try {
    const lat    = parseFloat(url.searchParams.get("lat")    || "");
    const lng    = parseFloat(url.searchParams.get("lng")    || "");
    const radius = parseFloat(url.searchParams.get("radius") || "3");
    const city   = url.searchParams.get("city") || "";

    const params = ["active"];
    const where  = ["status=$1"];
    if (city) { params.push(city); where.push(`city_code=$${params.length}`); }
    const { rows } = await query(
      `SELECT * FROM stations WHERE ${where.join(" AND ")} ORDER BY sort_order ASC, station_code ASC`,
      params
    );
    const list = rows.map(rowToStation);

    if (isNaN(lat) || isNaN(lng)) {
      return sendOk(res, sendJson, "success", { list, total: list.length, located: false });
    }

    const nearby = list
      .map(s => ({ ...s, distance_km: Math.round(haversine(lat, lng, s.lat, s.lng) * 10) / 10 }))
      .filter(s => s.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    // ── 批量查询各站点绑定的活动（default_activity_id + site_scope 反查）──────
    const activityIds = [...new Set(
      nearby.map(s => s.default_activity_id).filter(Boolean)
    )];
    const stationCodes = nearby.map(s => s.station_code).filter(Boolean);

    let activityMap = {};  // activity_id → activity row

    // 1. 按 default_activity_id 批量取
    if (activityIds.length > 0) {
      const { rows: actRows } = await query(
        `SELECT activity_id, activity_name, activity_subtitle, activity_type, status, cover_image, start_time, end_time, goal
           FROM activities
          WHERE activity_id = ANY($1) AND status = 'active'`,
        [activityIds]
      );
      actRows.forEach(r => { activityMap[r.activity_id] = r; });
    }

    // 2. 反查 site_scope_json 中包含这些站点的活动（取每个站点最多1条）
    let scopeActivities = [];
    if (stationCodes.length > 0) {
      const { rows: scopeRows } = await query(
        `SELECT activity_id, activity_name, activity_subtitle, activity_type, status, cover_image, start_time, end_time, goal, site_scope_json
           FROM activities
          WHERE status = 'active'
            AND site_scope_json IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 100`
      );
      scopeActivities = scopeRows.filter(r => {
        try {
          const scope = typeof r.site_scope_json === "string" ? JSON.parse(r.site_scope_json) : r.site_scope_json;
          if (!scope) return false;
          if (scope.type === "all") return true;
          const codes = scope.station_codes || [];
          return stationCodes.some(c => codes.includes(c));
        } catch { return false; }
      });
    }

    // ── 把活动附加到对应站点 ───────────────────────────────────────────────
    const pickML = (v, lang = "zh") => {
      if (!v) return "";
      let obj = v;
      if (typeof v === "string") { try { obj = JSON.parse(v); } catch { return v; } }
      if (typeof obj === "object") return obj[lang] || obj.zh || obj.en || obj.th || "";
      return String(v);
    };

    const toActivitySummary = (r) => r ? {
      id: r.activity_id,
      name:     { zh: pickML(r.activity_name, "zh"), th: pickML(r.activity_name, "th"), en: pickML(r.activity_name, "en") },
      subtitle: { zh: pickML(r.activity_subtitle, "zh"), th: pickML(r.activity_subtitle, "th"), en: pickML(r.activity_subtitle, "en") },
      type:  r.activity_type,
      cover: r.cover_image || "",
      goal:  r.goal || "",
      start_time: r.start_time,
      end_time:   r.end_time,
    } : null;

    const enriched = nearby.map(s => {
      // 优先用 default_activity_id 绑定的活动，否则用 site_scope 反查第一条
      const directActivity = s.default_activity_id ? activityMap[s.default_activity_id] : null;
      const scopeActivity  = !directActivity
        ? scopeActivities.find(r => {
            try {
              const scope = typeof r.site_scope_json === "string" ? JSON.parse(r.site_scope_json) : r.site_scope_json;
              if (!scope) return false;
              if (scope.type === "all") return true;
              return (scope.station_codes || []).includes(s.station_code);
            } catch { return false; }
          })
        : null;
      return {
        ...s,
        activity: toActivitySummary(directActivity || scopeActivity || null),
      };
    });

    return sendOk(res, sendJson, "success", { list: enriched, total: enriched.length, located: true, lat, lng, radius });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── GET /api/stations/benefits ───────────────────────────────────────────────
// 从站点维度汇总站点命中的活动/卡券，供管理端站点福利页验证真实承接结果
export async function handleGetStationBenefits(req, res, url, sendJson) {
  try {
    const city     = url.searchParams.get("city")     || "";
    const district = url.searchParams.get("district") || "";
    const status   = url.searchParams.get("status")   || "";

    const params = [];
    const where = [];
    if (city)     { params.push(city);     where.push(`city_code=$${params.length}`); }
    if (district) { params.push(district); where.push(`district=$${params.length}`); }
    if (status)   { params.push(status);   where.push(`status=$${params.length}`); }
    const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

    const { rows: stationRows } = await query(
      `SELECT * FROM stations${whereClause} ORDER BY sort_order ASC, station_code ASC`,
      params
    );
    const stations = stationRows.map(rowToStation);

    const { rows: activityRows } = await query(
      `SELECT activity_id, activity_name, activity_type, status, site_scope_json
         FROM activities
        WHERE status IN ('active', 'draft')
        ORDER BY created_at DESC`,
      []
    );
    const activityById = new Map(activityRows.map((row) => [String(row.activity_id), row]));

    const { rows: couponRows } = await query(
      `SELECT id, name, coupon_type, status, station_scope, benefit_action_type
         FROM coupons
        WHERE status = 1
        ORDER BY created_at DESC`,
      []
    );

    const list = stations.map((station) => {
      const matchedActivities = [];
      const seenActivityIds = new Set();

      if (station.default_activity_id && activityById.has(station.default_activity_id)) {
        matchedActivities.push(
          activityBenefitSummary({
            ...activityById.get(station.default_activity_id),
            match_mode: "default_activity",
          })
        );
        seenActivityIds.add(station.default_activity_id);
      }

      for (const row of activityRows) {
        const activityId = String(row.activity_id);
        if (seenActivityIds.has(activityId)) continue;
        if (matchesStationScope(row.site_scope_json, station)) {
          matchedActivities.push(activityBenefitSummary({ ...row, match_mode: "site_scope" }));
        }
      }

      const matchedCoupons = couponRows
        .filter((row) => matchesStationScope(row.station_scope, station))
        .map(couponBenefitSummary);

      return {
        ...station,
        activities: matchedActivities,
        coupons: matchedCoupons,
        activity_count: matchedActivities.length,
        coupon_count: matchedCoupons.length,
        benefit_count: matchedActivities.length + matchedCoupons.length,
        has_benefits: matchedActivities.length + matchedCoupons.length > 0,
        primary_benefit_label: matchedActivities[0]?.name || matchedCoupons[0]?.name || "",
      };
    });

    return sendOk(res, sendJson, "station benefits loaded", {
      list,
      total: list.length,
      summary: {
        station_count: list.length,
        station_with_benefits_count: list.filter((item) => item.has_benefits).length,
        activity_hit_count: list.reduce((sum, item) => sum + Number(item.activity_count || 0), 0),
        coupon_hit_count: list.reduce((sum, item) => sum + Number(item.coupon_count || 0), 0),
      },
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── GET /api/stations/:id ────────────────────────────────────────────────────
export async function handleGetStation(req, res, url, sendJson) {
  try {
    const code = url.pathname.split("/").pop();
    const { rows } = await query("SELECT * FROM stations WHERE station_code=$1", [code]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "站点不存在");

    // 查询绑定的 entry 信息（一条站点→entry 归因链，用于链路验证）
    const station = rowToStation(rows[0]);
    if (station.entry_code) {
      const { rows: entries } = await query(
        "SELECT entry_code, entry_qr_code, landing_code, default_activity_code, device_code, a_system_device_id FROM entry_instances WHERE entry_code=$1",
        [station.entry_code]
      );
      if (entries.length > 0) station._entry_binding = entries[0];
    }

    return sendOk(res, sendJson, "success", station);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── POST /api/stations ───────────────────────────────────────────────────────
export async function handleCreateStation(req, res, sendJson, body) {
  try {
    const rawName = body.name || body.station_name || { zh: "", th: "", en: "" };
    const stationName = typeof rawName === "object" && rawName !== null ? rawName : { zh: String(rawName), th: "", en: "" };
    if (!stationName.zh) return sendError(res, sendJson, 400, "NAME_REQUIRED", "站点中文名称必填");

    // 生成 station_code
    const { rows: last } = await query("SELECT COUNT(*) AS cnt FROM stations", []);
    const cnt = parseInt(last[0]?.cnt || "0");
    const stationCode = body.station_code || `st_${String(cnt + 1).padStart(3, "0")}`;

    const { rows: dup } = await query("SELECT id FROM stations WHERE station_code=$1", [stationCode]);
    if (dup.length > 0) return sendError(res, sendJson, 409, "DUPLICATE", `station_code "${stationCode}" 已存在`);

    // A系统字段程序级防重
    const aErr = await validateASystemFieldUniqueness(res, sendJson, {
      a_system_station_id: body.external_id || body.a_system_station_id || "",
      device_code:         body.device_code        || "",
      a_system_device_id:  body.a_system_device_id || "",
    });
    if (aErr !== null) return;

    const { rows } = await query(
      `INSERT INTO stations (
        station_code, station_name, station_type, status,
        country_code, city_code, district, address, venue_name, venue_type,
        latitude, longitude, capacity, available_count,
        source, source_channel_id,
        entry_code, landing_code, default_activity_id,
        a_system_station_id, device_code, device_group_code, a_system_device_id,
        sort_order, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,
        $17,$18,$19,
        $20,$21,$22,$23,
        $24,NOW(),NOW()
      ) RETURNING *`,
      [
        stationCode,
        JSON.stringify(stationName),
        body.station_type || "powerbank",
        body.status || "active",
        body.country_code || "TH",
        body.city || body.city_code || "",
        body.district || "",
        body.address || "",
        body.venue_name || "",
        body.venue_type || "",
        Number(body.lat ?? body.latitude) || 0,
        Number(body.lng ?? body.longitude) || 0,
        Number(body.capacity) || 0,
        Number(body.available ?? body.available_count) || 0,
        body.source || "manual",
        body.source_channel_id || "",
        body.entry_code || "",
        body.landing_code || "",
        body.default_activity_id || "",
        body.external_id || body.a_system_station_id || "",
        body.device_code || "",
        body.device_group_code || "",
        body.a_system_device_id || "",
        Number(body.sort_order) || 0,
      ]
    );
    return sendOk(res, sendJson, "创建成功", rowToStation(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── PUT /api/stations/:id ────────────────────────────────────────────────────
export async function handleUpdateStation(req, res, url, sendJson, body) {
  try {
    const code = url.pathname.split("/").pop();
    const { rows: found } = await query("SELECT id FROM stations WHERE station_code=$1", [code]);
    if (found.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "站点不存在");

    // A系统字段程序级防重（排除当前站点自身）
    const aErr = await validateASystemFieldUniqueness(res, sendJson, {
      a_system_station_id: body.external_id !== undefined ? body.external_id : body.a_system_station_id,
      device_code:         body.device_code,
      a_system_device_id:  body.a_system_device_id,
    }, code);
    if (aErr !== null) return;

    // 动态构建 SET 子句
    const fieldMap = {
      status:             body.status,
      station_type:       body.station_type,
      country_code:       body.country_code,
      city_code:          body.city ?? body.city_code,
      district:           body.district,
      address:            body.address,
      venue_name:         body.venue_name,
      venue_type:         body.venue_type,
      latitude:           body.lat !== undefined ? Number(body.lat) : body.latitude !== undefined ? Number(body.latitude) : undefined,
      longitude:          body.lng !== undefined ? Number(body.lng) : body.longitude !== undefined ? Number(body.longitude) : undefined,
      capacity:           body.capacity !== undefined ? Number(body.capacity) : undefined,
      available_count:    body.available !== undefined ? Number(body.available) : body.available_count !== undefined ? Number(body.available_count) : undefined,
      source:             body.source,
      source_channel_id:  body.source_channel_id,
      entry_code:         body.entry_code,
      landing_code:       body.landing_code,
      default_activity_id: body.default_activity_id,
      a_system_station_id: body.external_id !== undefined ? body.external_id : body.a_system_station_id,
      device_code:        body.device_code,
      device_group_code:  body.device_group_code,
      a_system_device_id: body.a_system_device_id,
      sort_order:         body.sort_order !== undefined ? Number(body.sort_order) : undefined,
    };
    if (body.name || body.station_name) {
      const rawName = body.name || body.station_name;
      fieldMap.station_name = JSON.stringify(typeof rawName === "object" ? rawName : { zh: String(rawName), th: "", en: "" });
    }

    const sets   = [];
    const params = [];
    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        params.push(val);
        sets.push(`${col}=$${params.length}`);
      }
    }
    if (sets.length === 0) return sendError(res, sendJson, 400, "NO_FIELDS", "无可更新字段");
    params.push(code);
    const { rows } = await query(
      `UPDATE stations SET ${sets.join(", ")}, updated_at=NOW() WHERE station_code=$${params.length} RETURNING *`,
      params
    );
    return sendOk(res, sendJson, "更新成功", rowToStation(rows[0]));
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── DELETE /api/stations/:id ─────────────────────────────────────────────────
export async function handleDeleteStation(req, res, url, sendJson) {
  try {
    const code = url.pathname.split("/").pop();
    const { rows } = await query("DELETE FROM stations WHERE station_code=$1 RETURNING station_code", [code]);
    if (rows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "站点不存在");
    return sendOk(res, sendJson, "删除成功", { station_code: rows[0].station_code });
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}

// ─── GET /api/stations/:id/chain ─────────────────────────────────────────────
// 站点归因基础链查询：station → entry → landing → activity
export async function handleGetStationChain(req, res, url, sendJson) {
  try {
    const code = url.pathname.split("/")[3];
    const { rows: stRows } = await query("SELECT * FROM stations WHERE station_code=$1", [code]);
    if (stRows.length === 0) return sendError(res, sendJson, 404, "NOT_FOUND", "站点不存在");
    const station = rowToStation(stRows[0]);

    const chain = { station };

    if (station.entry_code) {
      const { rows: entRows } = await query(
        "SELECT entry_code, entry_qr_code, entry_type, landing_code, default_activity_code, device_code, a_system_device_id FROM entry_instances WHERE entry_code=$1",
        [station.entry_code]
      );
      chain.entry = entRows[0] || null;

      const targetLanding = chain.entry?.landing_code || station.landing_code;
      if (targetLanding) {
        const { rows: lpRows } = await query("SELECT landing_code, name, template_type, status FROM landing_pages WHERE landing_code=$1", [targetLanding]);
        chain.landing = lpRows[0] || null;
      }

      const targetActivity = chain.entry?.default_activity_code || station.default_activity_id;
      if (targetActivity) {
        const { rows: actRows } = await query("SELECT activity_id, activity_name, activity_type, status FROM activities WHERE activity_id=$1", [targetActivity]);
        chain.activity = actRows[0] || null;
      }
    }

    return sendOk(res, sendJson, "station chain loaded", chain);
  } catch (err) {
    return sendError(res, sendJson, 500, "DB_ERROR", err.message);
  }
}
