/**
 * translate.js
 *
 * POST /api/translate           — 翻译指定文本（前端调用，同步）
 * POST /api/admin/translate-batch — 批量补译数据库中空白的 th/en 翻译
 * POST /api/admin/translate-item  — 补译单条记录的多语言字段（异步后台调用）
 */

import { query } from "../db/pool.js";
import {
  completeMlFieldMap,
  needsMlTranslation,
  normalizeMlValue,
  syncMlSnapshotToOss,
  translateTexts,
} from "../services/multilingual-service.js";
import { translateAllDigitalProducts } from "./products.js";

/**
 * 判断多语言字段是否缺少 th 或 en 翻译
 */
function needsTranslation(field) {
  return needsMlTranslation(field);
}

/**
 * 安全地把值序列化为 JSONB
 */
function toJsonb(v) {
  if (v == null) return null;
  return JSON.stringify(v);
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/translate  — 前端调用，同步翻译
// ─────────────────────────────────────────────────────────────────────────────
export async function handleTranslate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { texts, sourceLang = "zh" } = body;

    if (!texts || typeof texts !== "object" || Object.keys(texts).length === 0) {
      return sendJson(res, 400, { msg: "texts 参数不能为空" });
    }

    const result = await translateTexts(texts, sourceLang);
    return sendJson(res, 200, { code: 200, msg: "ok", data: { result } });
  } catch (err) {
    return sendJson(res, 500, { code: 500, msg: err?.message || "翻译服务异常" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/admin/translate-item  — 补译单条记录（存储后台异步调用）
//  请求体：{ type: 'coupon'|'activity'|'mall_item', id: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function handleTranslateItem(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { type, id } = body;
    if (!type || !id) return sendJson(res, 400, { msg: "type 和 id 必填" });

    const updated = await translateOneItem(type, id);
    return sendJson(res, 200, { code: 200, msg: "ok", data: { updated } });
  } catch (err) {
    return sendJson(res, 500, { code: 500, msg: err?.message || "补译失败" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/admin/translate-batch  — 批量补译所有缺翻译的记录
//  请求体：{ type: 'coupon'|'activity'|'mall_item'|'all' }
// ─────────────────────────────────────────────────────────────────────────────
export async function handleTranslateBatch(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { type = "all" } = body;

    const pgTypes = ["coupon", "activity", "mall_item"];
    const types = type === "all"
      ? [...pgTypes, "digital_product"]
      : [type];

    const summary = {};
    for (const t of types) {
      if (t === "digital_product") {
        summary[t] = await translateAllDigitalProducts();
      } else {
        summary[t] = await translateAllMissing(t);
      }
    }

    return sendJson(res, 200, { code: 200, msg: "ok", data: summary });
  } catch (err) {
    return sendJson(res, 500, { code: 500, msg: err?.message || "批量翻译失败" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  内部：翻译单条记录
// ─────────────────────────────────────────────────────────────────────────────
async function translateOneItem(type, id) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg) throw new Error(`未知类型: ${type}`);

  const res = await query(`SELECT * FROM ${cfg.table} WHERE ${cfg.idCol} = $1`, [id]);
  if (!res.rows.length) return false;

  const row = res.rows[0];
  const sourceFields = cfg.mlFields.reduce((acc, field) => {
    acc[field] = row[field];
    return acc;
  }, {});
  const completed = await completeMlFieldMap(sourceFields, "zh");

  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const field of cfg.mlFields) {
    if (completed[field]) {
      setClauses.push(`${field} = $${idx}`);
      params.push(toJsonb(normalizeMlValue(completed[field])));
      idx++;
    }
  }

  if (setClauses.length === 0) return false;

  params.push(id);
  await query(
    `UPDATE ${cfg.table} SET ${setClauses.join(", ")}, updated_at = NOW() WHERE ${cfg.idCol} = $${idx}`,
    params
  );
  await syncMlSnapshotToOss(type, id, completed).catch(() => null);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
//  内部：批量翻译某类型所有缺失记录
// ─────────────────────────────────────────────────────────────────────────────
async function translateAllMissing(type) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg) return { skipped: true };

  const res = await query(`SELECT ${cfg.idCol}, ${cfg.mlFields.join(", ")} FROM ${cfg.table}`);
  const rows = res.rows;

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const hasEmpty = cfg.mlFields.some(f => needsTranslation(row[f]));
    if (!hasEmpty) { skipped++; continue; }
    try {
      const updated = await translateOneItem(type, row[cfg.idCol]);
      if (updated) done++;
      else skipped++;
    } catch {
      failed++;
    }
  }

  return { total: rows.length, done, skipped, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
//  类型配置表
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  coupon: {
    table: "coupons",
    idCol: "id",
    mlFields: ["name"],
  },
  activity: {
    table: "activities",
    idCol: "activity_id",
    mlFields: ["activity_name", "activity_subtitle", "activity_desc", "highlights", "participation_guide", "reward_guide", "notice_text"],
  },
  mall_item: {
    table: "mall_items",
    idCol: "id",
    mlFields: ["name", "description", "detail_title", "highlights", "rules"],
  },
};
