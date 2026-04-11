/**
 * translate.js
 *
 * POST /api/translate           — 翻译指定文本（前端调用，同步）
 * POST /api/admin/translate-batch — 批量补译数据库中空白的 th/en 翻译
 * POST /api/admin/translate-item  — 补译单条记录的多语言字段（异步后台调用）
 */

import { query } from "../db/pool.js";
import { chatCompletion } from "../services/agent-llm-service.js";

const SYSTEM_PROMPT = `你是具备双重专业背景的资深专家，负责将营销文案翻译成中文、泰文、英文三种语言。

【互联网市场推广专家】
- 10年互联网营销与市场推广实战经验
- 深度熟悉东南亚（尤其泰国）消费者心理与营销文案习惯
- 擅长将品牌利益点转化为打动用户的推广语言，文案简洁有力、具备行动号召力
- 了解充电站、共享出行、扫码领券等本地化服务场景的推广逻辑

【中泰英三语翻译专家】
- 10年以上中文、泰文、英文三语互译实战经验，长期在泰国从事本地化翻译
- 精通泰语口语与书面语的语境差异，翻译符合现代泰国商业用语规范，避免生硬直译
- 英语翻译面向东南亚英语受众，简洁友好，避免过于正式的欧美腔
- 翻译原则：信达雅

【硬约束规则】
- CityOne、LINE OA、LINE Official Account → 保持原样，不翻译
- 数字、URL、百分比、代码变量 → 保持原样
- 营销文案须保留原文的情感温度和号召力，禁止逐字机翻
- 译文可直接上线使用，无需人工二次修改

【输出格式】
严格输出 JSON 对象（不含 markdown 代码块），格式如下：
{
  "result": {
    "<fieldKey>": { "zh": "...", "th": "...", "en": "..." },
    ...
  }
}`;

/**
 * 调用 LLM 翻译一批文本，返回 result 对象
 */
async function translateTexts(texts, sourceLang = "zh") {
  const langLabel = { zh: "中文", th: "泰文", en: "英文" }[sourceLang] || "中文";
  const textEntries = Object.entries(texts)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
    .join(",\n  ");
  if (!textEntries) return {};

  const userPrompt = `以下是需要翻译的${langLabel}文本（JSON 格式，key 为字段名，value 为原文）：\n\n{\n  ${textEntries}\n}\n\n请将每个字段翻译成中文(zh)、泰文(th)、英文(en)三种语言，严格按照 result 格式输出 JSON。`;

  const raw = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 2048, jsonMode: true }
  );
  const parsed = JSON.parse(raw);
  return parsed.result || {};
}

/**
 * 判断多语言字段是否缺少 th 或 en 翻译
 */
function needsTranslation(field) {
  if (!field) return false;
  const v = typeof field === "string" ? (() => { try { return JSON.parse(field); } catch { return null; } })() : field;
  if (!v || typeof v !== "object") return !!field;
  return !v.th?.trim() || !v.en?.trim();
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

    const types = type === "all"
      ? ["coupon", "activity", "mall_item"]
      : [type];

    const summary = {};
    for (const t of types) {
      summary[t] = await translateAllMissing(t);
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
  const texts = {};

  for (const field of cfg.mlFields) {
    const raw = row[field];
    if (!raw) continue;
    const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return { zh: raw, th: "", en: "" }; } })() : raw;
    const sourceLang = v.zh?.trim() ? "zh" : v.th?.trim() ? "th" : v.en?.trim() ? "en" : null;
    if (!sourceLang) continue;
    if (!v.th?.trim() || !v.en?.trim()) {
      texts[field] = v[sourceLang];
    }
  }

  if (Object.keys(texts).length === 0) return false;

  const sourceLang = row[cfg.mlFields[0]] && (() => {
    const v = typeof row[cfg.mlFields[0]] === "string"
      ? (() => { try { return JSON.parse(row[cfg.mlFields[0]]); } catch { return null; } })()
      : row[cfg.mlFields[0]];
    return v?.zh?.trim() ? "zh" : v?.th?.trim() ? "th" : "zh";
  })();

  const result = await translateTexts(texts, sourceLang || "zh");

  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const field of cfg.mlFields) {
    if (result[field]) {
      setClauses.push(`${field} = $${idx}`);
      params.push(toJsonb(result[field]));
      idx++;
    }
  }

  if (setClauses.length === 0) return false;

  params.push(id);
  await query(
    `UPDATE ${cfg.table} SET ${setClauses.join(", ")}, updated_at = NOW() WHERE ${cfg.idCol} = $${idx}`,
    params
  );
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
    mlFields: ["name", "highlights", "rules"],
  },
};
