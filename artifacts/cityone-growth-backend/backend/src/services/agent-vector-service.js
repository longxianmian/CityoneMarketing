/**
 * agent-vector-service.js
 *
 * 语义召回向量服务：
 *   - 意图向量化（embedding）
 *   - pgvector 相似度检索
 *   - 意图种子数据写入
 *   - 管理端：重新 embedding / 召回测试
 */

import { query } from "../db/pool.js";
import { createEmbedding, recognizeIntentWithLLM } from "./agent-llm-service.js";
import { loadAgentIntents } from "./agent-config-service.js";

/* ─── 全局阈值 ──────────────────────────────────────────────────────────────── */
const GLOBAL_SIMILARITY_THRESHOLD = 0.62; // 低于此值判定为 out_of_scope

/* ─── 向量库是否可用（启动时检测一次）────────────────────────────────────────── */
let _vectorReady = null; // null=未检测 true=可用 false=不可用

async function isVectorReady() {
  if (_vectorReady !== null) return _vectorReady;
  try {
    const res = await query(
      "SELECT COUNT(*) AS cnt FROM wenwen_intent_labels WHERE embedding IS NOT NULL"
    );
    _vectorReady = parseInt(res.rows[0].cnt, 10) > 0;
  } catch {
    _vectorReady = false;
  }
  return _vectorReady;
}

/** 重置可用性缓存（种子完成后调用） */
export function resetVectorReadyCache() {
  _vectorReady = null;
}

/* ─── LLM 意图分类降级（embedding 不可用时）──────────────────────────────── */

/** 从 agent-intents.json 构建意图索引（运行时缓存） */
let _intentIndex = null;
function getIntentIndex() {
  if (!_intentIndex) {
    _intentIndex = loadAgentIntents()
      .filter((i) => i.enabled !== false)
      .reduce((acc, i) => { acc[i.intent_code] = i; return acc; }, {});
  }
  return _intentIndex;
}

/**
 * LLM 分类意图（当 pgvector embedding 不可用时作为降级）
 * 复用 agent-llm-service.js 的 recognizeIntentWithLLM（已有的稳定实现）
 * 将结果映射为 searchIntent 统一接口
 *
 * @param {string} userText
 * @param {string} [language="zh"]
 * @returns {{ ready: boolean, results: Array, topIntent: object|null }}
 */
async function classifyIntentByLLM(userText, language = "zh") {
  const intentIndex = getIntentIndex();
  const allowedCodes = Object.keys(intentIndex);

  try {
    const recognized = await recognizeIntentWithLLM(userText, language, allowedCodes, {});
    const code = recognized?.intent_code || "";
    console.log(`[vector] LLM 分类结果: code="${code}" confidence=${recognized?.confidence}`);

    // 意图未知或超范围
    if (!code || code === "intent_unknown" || code === "out_of_scope" || !intentIndex[code]) {
      console.log(`[vector] LLM 判断 out_of_scope, code="${code}"`);
      return { ready: true, results: [], topIntent: null };
    }

    const matched = intentIndex[code];
    const intentRow = {
      intent_code:          matched.intent_code,
      intent_name:          matched.intent_name,
      dispatch_mode:        matched.dispatch_mode || "tool_then_card",
      tool_name:            matched.tool_name || null,
      card_template_key:    matched.card_template_key || null,
      oss_content_key:      null,
      intent_scope:         matched.intent_scope || "in_scope",
      requires_confirmation: !!matched.requires_confirmation,
      requires_payment:     !!matched.requires_payment,
      similarity_threshold: matched.similarity_threshold || 0.68,
      priority:             matched.priority || 10,
      similarity:           parseFloat(recognized.confidence || 0.85),
    };
    console.log(`[vector] 命中意图: ${intentRow.intent_code} (dispatch=${intentRow.dispatch_mode})`);
    return { ready: true, results: [intentRow], topIntent: intentRow };
  } catch (err) {
    console.error("[vector] LLM 分类失败:", err.message);
    return { ready: false, results: [], topIntent: null };
  }
}

