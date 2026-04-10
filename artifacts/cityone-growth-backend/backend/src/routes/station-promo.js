/**
 * 站点推广码管理（桌贴 / 海报 / 店员）
 * 复用 entry_instances 表，entry_type 为：
 *   table_sticker  — 桌贴码
 *   poster_qr      — 海报 / 易拉宝码
 *   staff_qr       — 店员个人推广码
 *
 * 设备码（device_qr / cabinet_qr）由 A 系统管理，只读展示。
 */
import crypto from "node:crypto";
import { query } from "../db/pool.js";

const PROMO_TYPES = ["table_sticker", "poster_qr", "staff_qr"];
const ALL_TYPES   = [...PROMO_TYPES, "device_qr", "cabinet_qr", "site_qr"];

function ok(res, sendJson, data)  { sendJson(res, 200, { code: 200, data }); }
function err(res, sendJson, s, m) { sendJson(res, s,   { code: s,   msg: m }); }

/** 生成唯一 entry_code */
function genCode() {
  return "ec_" + crypto.randomBytes(5).toString("hex");
}

/* ── 1. 推广码列表（按站点） ───────────────────────────────────────────────── */
// GET /api/growth/station-promo/list?station_code=XXX
export async function handlePromoList(req, res, url, sendJson) {
  const stationCode = url.searchParams.get("station_code") || "";
  if (!stationCode) return err(res, sendJson, 400, "缺少 station_code");

  const { rows } = await query(
    `SELECT id, entry_code, station_code, site_id, site_name,
            entry_type, staff_name, staff_no,
            scan_count, status, created_at, updated_at
     FROM entry_instances
     WHERE station_code = $1
       AND entry_type = ANY($2::text[])
     ORDER BY entry_type, id ASC`,
    [stationCode, ALL_TYPES]
  );
  return ok(res, sendJson, rows);
}

/* ── 2. 站点流量统计 ───────────────────────────────────────────────────────── */
// GET /api/growth/station-promo/stats?station_code=XXX
export async function handlePromoStats(req, res, url, sendJson) {
  const stationCode = url.searchParams.get("station_code") || "";
  if (!stationCode) return err(res, sendJson, 400, "缺少 station_code");

  // 取该站点的所有入口码
  const { rows: entries } = await query(
    `SELECT entry_code, entry_type, staff_name, staff_no
     FROM entry_instances
     WHERE station_code = $1 AND entry_type = ANY($2::text[])`,
    [stationCode, ALL_TYPES]
  );
  if (!entries.length) return ok(res, sendJson, { by_type: {}, by_staff: [] });

  const codes = entries.map(e => e.entry_code);

  // 归因统计：从所有转化事件表汇总去重用户数
  const { rows: stats } = await query(
    `WITH events AS (
       SELECT source_entry_id AS ec, user_id FROM user_coupons
         WHERE source_entry_id = ANY($1::text[])
       UNION ALL
       SELECT source_entry_id AS ec, user_id FROM mall_redeems
         WHERE source_entry_id = ANY($1::text[])
       UNION ALL
       SELECT source_entry_id AS ec, user_id FROM activity_participants
         WHERE source_entry_id = ANY($1::text[])
     )
     SELECT ec,
            COUNT(*)                  AS total_events,
            COUNT(DISTINCT user_id)   AS unique_users
     FROM events
     GROUP BY ec`,
    [codes]
  );

  // 汇总成 map
  const statsMap = {};
  for (const r of stats) statsMap[r.ec] = r;

  // 按 entry_type 汇总
  const byType = {};
  const byStaff = [];
  for (const e of entries) {
    const s = statsMap[e.entry_code] || { total_events: 0, unique_users: 0 };
    if (!byType[e.entry_type]) byType[e.entry_type] = { total_events: 0, unique_users: 0 };
    byType[e.entry_type].total_events += Number(s.total_events);
    byType[e.entry_type].unique_users += Number(s.unique_users);

    if (e.entry_type === "staff_qr") {
      byStaff.push({
        entry_code: e.entry_code,
        staff_name: e.staff_name,
        staff_no:   e.staff_no,
        total_events: Number(s.total_events),
        unique_users: Number(s.unique_users),
      });
    }
  }
  byStaff.sort((a, b) => b.unique_users - a.unique_users);

  return ok(res, sendJson, { by_type: byType, by_staff: byStaff });
}

/* ── 3. 创建推广码 ─────────────────────────────────────────────────────────── */
// POST /api/growth/station-promo/create
export async function handlePromoCreate(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return err(res, sendJson, 400, "请求体解析失败"); }

  const { station_code, site_id = "", site_name = "", entry_type,
          staff_name = "", staff_no = "" } = body;

  if (!station_code) return err(res, sendJson, 400, "缺少 station_code");
  if (!PROMO_TYPES.includes(entry_type))
    return err(res, sendJson, 400, `entry_type 须为 ${PROMO_TYPES.join(" / ")}`);

  // 海报码每站点限 1 张
  if (entry_type === "poster_qr") {
    const { rows } = await query(
      "SELECT id FROM entry_instances WHERE station_code=$1 AND entry_type='poster_qr' LIMIT 1",
      [station_code]
    );
    if (rows.length) return err(res, sendJson, 400, "该站点已有海报码，每站点限 1 张");
  }

  const entry_code = genCode();
  const { rows } = await query(
    `INSERT INTO entry_instances
       (entry_code, station_code, site_id, site_name, entry_type,
        staff_name, staff_no, status, sort_order,
        entry_qr_code, current_feature_name, landing_code,
        default_activity_code, qr_code_value, external_url,
        device_code, a_system_device_id, source_channel_id,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'enabled',0,
             '','','','','','','','','',NOW(),NOW())
     RETURNING *`,
    [entry_code, station_code, site_id, site_name, entry_type,
     staff_name, staff_no]
  );
  return ok(res, sendJson, rows[0]);
}

/* ── 4. 更新推广码（仅店员信息） ──────────────────────────────────────────── */
// POST /api/growth/station-promo/update
export async function handlePromoUpdate(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return err(res, sendJson, 400, "请求体解析失败"); }

  const { entry_code, staff_name, staff_no } = body;
  if (!entry_code) return err(res, sendJson, 400, "缺少 entry_code");

  const { rows } = await query(
    `UPDATE entry_instances
     SET staff_name=$2, staff_no=$3, updated_at=NOW()
     WHERE entry_code=$1 RETURNING *`,
    [entry_code, staff_name || "", staff_no || ""]
  );
  if (!rows.length) return err(res, sendJson, 404, "推广码不存在");
  return ok(res, sendJson, rows[0]);
}

/* ── 5. 删除推广码 ─────────────────────────────────────────────────────────── */
// POST /api/growth/station-promo/delete
export async function handlePromoDelete(req, res, url, sendJson, readBody) {
  let body;
  try { body = await readBody(req); } catch { return err(res, sendJson, 400, "请求体解析失败"); }
  const { entry_code } = body;
  if (!entry_code) return err(res, sendJson, 400, "缺少 entry_code");

  const { rows } = await query(
    "DELETE FROM entry_instances WHERE entry_code=$1 AND entry_type=ANY($2::text[]) RETURNING id",
    [entry_code, PROMO_TYPES]
  );
  if (!rows.length) return err(res, sendJson, 404, "未找到或非推广码（设备码不可删）");
  return ok(res, sendJson, { deleted: true });
}
