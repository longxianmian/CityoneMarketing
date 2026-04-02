/**
 * agent-intent-service.js
 *
 * P0 阶段使用关键词词典 + 正则匹配实现多语言意图识别。
 * 不依赖外部 LLM，本地完成识别。
 */

import { loadAgentIntents } from "./agent-config-service.js";

const FALLBACK_INTENT = {
  intent_code: "unknown",
  intent_name: "未识别意图",
  confidence: 0,
  slots: {},
  need_confirm: false
};

/**
 * 识别用户输入的意图
 * @param {string} text - 用户输入文本
 * @param {string} language - "zh" | "th" | "en"
 * @param {object} context - { site_id, entry_code, ... }
 * @returns {object} intent result
 */
export function recognizeIntent(text, language = "zh", context = {}) {
  if (!text || !String(text).trim()) return FALLBACK_INTENT;

  const normalized = String(text).trim().toLowerCase();
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";

  const intents = loadAgentIntents().filter((i) => i.enabled !== false);

  let bestMatch = null;
  let bestScore = 0;

  for (const intent of intents) {
    const phrases = intent.phrases?.[lang] || intent.phrases?.zh || [];
    // 也检查其他语言（混合输入时有用）
    const allPhrases = [
      ...(intent.phrases?.zh || []),
      ...(intent.phrases?.th || []),
      ...(intent.phrases?.en || [])
    ];

    const uniquePhrases = [...new Set([...phrases, ...allPhrases])];

    for (const phrase of uniquePhrases) {
      const p = phrase.toLowerCase();
      let score = 0;

      if (normalized === p) {
        score = 1.0;
      } else if (normalized.includes(p)) {
        // 越长的 phrase 匹配越有价值
        score = Math.min(0.95, 0.7 + (p.length / normalized.length) * 0.25);
      } else if (p.includes(normalized) && normalized.length >= 2) {
        score = 0.6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    }
  }

  if (!bestMatch || bestScore < 0.5) return FALLBACK_INTENT;

  const slots = extractSlots(text, bestMatch.intent_code, context);

  return {
    intent_code: bestMatch.intent_code,
    intent_name: bestMatch.intent_name,
    confidence: Math.round(bestScore * 100) / 100,
    slots,
    need_confirm: !!bestMatch.need_confirm
  };
}

function extractSlots(text, intentCode, context = {}) {
  const slots = {};

  // 从上下文中注入基础槽位
  if (context.site_id) slots.site_id = context.site_id;
  if (context.entry_code) slots.entry_code = context.entry_code;
  if (context.entry_type) slots.entry_type = context.entry_type;

  return slots;
}