/* ─── 意图检索（主入口）────────────────────────────────────────────────────── */
/**
 * 根据用户输入检索最相近意图
 * 策略：pgvector embedding → LLM 分类降级 → 全部失败时返回 ready:false
 *
 * @param {string} userText - 用户输入
 * @param {number} topK - 返回前 K 条（pgvector 模式有效，默认 3）
 * @param {string} [language="zh"] - 用户语言（LLM 分类模式有效）
 * @returns {{ ready: boolean, results: Array, topIntent: object|null }}
 */
export async function searchIntent(userText, topK = 3, language = "zh") {
  /* ── 路径 1：pgvector 向量召回（embedding 可用时）──────────────────────── */
  if (await isVectorReady()) {
    let embedding;
    try {
      embedding = await createEmbedding(userText);
    } catch (err) {
      console.warn("[vector] embedding API 不可用，降级到 LLM 分类:", err.message);
    }

    if (embedding) {
      try {
        const vectorStr = `[${embedding.join(",")}]`;
        const res = await query(
          `SELECT
             intent_code, intent_name, dispatch_mode, tool_name,
             card_template_key, oss_content_key, intent_scope,
             requires_confirmation, requires_payment,
             similarity_threshold, priority,
             1 - (embedding <=> $1::vector) AS similarity
           FROM wenwen_intent_labels
           WHERE is_enabled = TRUE AND embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT $2`,
          [vectorStr, topK]
        );

        const results = res.rows.map((r) => ({
          ...r,
          similarity: parseFloat(r.similarity),
        }));

        const topIntent =
          results.length > 0 &&
          results[0].similarity >= Math.max(GLOBAL_SIMILARITY_THRESHOLD, results[0].similarity_threshold || 0)
            ? results[0]
            : null;

        return { ready: true, results, topIntent };
      } catch (err) {
        console.error("[vector] pgvector 检索失败，降级到 LLM 分类:", err.message);
      }
    }
  }

  /* ── 路径 2：LLM 分类（embedding 不可用或 pgvector 查询失败时）─────────── */
  console.log("[vector] 使用 LLM 分类意图");
  return classifyIntentByLLM(userText, language);
}

/* ─── 意图种子写入 ──────────────────────────────────────────────────────────── */
/**
 * 为单条意图生成 canonical embedding 文本
 * 格式：意图名 + 各语言短语拼接
 */
