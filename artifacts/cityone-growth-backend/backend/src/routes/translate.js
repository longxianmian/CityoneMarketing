/**
 * translate.js
 *
 * POST /api/translate
 *
 * 请求体：
 *   { texts: Record<string, string>, sourceLang: 'zh' | 'th' | 'en' }
 *
 * 响应：
 *   { result: Record<string, { zh: string, th: string, en: string }> }
 *
 * 使用 gpt-5-mini，json_object 模式，专业双重角色 system prompt。
 */

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

export async function handleTranslate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const { texts, sourceLang = "zh" } = body;

    if (!texts || typeof texts !== "object" || Object.keys(texts).length === 0) {
      return sendJson(res, 400, { msg: "texts 参数不能为空" });
    }

    const langLabel = { zh: "中文", th: "泰文", en: "英文" }[sourceLang] || "中文";
    const textEntries = Object.entries(texts)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
      .join(",\n  ");

    const userPrompt = `以下是需要翻译的${langLabel}文本（JSON 格式，key 为字段名，value 为原文）：

{
  ${textEntries}
}

请将每个字段翻译成中文(zh)、泰文(th)、英文(en)三种语言，严格按照 result 格式输出 JSON。`;

    const raw = await chatCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 2048, jsonMode: true }
    );

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return sendJson(res, 500, { msg: "翻译结果解析失败", raw });
    }

    if (!parsed.result || typeof parsed.result !== "object") {
      return sendJson(res, 500, { code: 500, msg: "翻译结果格式错误" });
    }

    return sendJson(res, 200, { code: 200, msg: "ok", data: { result: parsed.result } });
  } catch (err) {
    return sendJson(res, 500, { code: 500, msg: err?.message || "翻译服务异常" });
  }
}
