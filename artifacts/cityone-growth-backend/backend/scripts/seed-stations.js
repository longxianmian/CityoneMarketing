/**
 * Seed script: 将 stations.json 迁移到 PostgreSQL
 * 执行: node backend/scripts/seed-stations.js
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import("../src/db/pool.js").then(async ({ query }) => {
  const stationsFile = path.join(__dirname, "../data/stations.json");
  let jsonStations = [];
  try {
    jsonStations = require(stationsFile);
  } catch (e) {
    console.error("[seed] stations.json 读取失败:", e.message);
    process.exit(1);
  }

  console.log(`[stations] JSON 原始数量: ${jsonStations.length}`);

  // 去重：以 id 为唯一键（先见者胜）
  const seen = new Set();
  const deduped = [];
  for (const s of jsonStations) {
    if (!s.id || seen.has(s.id)) {
      console.log(`[stations] 跳过重复/无ID: ${s.id || "(无ID)"}`);
      continue;
    }
    seen.add(s.id);
    deduped.push(s);
  }
  console.log(`[stations] 去重后数量: ${deduped.length}`);

  // 映射 station_code 对照规则：
  // JSON.id  → station_code
  // JSON.name (jsonb) → station_name
  // JSON.city → city_code
  // JSON.lat/lng → latitude/longitude
  // JSON.available → available_count
  // JSON.external_id → a_system_station_id

  let inserted = 0;
  let skipped = 0;

  for (const s of deduped) {
    const stationName = typeof s.name === "object" && s.name !== null
      ? s.name
      : { zh: String(s.name || ""), th: "", en: "" };

    await query(
      `INSERT INTO stations (
        station_code, station_name, station_type, status,
        country_code, city_code, district, address,
        venue_name, venue_type,
        latitude, longitude,
        capacity, available_count,
        source, a_system_station_id,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        $9,$10,
        $11,$12,
        $13,$14,
        $15,$16,
        NOW(), NOW()
      )
      ON CONFLICT (station_code) DO UPDATE SET
        station_name      = EXCLUDED.station_name,
        status            = EXCLUDED.status,
        city_code         = EXCLUDED.city_code,
        district          = EXCLUDED.district,
        address           = EXCLUDED.address,
        latitude          = EXCLUDED.latitude,
        longitude         = EXCLUDED.longitude,
        capacity          = EXCLUDED.capacity,
        available_count   = EXCLUDED.available_count,
        source            = EXCLUDED.source,
        a_system_station_id = EXCLUDED.a_system_station_id,
        updated_at        = NOW()`,
      [
        s.id,
        JSON.stringify(stationName),
        "powerbank",
        s.status || "active",
        "TH",
        s.city || "",
        s.district || "",
        s.address || "",
        "",
        "",
        Number(s.lat) || 0,
        Number(s.lng) || 0,
        Number(s.capacity) || 0,
        Number(s.available) || 0,
        s.source || "manual",
        s.external_id || "",
      ]
    );
    console.log(`[stations] 写入: ${s.id} → ${stationName.zh || "(无名)"}`);
    inserted++;
  }

  const { rows: final } = await query("SELECT COUNT(*) AS cnt FROM stations");
  console.log(`\n=== 迁移结果 ===`);
  console.log(`JSON 原始: ${jsonStations.length} 条`);
  console.log(`去重后:    ${deduped.length} 条`);
  console.log(`成功写入:  ${inserted} 条`);
  console.log(`DB 总量:   ${final[0].cnt} 条`);

  // 数量对账
  if (String(final[0].cnt) === String(deduped.length)) {
    console.log(`✅ 对账通过：DB 数量与去重后 JSON 数量一致`);
  } else {
    console.warn(`⚠️  对账提示：DB 数量(${final[0].cnt}) ≠ 去重后 JSON(${deduped.length})，请检查`);
  }

  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
