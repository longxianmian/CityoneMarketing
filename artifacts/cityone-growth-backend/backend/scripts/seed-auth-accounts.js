/**
 * seed-auth-accounts.js
 * 第二批第1份：认证与账户体系数据迁移
 * 将 admins.json / member-config.json / role_templates.json 导入 PostgreSQL
 * 运行方式：node scripts/seed-auth-accounts.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { query } from "../src/db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data"); // artifacts/cityone-growth-backend/data/

function readJson(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) { console.warn(`  [WARN] file not found: ${fp}`); return null; }
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

// ── 1. 迁移 admins ────────────────────────────────────────────────────────────
async function seedAdmins() {
  const admins = readJson("admins.json");
  if (!admins || !Array.isArray(admins)) { console.log("  [SKIP] admins.json not found or empty"); return; }

  console.log(`\n[admins] 迁移前 JSON 数量: ${admins.length}`);

  // 按 id 正序插入（保证 id=1 先插入，created_by 引用时已存在）
  const sorted = [...admins].sort((a, b) => a.id - b.id);

  let inserted = 0;
  for (const a of sorted) {
    try {
      await query(`
        INSERT INTO admins (id, username, password_hash, display_name, role, permissions,
                            department, status, note, created_by, created_at, updated_at,
                            last_login_at, password_changed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          username            = EXCLUDED.username,
          password_hash       = EXCLUDED.password_hash,
          display_name        = EXCLUDED.display_name,
          role                = EXCLUDED.role,
          permissions         = EXCLUDED.permissions,
          department          = EXCLUDED.department,
          status              = EXCLUDED.status,
          note                = EXCLUDED.note,
          created_by          = EXCLUDED.created_by,
          updated_at          = EXCLUDED.updated_at,
          last_login_at       = EXCLUDED.last_login_at,
          password_changed_at = EXCLUDED.password_changed_at
      `, [
        a.id,
        a.username,
        a.password_hash,
        a.display_name || a.username,
        a.role,
        JSON.stringify(a.permissions || []),
        a.department || "",
        a.status || "active",
        a.note || "",
        a.created_by || null,
        a.created_at || new Date().toISOString(),
        a.updated_at || null,
        a.last_login_at || null,
        a.password_changed_at || null,
      ]);
      inserted++;
      console.log(`  ✓ admin id=${a.id} username=${a.username} role=${a.role}`);
    } catch (e) {
      console.error(`  ✗ admin id=${a.id} 失败: ${e.message}`);
    }
  }

  // 同步 SERIAL sequence，避免后续 INSERT 冲突
  const maxId = Math.max(...sorted.map((a) => a.id));
  await query(`SELECT setval('admins_id_seq', $1, true)`, [maxId]);

  const { rows } = await query("SELECT COUNT(*) FROM admins");
  console.log(`[admins] 迁移完成: JSON=${admins.length}, DB=${rows[0].count}, 写入=${inserted}`);
}

// ── 2. 迁移 member_config ─────────────────────────────────────────────────────
async function seedMemberConfig() {
  const config = readJson("member-config.json");
  if (!config) { console.log("\n[member_config] SKIP: 文件不存在"); return; }

  console.log("\n[member_config] 迁移中...");
  await query(`
    INSERT INTO member_config (id, charging_discount, deposit, extra_benefits, updated_at, updated_by)
    VALUES (1, $1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      charging_discount = EXCLUDED.charging_discount,
      deposit           = EXCLUDED.deposit,
      extra_benefits    = EXCLUDED.extra_benefits,
      updated_at        = EXCLUDED.updated_at,
      updated_by        = EXCLUDED.updated_by
  `, [
    JSON.stringify(config.charging_discount || {}),
    JSON.stringify(config.deposit || {}),
    JSON.stringify(config.extra_benefits || []),
    config.updated_at || new Date().toISOString(),
    config.updated_by || "",
  ]);
  console.log("[member_config] 迁移完成 ✓");
}

// ── 3. 迁移 role_templates ────────────────────────────────────────────────────
async function seedRoleTemplates() {
  const templates = readJson("role_templates.json");
  if (!templates || !Array.isArray(templates)) { console.log("\n[role_templates] SKIP: 文件不存在"); return; }

  console.log(`\n[role_templates] 迁移前 JSON 数量: ${templates.length}`);
  let inserted = 0;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    await query(`
      INSERT INTO role_templates (key, label, label_th, label_en, description,
                                  group_name, default_permissions, can_be_created_by, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (key) DO UPDATE SET
        label               = EXCLUDED.label,
        label_th            = EXCLUDED.label_th,
        label_en            = EXCLUDED.label_en,
        description         = EXCLUDED.description,
        group_name          = EXCLUDED.group_name,
        default_permissions = EXCLUDED.default_permissions,
        can_be_created_by   = EXCLUDED.can_be_created_by,
        sort_order          = EXCLUDED.sort_order
    `, [
      t.key, t.label, t.label_th || null, t.label_en || null,
      t.description || null, t.group || null,
      JSON.stringify(t.default_permissions || []),
      JSON.stringify(t.can_be_created_by || []),
      i,
    ]);
    inserted++;
    console.log(`  ✓ template key=${t.key}`);
  }
  const { rows } = await query("SELECT COUNT(*) FROM role_templates");
  console.log(`[role_templates] 完成: JSON=${templates.length}, DB=${rows[0].count}, 写入=${inserted}`);
}

// ── 主入口 ────────────────────────────────────────────────────────────────────
(async () => {
  console.log("=== 第二批第1份：认证与账户体系数据迁移开始 ===");
  try {
    await seedAdmins();
    await seedMemberConfig();
    await seedRoleTemplates();
    console.log("\n=== 全部迁移完成 ===\n");
  } catch (e) {
    console.error("迁移失败:", e);
    process.exit(1);
  }
  process.exit(0);
})();