function buildCanonicalText(intent) {
  const zh = (intent.phrases?.zh || []).join("，");
  const th = (intent.phrases?.th || []).join(" ");
  const en = (intent.phrases?.en || []).join(", ");
  return [
    `意图：${intent.intent_name}`,
    zh ? `中文：${zh}` : "",
    th ? `泰文：${th}` : "",
    en ? `英文：${en}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 把单条意图 upsert 到 wenwen_intent_labels，并生成 embedding
 * @param {object} intent - agent-intents.json 中的一条记录
 * @returns {{ intent_code, embedded: boolean, error?: string }}
 */
export async function upsertIntentWithEmbedding(intent) {
  const canonicalText = buildCanonicalText(intent);
  let embedding = null;
  let embeddingError = null;

  try {
    embedding = await createEmbedding(canonicalText);
  } catch (err) {
    embeddingError = err.message;
    console.warn(`[vector] 意图 ${intent.intent_code} embedding 失败:`, err.message);
  }

  const vectorStr = embedding ? `[${embedding.join(",")}]` : null;

  await query(
    `INSERT INTO wenwen_intent_labels
       (intent_code, intent_name, label_texts, embedding,
        tool_name, card_template_key, dispatch_mode,
        intent_scope, requires_confirmation, requires_payment,
        similarity_threshold, is_enabled, updated_at)
     VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (intent_code) DO UPDATE SET
       intent_name          = EXCLUDED.intent_name,
       label_texts          = EXCLUDED.label_texts,
       embedding            = COALESCE(EXCLUDED.embedding, wenwen_intent_labels.embedding),
       tool_name            = EXCLUDED.tool_name,
       card_template_key    = EXCLUDED.card_template_key,
       dispatch_mode        = EXCLUDED.dispatch_mode,
       intent_scope         = EXCLUDED.intent_scope,
       requires_confirmation= EXCLUDED.requires_confirmation,
       requires_payment     = EXCLUDED.requires_payment,
       similarity_threshold = EXCLUDED.similarity_threshold,
       is_enabled           = EXCLUDED.is_enabled,
       updated_at           = NOW()`,
    [
      intent.intent_code,
      intent.intent_name,
      JSON.stringify(intent.phrases || {}),
      vectorStr,
      intent.tool_name || null,
      intent.card_template_key || null,
      intent.dispatch_mode || "tool_then_card",
      intent.intent_scope || "in_scope",
      !!intent.requires_confirmation,
      !!intent.requires_payment,
      intent.similarity_threshold ?? 0.68,
      intent.enabled !== false,
    ]
  );

  return {
    intent_code: intent.intent_code,
    embedded: !!embedding,
    error: embeddingError,
  };
}

/**
 * 批量种子：把 agent-intents.json 全部意图 upsert 到 pgvector
 * 顺序执行（避免并发 rate limit）
 * @returns {{ seeded: number, embedded: number, errors: string[] }}
 */
export async function seedAllIntents() {
  const intents = loadAgentIntents();
  let seeded = 0;
  let embedded = 0;
  const errors = [];

  for (const intent of intents) {
    try {
      const result = await upsertIntentWithEmbedding(intent);
      seeded++;
      if (result.embedded) embedded++;
      else if (result.error) errors.push(`${intent.intent_code}: ${result.error}`);
    } catch (err) {
      errors.push(`${intent.intent_code}: ${err.message}`);
    }
  }

  resetVectorReadyCache();
  return { seeded, embedded, errors };
}

/**
 * 重新 embedding 单条意图（管理端"重新生成"按钮）
 */
export async function reEmbedIntent(intentCode) {
  const intents = loadAgentIntents();
  const intent = intents.find((i) => i.intent_code === intentCode);
  if (!intent) throw new Error(`意图 ${intentCode} 不存在`);
  const result = await upsertIntentWithEmbedding(intent);
  resetVectorReadyCache();
  return result;
}

/* ─── 召回测试（管理端测试台）──────────────────────────────────────────────── */
/**
 * 输入测试语句，返回 TopK 召回结果（管理端用）
 */
export async function recallTest(text, topK = 3) {
  const result = await searchIntent(text, topK);
  return {
    query: text,
    ready: result.ready,
    top_intent: result.topIntent
      ? {
          intent_code:    result.topIntent.intent_code,
          intent_name:    result.topIntent.intent_name,
          dispatch_mode:  result.topIntent.dispatch_mode,
          tool_name:      result.topIntent.tool_name,
          card_template_key: result.topIntent.card_template_key,
          similarity:     result.topIntent.similarity,
          in_scope:       !!result.topIntent,
        }
      : null,
    all_results: result.results.map((r) => ({
      intent_code:   r.intent_code,
      intent_name:   r.intent_name,
      dispatch_mode: r.dispatch_mode,
      similarity:    parseFloat(r.similarity.toFixed(4)),
    })),
  };
}

/* ─── 意图列表查询（管理端）────────────────────────────────────────────────── */
export async function listIntentLabels() {
  try {
    const res = await query(
      `SELECT id, intent_code, intent_name, dispatch_mode, tool_name,
              card_template_key, intent_scope, requires_confirmation, requires_payment,
              similarity_threshold, priority, is_enabled, updated_at,
              (embedding IS NOT NULL) AS has_embedding
       FROM wenwen_intent_labels
       ORDER BY priority, intent_code`
    );
    return res.rows;
  } catch {
    return [];
  }
}
