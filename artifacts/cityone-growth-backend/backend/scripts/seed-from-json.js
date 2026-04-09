/**
 * 数据迁移种子脚本
 * 将 data/*.json 历史数据导入 PostgreSQL（幂等，ON CONFLICT DO NOTHING）
 * 
 * 用法: node scripts/seed-from-json.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testConnection } from "../src/db/pool.js";
import { query } from "../src/db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = path.join(__dirname, "..", "data");

function loadJson(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`[seed] Failed to parse ${name}:`, e.message);
    return [];
  }
}

function toJsonb(v) {
  if (v == null) return null;
  return JSON.stringify(v); // 对象序列化为 JSON，字符串加引号，确保 JSONB 列始终收到合法 JSON
}

function safeBool(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedCoupons() {
  const rows = loadJson("coupons.json");
  let inserted = 0;
  for (const r of rows) {
    try {
      await query(`
        INSERT INTO coupons
          (id, name, coupon_type, discount_type, discount_value, min_amount, total_count,
           claimed_count, status, valid_from, valid_to, cover_image, cover_video, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        toJsonb(r.name),
        r.coupon_type    || "general",
        r.discount_type  || null,
        r.discount_value != null ? Number(r.discount_value) : 0,
        r.min_amount     != null ? Number(r.min_amount)     : 0,
        r.total_count    != null ? Number(r.total_count)    : 0,
        r.claimed_count  != null ? Number(r.claimed_count)  : 0,
        r.status         != null ? Number(r.status)         : 1,
        r.valid_from     || null,
        r.valid_to       || null,
        r.cover_image    || "",
        r.cover_video    || "",
        r.created_at     || new Date().toISOString(),
        r.updated_at     || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[coupons] skip ${r.id}:`, e.message); }
  }
  console.log(`[coupons] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedUserCoupons() {
  // user-products.json 中 source_type=coupon_claim 的记录迁移到 user_coupons
  const rows = loadJson("user-products.json").filter(r => r.source_type === "coupon_claim");
  let inserted = 0;
  for (const r of rows) {
    const id = r.user_product_id || r.id;
    if (!id) continue;
    try {
      await query(`
        INSERT INTO user_coupons
          (id, user_id, line_user_id, coupon_id, product_status, source_type, source_id,
           claimed_at, used_at, expired_at, station_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        r.user_id        || r.line_user_id || null,
        r.line_user_id   || null,
        r.source_id      || r.product_id   || null,
        r.product_status || "claimed",
        r.source_type,
        r.source_id      || null,
        r.claimed_at     || r.created_at || null,
        r.used_at        || null,
        r.expired_at     || null,
        r.station_id     || null,
        r.created_at     || new Date().toISOString(),
        r.updated_at     || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[user_coupons] skip ${id}:`, e.message); }
  }
  console.log(`[user_coupons] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedMallItems() {
  const rows = loadJson("mall-items.json");
  let inserted = 0;
  let idx = 0;
  for (const r of rows) {
    if (!r.id) { idx++; continue; } // skip items without ID
    try {
      await query(`
        INSERT INTO mall_items
          (id, name, item_type, exchange_mode, price_thb, points_required, stock,
           on_shelf, cover_image, cover_video, description, detail_title, highlights,
           rules, tag, badge, sort_order, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        toJsonb(r.name) || "",
        r.item_type        || "digital",
        r.exchange_mode    || "points",
        r.price_thb        != null ? Number(r.price_thb)       : null,
        r.points_required  != null ? Number(r.points_required) : 0,
        r.stock            != null ? Number(r.stock)           : -1,
        safeBool(r.on_shelf),
        r.cover_image  || "",
        r.cover_video  || "",
        toJsonb(r.description),
        toJsonb(r.detail_title || r.detailTitle),
        toJsonb(r.highlights),
        toJsonb(r.rules),
        r.tag   || null,
        r.badge || null,
        r.sort_order != null ? Number(r.sort_order) : idx,
        r.created_at || new Date().toISOString(),
        r.updated_at || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[mall_items] skip ${r.id}:`, e.message); }
    idx++;
  }
  console.log(`[mall_items] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedPointsAccounts() {
  const rows = loadJson("points-accounts.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.user_id) continue;
    try {
      await query(`
        INSERT INTO points_accounts
          (user_id, line_user_id, total_points, available_points, pending_points,
           consumed_points, revoked_points, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (user_id) DO NOTHING
      `, [
        r.user_id,
        r.line_user_id   || r.user_id,
        r.total_points     != null ? Number(r.total_points)     : 0,
        r.available_points != null ? Number(r.available_points) : 0,
        r.pending_points   != null ? Number(r.pending_points)   : 0,
        r.consumed_points  != null ? Number(r.consumed_points)  : 0,
        r.revoked_points   != null ? Number(r.revoked_points)   : 0,
        r.updated_at       || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[points_accounts] skip ${r.user_id}:`, e.message); }
  }
  console.log(`[points_accounts] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedPointsLedger() {
  const rows = loadJson("points-ledger.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.id) continue;
    try {
      await query(`
        INSERT INTO points_ledger
          (id, user_id, line_user_id, type, points, ref_type, ref_id, reason, operator_id, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        r.user_id        || null,
        r.line_user_id   || null,
        r.type           || "credit",
        r.points         != null ? Number(r.points) : 0,
        r.ref_type       || null,
        r.ref_id         || null,
        r.reason         || null,
        r.operator_id    || null,
        r.created_at     || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[points_ledger] skip ${r.id}:`, e.message); }
  }
  console.log(`[points_ledger] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedMallRedeems() {
  const rows = loadJson("mall-redeems.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.id) continue;
    try {
      await query(`
        INSERT INTO mall_redeems
          (id, user_id, line_user_id, item_id, item_name, points_spent, status, ledger_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        r.user_id        || null,
        r.user_id        || null,
        r.item_id        || "",
        toJsonb(r.item_name),
        r.points_spent   != null ? Number(r.points_spent) : 0,
        r.status         || "success",
        r.ledger_id      || null,
        r.created_at     || new Date().toISOString(),
        r.updated_at     || r.created_at || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[mall_redeems] skip ${r.id}:`, e.message); }
  }
  console.log(`[mall_redeems] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedShareRelations() {
  const rows = loadJson("share-relations.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.id) continue;
    try {
      await query(`
        INSERT INTO share_relations
          (id, sharer_user_id, sharer_line_user_id, invitee_line_user_id,
           share_content_type, share_content_id, campaign_id,
           follow_status, points_status, points_value, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        r.sharer_user_id       || null,
        r.sharer_line_user_id  || null,
        r.invitee_line_user_id || null,
        r.share_content_type   || null,
        r.share_content_id     || null,
        r.campaign_id          || null,
        r.follow_status        || "pending",
        r.points_status        || "pending",
        r.points_value         != null ? Number(r.points_value) : 0,
        r.created_at           || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[share_relations] skip ${r.id}:`, e.message); }
  }
  console.log(`[share_relations] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedConsumeRelations() {
  const rows = loadJson("consume-relations.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.id) continue;
    try {
      await query(`
        INSERT INTO consume_relations
          (id, user_id, line_user_id, order_id, paid_amount, pointable_amount,
           credited_points, revoked_points, points_status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        r.user_id         || null,
        r.line_user_id    || null,
        r.order_id        || null,
        r.paid_amount     != null ? Number(r.paid_amount)     : null,
        r.pointable_amount != null ? Number(r.pointable_amount) : null,
        r.credited_points != null ? Number(r.credited_points) : 0,
        r.revoked_points  != null ? Number(r.revoked_points)  : 0,
        r.points_status   || "pending",
        r.created_at      || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[consume_relations] skip ${r.id}:`, e.message); }
  }
  console.log(`[consume_relations] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedPointsRules() {
  const rows = loadJson("points-rules.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.rule_id) continue;
    try {
      await query(`
        INSERT INTO points_rules
          (rule_id, rule_type, description, points_value, revoke_on_unfollow, revoke_window_days, enabled, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
        ON CONFLICT (rule_id) DO NOTHING
      `, [
        r.rule_id,
        r.rule_type              || "other",
        r.description            || null,
        r.points_value           != null ? Number(r.points_value) : 0,
        safeBool(r.revoke_on_unfollow),
        r.revoke_window_days     != null ? Number(r.revoke_window_days) : 0,
        r.enabled !== false,
      ]);
      inserted++;
    } catch (e) { console.warn(`[points_rules] skip ${r.rule_id}:`, e.message); }
  }
  console.log(`[points_rules] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function seedMediaAssets() {
  const rows = loadJson("media-assets.json");
  let inserted = 0;
  for (const r of rows) {
    if (!r.id) continue;
    try {
      await query(`
        INSERT INTO media_assets
          (id, bucket, object_key, url, mime_type, size_bytes, storage, status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id,
        r.bucket     || null,
        r.object_key || "",
        r.url        || null,
        r.mime_type  || null,
        r.size_bytes != null ? Number(r.size_bytes) : null,
        r.storage    || "oss",
        r.status     || "active",
        r.created_at || new Date().toISOString(),
      ]);
      inserted++;
    } catch (e) { console.warn(`[media_assets] skip ${r.id}:`, e.message); }
  }
  console.log(`[media_assets] ${inserted}/${rows.length} rows imported`);
}

// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== CityOne JSON → PostgreSQL 数据迁移 ===");
  try {
    const dbInfo = await testConnection();
    console.log(`[DB] Connected: ${dbInfo.db}\n`);
  } catch (err) {
    console.error("[DB] Cannot connect:", err.message);
    process.exit(1);
  }

  await seedCoupons();
  await seedUserCoupons();
  await seedMallItems();
  await seedPointsAccounts();
  await seedPointsLedger();
  await seedMallRedeems();
  await seedShareRelations();
  await seedConsumeRelations();
  await seedPointsRules();
  await seedMediaAssets();

  console.log("\n=== 数据迁移完成 ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
