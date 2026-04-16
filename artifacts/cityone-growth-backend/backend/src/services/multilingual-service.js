import { chatCompletion } from "./agent-llm-service.js";
import { OSS_CONFIGURED, putObject } from "./ossService.js";

const EMPTY_ML = Object.freeze({ zh: "", th: "", en: "" });

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

function toText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  if (typeof value === "string") return value;
  return String(value);
}

export function normalizeMlValue(value, preferredSourceLang = "zh") {
  const safeSource = ["zh", "th", "en"].includes(preferredSourceLang) ? preferredSourceLang : "zh";
  if (value == null || value === "") return { ...EMPTY_ML };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return normalizeMlValue(parsed, safeSource);
    } catch {}
    return { ...EMPTY_ML, [safeSource]: value };
  }
  if (Array.isArray(value)) {
    return { ...EMPTY_ML, [safeSource]: value.filter(Boolean).join("\n") };
  }
  if (typeof value === "object") {
    return {
      zh: toText(value.zh).trim(),
      th: toText(value.th).trim(),
      en: toText(value.en).trim(),
    };
  }
  return { ...EMPTY_ML, [safeSource]: String(value) };
}

export function detectMlSourceLang(value, preferredSourceLang = "zh") {
  const normalized = normalizeMlValue(value, preferredSourceLang);
  if (normalized[preferredSourceLang]?.trim()) return preferredSourceLang;
  if (normalized.zh.trim()) return "zh";
  if (normalized.th.trim()) return "th";
  if (normalized.en.trim()) return "en";
  return null;
}

export function needsMlTranslation(value, preferredSourceLang = "zh") {
  const normalized = normalizeMlValue(value, preferredSourceLang);
  const sourceLang = detectMlSourceLang(normalized, preferredSourceLang);
  if (!sourceLang) return false;
  return ["zh", "th", "en"].some((lang) => lang !== sourceLang && !normalized[lang]?.trim());
}

export async function translateTexts(texts, sourceLang = "zh") {
  const langLabel = { zh: "中文", th: "泰文", en: "英文" }[sourceLang] || "中文";
  const textEntries = Object.entries(texts)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `"${key}": ${JSON.stringify(value)}`)
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

export async function completeMlFieldMap(fields, preferredSourceLang = "zh") {
  const normalizedMap = {};
  const groupedTexts = { zh: {}, th: {}, en: {} };

  for (const [field, value] of Object.entries(fields || {})) {
    const normalized = normalizeMlValue(value, preferredSourceLang);
    normalizedMap[field] = normalized;
    const sourceLang = detectMlSourceLang(normalized, preferredSourceLang);
    if (!sourceLang) continue;
    if (!needsMlTranslation(normalized, preferredSourceLang)) continue;
    const sourceText = normalized[sourceLang];
    if (sourceText?.trim()) groupedTexts[sourceLang][field] = sourceText.trim();
  }

  for (const sourceLang of ["zh", "th", "en"]) {
    const texts = groupedTexts[sourceLang];
    if (!Object.keys(texts).length) continue;
    try {
      const translated = await translateTexts(texts, sourceLang);
      for (const [field, value] of Object.entries(translated || {})) {
        normalizedMap[field] = {
          ...normalizeMlValue(normalizedMap[field], preferredSourceLang),
          ...normalizeMlValue(value, sourceLang),
        };
      }
    } catch {
      // 静默降级：保留已提交源文案，避免翻译波动阻塞主保存链路
    }
  }

  return normalizedMap;
}

export async function syncMlSnapshotToOss(moduleType, recordId, fields) {
  if (!OSS_CONFIGURED) return null;
  const safeModule = String(moduleType || "generic").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/|\/$/g, "") || "generic";
  const safeId = String(recordId || "").replace(/[^a-z0-9._-]/gi, "_");
  if (!safeId) return null;

  const objectKey = `i18n-content/${safeModule}/${safeId}.json`;
  const payload = {
    module_type: safeModule,
    record_id: safeId,
    updated_at: new Date().toISOString(),
    fields,
  };
  const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  return putObject(buffer, objectKey, "application/json; charset=utf-8");
}
