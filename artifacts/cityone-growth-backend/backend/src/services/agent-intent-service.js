/**
 * agent-intent-service.js
 *
 * 意图识别层：
 *   - 优先使用 LLM（gpt-5-mini）进行意图理解和槽位提取
 *   - LLM 失败时自动降级为关键词词典匹配
 *   - 多语言支持：中文 / 泰文 / 英文
 */

import { loadAgentIntents } from "./agent-config-service.js";
import { recognizeIntentWithLLM } from "./agent-llm-service.js";

const FALLBACK_INTENT = {
  intent_code: "unknown",
  intent_name: "未识别意图",
  confidence: 0,
  slots: {},
  need_confirm: false,
  recognition_mode: "fallback"
};

/**
 * 识别用户输入的意图
 * @param {string} text - 用户输入文本
 * @param {string} language - "zh" | "th" | "en"
 * @param {object} context - { site_id, entry_code, entry_type, allowed_intents }
 * @returns {object} intent result
 */
export async function recognizeIntent(text, language = "zh", context = {}) {
  if (!text || !String(text).trim()) return FALLBACK_INTENT;

  const allowedIntents = context.allowed_intents || [];

  // ── 优先走 LLM ───────────────────────────────────────────────────────────
  try {
    const llmResult = await recognizeIntentWithLLM(text, language, allowedIntents, context);
    if (llmResult && llmResult.intent_code && llmResult.intent_code !== "unknown" && llmResult.confidence >= 0.5) {
      return { ...llmResult, recognition_mode: "llm" };
    }
    // LLM 返回 unknown 或低置信，继续尝试关键词
  } catch (err) {
    // LLM 调用失败，静默降级
    console.error("[intent] LLM 调用失败，降级至关键词:", err.message);
  }

  // ── 降级：关键词词典匹配 ──────────────────────────────────────────────────
  const keywordResult = recognizeByKeyword(text, language, allowedIntents);
  if (keywordResult) return { ...keywordResult, recognition_mode: "keyword" };

  return { ...FALLBACK_INTENT, recognition_mode: "fallback" };
}

function recognizeByKeyword(text, language, allowedIntents) {
  const normalized = String(text).trim().toLowerCase();
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";
  const intents = loadAgentIntents().filter((i) => i.enabled !== false);

  let bestMatch = null;
  let bestScore = 0;

  const ALWAYS_ALLOWED = ["greeting"];

  for (const intent of intents) {
    if (allowedIntents.length > 0 && !allowedIntents.includes(intent.intent_code) && !ALWAYS_ALLOWED.includes(intent.intent_code)) continue;

    const phrases = intent.phrases?.[lang] || intent.phrases?.zh || [];
    const allPhrases = [...new Set([
      ...(intent.phrases?.zh || []),
      ...(intent.phrases?.th || []),
      ...(intent.phrases?.en || [])
    ])];

    for (const phrase of [...phrases, ...allPhrases]) {
      const p = phrase.toLowerCase();
      let score = 0;

      if (normalized === p) score = 1.0;
      else if (normalized.includes(p)) score = Math.min(0.95, 0.7 + (p.length / normalized.length) * 0.25);
      else if (p.includes(normalized) && normalized.length >= 2) score = 0.6;

      if (score > bestScore) { bestScore = score; bestMatch = intent; }
    }
  }

  if (!bestMatch || bestScore < 0.5) return null;

  return {
    intent_code: bestMatch.intent_code,
    intent_name: bestMatch.intent_name,
    confidence: Math.round(bestScore * 100) / 100,
    slots: {},
    need_confirm: !!bestMatch.need_confirm
  };
}
