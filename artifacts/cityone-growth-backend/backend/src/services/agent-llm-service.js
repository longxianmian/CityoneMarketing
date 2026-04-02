/**
 * agent-llm-service.js
 *
 * 基于 Replit OpenAI 集成的 LLM 服务层。
 * 使用 gpt-5-mini（性价比最高，适合高频意图识别和自然语言回复生成）。
 *
 * 对接方式：
 *   - 环境变量由 Replit 平台自动注入，无需手动配置
 *   - AI_INTEGRATIONS_OPENAI_BASE_URL
 *   - AI_INTEGRATIONS_OPENAI_API_KEY
 */

import OpenAI from "openai";

const MODEL = "gpt-5-mini";
const MAX_TOKENS = 8192;

let _client = null;

function getClient() {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!baseURL || !apiKey) {
      throw new Error("OpenAI 集成未配置：AI_INTEGRATIONS_OPENAI_BASE_URL 或 AI_INTEGRATIONS_OPENAI_API_KEY 缺失");
    }

    _client = new OpenAI({ apiKey, baseURL });
  }
  return _client;
}

/**
 * 通用聊天调用（非流式）
 * @param {Array} messages - OpenAI messages 格式
 * @param {object} options
 * @returns {string} assistant 的回复文本
 */
export async function chatCompletion(messages, options = {}) {
  const client = getClient();
  const params = {
    model: options.model || MODEL,
    messages,
    max_completion_tokens: options.maxTokens || MAX_TOKENS
  };
  if (options.jsonMode) {
    params.response_format = { type: "json_object" };
  }
  const response = await client.chat.completions.create(params);
  return response.choices[0]?.message?.content || "";
}

/**
 * 意图识别：输入用户文本，返回结构化意图 JSON
 * @param {string} text - 用户输入
 * @param {string} language - zh/th/en
 * @param {string[]} allowedIntents - 当前用户可用的意图列表
 * @param {object} context - { site_id, entry_code, ... }
 * @returns {{ intent_code, intent_name, confidence, slots, need_confirm }}
 */
export async function recognizeIntentWithLLM(text, language = "zh", allowedIntents = [], context = {}) {
  const langLabel = { zh: "中文", th: "泰文", en: "英文" }[language] || "中文";

  const intentDescriptions = {
    greeting: "用户打招呼、问好、或泛问「有没有人」「在吗」等",
    nearby_sites_query: "查附近可用共享充电宝站点",
    borrow_help: "询问如何借共享充电宝的流程",
    return_help: "询问如何归还共享充电宝的流程",
    coupon_list_query: "查询用户自己的可用优惠券列表",
    coupon_recommend: "推荐当前最适合使用的优惠券",
    benefit_claim_query: "查询用户还可以领取哪些福利或奖励",
    points_balance_query: "查询用户的积分余额",
    points_redeem_help: "询问如何使用积分兑换商品",
    invite_help: "询问邀请好友的规则和奖励说明",
    invite_poster_generate: "生成个人专属邀请链接或海报",
    recent_orders_query: "查询最近的借电订单记录",
    after_sale_apply: "发起售后申请或投诉",
    member_rights_query: "查询会员权益",
    activity_query: "查询进行中的活动",
    unknown: "以上意图都不匹配"
  };

  const baseIntents = ["greeting", ...allowedIntents];
  const intentList = [...new Set([...baseIntents, "unknown"])].map((code) => ({
    code,
    desc: intentDescriptions[code] || code
  }));

  const systemPrompt = `你是 CityOne 共享充电宝平台的 AI 助理意图识别系统。

用户发送的消息语言：${langLabel}
可识别的意图列表（含描述）：
${intentList.map((i) => `- ${i.code}：${i.desc}`).join("\n")}

当前上下文：
- 站点ID：${context.site_id || "未知"}
- 入口类型：${context.entry_type || "未知"}

你的任务：
1. 判断用户消息最匹配哪个意图（只能从上面列表选择）
2. 提取相关槽位参数（如有）
3. 估计置信度（0.0~1.0）

返回严格 JSON 格式（不要有任何额外文字）：
{
  "intent_code": "意图代码",
  "intent_name": "意图名称（中文）",
  "confidence": 0.95,
  "slots": {},
  "need_confirm": false
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: text }
  ];

  const raw = await chatCompletion(messages, { jsonMode: true });

  try {
    const parsed = JSON.parse(raw);
    return {
      intent_code: parsed.intent_code || "unknown",
      intent_name: parsed.intent_name || "未知意图",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      slots: { ...(context.site_id ? { site_id: context.site_id } : {}), ...(parsed.slots || {}) },
      need_confirm: !!parsed.need_confirm
    };
  } catch {
    return { intent_code: "unknown", intent_name: "未知意图", confidence: 0, slots: {}, need_confirm: false };
  }
}

/**
 * 自然语言回复生成：基于工具结果和上下文生成友好回复文本
 * @param {string} intentCode
 * @param {object} toolResult
 * @param {string} identityTier
 * @param {string} language
 * @param {string[]} conversationHistory - 近期对话历史（["用户: ...", "助理: ..."]）
 * @returns {string} 自然语言回复文本
 */
export async function generateReplyText(intentCode, toolResult, identityTier, language = "zh", conversationHistory = []) {
  const langLabel = { zh: "中文", th: "泰文", en: "英文" }[language] || "中文";
  const tierLabel = {
    guest_unfollowed: "未关注用户",
    oa_fan: "OA粉丝",
    identified_user: "已识别用户",
    member: "会员"
  }[identityTier] || identityTier;

  const toolData = toolResult?.tool_result ? JSON.stringify(toolResult.tool_result, null, 2) : "（无工具数据）";
  const toolSuccess = toolResult?.success !== false;

  const systemPrompt = `你是 CityOne 共享充电宝平台的 AI 助理，名叫"小城"。
语气：亲切、简洁、专业，像一个贴心的客服。
回复语言：${langLabel}
当前用户身份：${tierLabel}
意图：${intentCode}
工具执行结果：${toolSuccess ? "成功" : "失败"}

规则：
1. 只输出给用户看的自然语言文本，不超过 80 字
2. 如果工具数据存在，用简短语言摘要要点，不要照搬原始数据
3. 不要提到"工具"、"系统"、"接口"等技术词汇
4. 如果工具失败，给出安抚性提示`;

  const historyMessages = conversationHistory.slice(-4).map((h) => ({
    role: h.startsWith("用户:") || h.startsWith("User:") ? "user" : "assistant",
    content: h.replace(/^(用户:|助理:|User:|Assistant:)\s*/, "")
  }));

  const userContent = `工具数据：\n${toolData}\n\n请生成自然语言回复：`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userContent }
  ];

  return chatCompletion(messages, { maxTokens: 512 });
}

/**
 * 检查 LLM 是否可用
 */
export async function checkLLMHealth() {
  try {
    const result = await chatCompletion([{ role: "user", content: "回复 OK" }], { maxTokens: 512 });
    return { ok: true, model: MODEL, response: result };
  } catch (err) {
    return { ok: false, model: MODEL, error: err.message };
  }
}
