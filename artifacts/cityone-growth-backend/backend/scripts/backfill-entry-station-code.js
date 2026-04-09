/**
 * backfill-entry-station-code.js
 *
 * site_id → station_code 过渡回填脚本
 *
 * 背景：
 *  - 历史数据 entry_instances.site_id 使用旧命名（site_001/site_002 等）
 *  - 新规范字段 station_code 使用 stations 表主键（st_001/st_002 等）
 *  - 两套命名体系不同，无法自动推断，需手动维护映射表后执行本脚本
 *
 * 使用方法：
 *  1. 编辑下方 SITE_ID_TO_STATION_CODE 映射表
 *  2. node backend/scripts/backfill-entry-station-code.js [--dry-run]
 *     --dry-run 仅打印将要执行的操作，不实际写库
 *
 * 执行环境：cityone-growth-backend 根目录
 */

const DRY_RUN = process.argv.includes("--dry-run");

// ─── 手动维护的 site_id → station_code 映射表 ─────────────────────────────
// 格式：{ "旧 site_id": "新 station_code" }
// 仅当你能确认两者对应关系时填入，否则保留为空（该行不会被回填）
const SITE_ID_TO_STATION_CODE = {
  // 示例（请根据实际业务填写）：
  // "site_001": "st_001",
  // "site_002": "st_002",
};

import("../src/db/pool.js").then(async ({ query }) => {
  console.log(`[backfill] mode: ${DRY_RUN ? "DRY-RUN（不写库）" : "LIVE"}`);

  const { rows: entries } = await query(
    "SELECT entry_code, site_id, station_code FROM entry_instances WHERE station_code = '' ORDER BY entry_code"
  );
  console.log(`[backfill] 待回填条目（station_code 为空）: ${entries.length} 条`);

  let updated = 0;
  let skipped = 0;

  for (const e of entries) {
    const mappedCode = SITE_ID_TO_STATION_CODE[e.site_id];
    if (!mappedCode) {
      console.log(`[skip]  ${e.entry_code} | site_id=${e.site_id} → 无映射，跳过`);
      skipped++;
      continue;
    }

    // 验证目标 station_code 在 stations 表中存在
    const { rows: stFound } = await query(
      "SELECT station_code FROM stations WHERE station_code=$1", [mappedCode]
    );
    if (stFound.length === 0) {
      console.warn(`[warn]  ${e.entry_code} | site_id=${e.site_id} → station_code="${mappedCode}" 不存在于 stations 表，跳过`);
      skipped++;
      continue;
    }

    console.log(`[write] ${e.entry_code} | site_id=${e.site_id} → station_code=${mappedCode}`);
    if (!DRY_RUN) {
      await query(
        "UPDATE entry_instances SET station_code=$1, updated_at=NOW() WHERE entry_code=$2",
        [mappedCode, e.entry_code]
      );
    }
    updated++;
  }

  console.log(`\n=== 回填结果 ===`);
  console.log(`待处理: ${entries.length} 条`);
  console.log(`已回填: ${updated} 条${DRY_RUN ? "（DRY-RUN 未实际写库）" : ""}`);
  console.log(`跳过:   ${skipped} 条（无映射或目标不存在）`);

  if (entries.length > 0 && Object.keys(SITE_ID_TO_STATION_CODE).length === 0) {
    console.log("\n📋 当前 site_id 分布（请根据下方信息填写映射表）:");
    const { rows: dist } = await query(
      "SELECT DISTINCT site_id, COUNT(*) as cnt FROM entry_instances WHERE station_code='' GROUP BY site_id ORDER BY site_id"
    );
    dist.forEach(d => console.log(`  site_id="${d.site_id}" → ${d.cnt} 条入口，需映射到对应 station_code`));
  }

  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
