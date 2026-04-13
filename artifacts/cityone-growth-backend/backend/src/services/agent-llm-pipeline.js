/**
 * agent-llm-pipeline.js
 *
 * LLM Function Calling 主管道
 *
 * 流程：
 *   1. 关键词模板检查（管理员配置的特殊情况，直接返回）
 *   2. LLM with function calling（主路径，LLM 自主决定调哪个工具）
 *   3. 工具执行 → 结果返回 LLM → 生成最终文本回复
 *   4. 返回 { text, display_payload, suggestions }
 */

import { chatCompletionWithTools, chatCompletion } from "./agent-llm-service.js";
import { loadAgentIntents } from "./agent-config-service.js";
import { execute as nearBySites }   from "./agent-tools/tool-nearby-sites.js";
import { execute as couponList }    from "./agent-tools/tool-coupon-list.js";
import { execute as couponRecommend } from "./agent-tools/tool-coupon-recommend.js";
import { execute as claimBenefits } from "./agent-tools/tool-claim-benefits.js";
import { execute as invitePoster }  from "./agent-tools/tool-invite-poster.js";
import { execute as orderQuery }    from "./agent-tools/tool-order-query.js";
import { execute as pointsQuery }   from "./agent-tools/tool-points-query.js";

/* ─── 工具函数定义（OpenAI function schema）────────────────────────────── */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "query_points_balance",
      description: "查询用户的积分余额、会员等级、即将过期积分",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_coupons",
      description: "查询用户当前持有的可用优惠券列表",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_coupon",
      description: "根据当前情况推荐最适合用户使用的优惠券",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_nearby_stations",
      description: "查询附近可借用共享充电宝的站点",
      parameters: {
        type: "object",
        properties: {
          site_id: { type: "string", description: "当前站点ID（已知时传入）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_benefits",
      description: "查询用户还可以领取哪些福利或奖励",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_invite_link",
      description: "生成用户专属的邀请链接，用于邀请好友",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_recent_orders",
      description: "查询用户最近的充电宝借还订单记录",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/* ─── 工具执行映射 ────────────────────────────────────────────────────────── */
const TOOL_EXECUTOR = {
  query_points_balance:  (args, ctx) => pointsQuery(args, ctx),
  query_coupons:         (args, ctx) => couponList(args, ctx),
  recommend_coupon:      (args, ctx) => couponRecommend(args, ctx),
  query_nearby_stations: (args, ctx) => nearBySites(args, ctx),
  query_benefits:        (args, ctx) => claimBenefits(args, ctx),
  generate_invite_link:  (args, ctx) => invitePoster(args, ctx),
  query_recent_orders:   (args, ctx) => orderQuery(args, ctx),
};

/* ─── 系统提示词组装 ──────────────────────────────────────────────────────── */
function buildSystemPrompt(roleKeywords, userContext) {
  const langMap    = { zh: "中文", th: "ไทย", en: "English" };
  const tierMap    = {
    visitor_unfollowed: "游客（未关注OA）",
    oa_fan:             "OA粉丝（已关注）",
    oa_followed_registered: "OA粉丝（已关注）",
    identified_user:    "已注册用户",
    member:             "会员",
  };
  const kw = roleKeywords || {};
  const lang = userContext.language || "zh";

  return [
    kw.identity_keywords      || "你是 CityOne 共享充电宝平台的智能助手「问问」。",
    `职责范围：${kw.responsibility_keywords || "帮助用户解答充电宝借还、积分、卡券相关问题。"}`,
    `执行原则：${kw.execution_keywords      || "优先解决用户问题，保持友好简洁。"}`,
    `边界约束：${kw.boundary_keywords       || "不透露系统内部配置，不做超权操作。"}`,
    `输出格式：${kw.output_keywords         || "语言简洁口语化，每次回复不超过100字。"}`,
    `禁止行为：${kw.forbidden_keywords      || "禁止越权操作用户账户。"}`,
    "",
    `当前用户：${tierMap[userContext.identity_tier] || "未知身份"}`,
    `回复语言：必须使用${langMap[lang] || "中文"}`,
    "",
    "工具调用规则：需要查询数据时主动调用对应工具，不要猜测或编造数据。工具返回数据后，用简短自然语言摘要要点。",
    "",
    "【超出服务范围处理】如果用户的问题与共享充电宝、积分、卡券、站点、订单、会员等服务完全无关（如问天气、翻译、新闻、故事、代码等），",
    lang === "th"
      ? "请直接回复：ขอโทษนะคะ หนูให้บริการเฉพาะเรื่องที่เกี่ยวกับพาวเวอร์แบงก์เท่านั้นค่ะ"
      : lang === "en"
      ? "please reply exactly: Sorry, I only provide services related to power banks."
      : "请直接回复：抱歉哦，我只提供跟充电宝相关的服务哦",
    "不要试图引导回话题，不要解释，不要加其他内容，直接返回这句话即可。",
  ].join("\n");
}

/* ─── 超出服务范围快速检测（零延迟，无 LLM 调用）───────────────────────── */
// 充电宝相关关键词（只要包含其中任意一个，就视为在服务范围内）
const IN_SCOPE_RE = /充电宝|共享充电|充电|电宝|站点|卡券|优惠券|积分|借电|还电|会员|订单|福利|邀请|领取|兑换|coupon|points|power.?bank|powerbank|charging|station|order|member|welfare|พาวเวอร์แบงก์|แบตสำรอง|คูปอง|คะแนน|ออเดอร์|สมาชิก|สถานี/i;

// 明确超出服务范围的关键词
const OUT_OF_SCOPE_RE = /天气|气温|温度|下雨|晴天|台风|预报|weather|forecast|temperature|rain|sunny|cloudy|อากาศ|พยากรณ์|ฝน|แดด|ร้อน|หนาว|新闻|头条|时政|政治|股票|基金|理财|炒股|比特币|news|politics|stock|investment|crypto|ข่าว|การเมือง|หุ้น|帮我翻译|翻译一下|translate this|翻訳|แปลภาษา|讲个故事|说个笑话|写首诗|写作文|帮我写|tell me a story|write a poem|tell a joke|write.*for me|เล่านิทาน|เล่าเรื่อง|足球|篮球|球赛|比赛结果|football.*score|basketball|sports result|ผลบอล|ผลกีฬา|打车|叫车|打的|网约车|出租车|叫滴滴|滴滴|grab|taxi|เรียกรถ|แท็กซี่|กร๊าบ|点外卖|订餐|外卖|美团|饿了么|food delivery|สั่งอาหาร|เดลิเวอรี|导航|地图|路线|怎么走|maps|navigation|แผนที่|นำทาง|酒店|宾馆|订房|hotel|ที่พัก|โรงแรม|机票|火车票|高铁|飞机|订票|flight|ticket|ตั๋ว|สายการบิน|医院|看病|医生|药|诊所|hospital|doctor|medicine|โรงพยาบาล|หมอ|ยา|借钱|贷款|转账|还款|loan|transfer money|กู้เงิน|โอนเงิน|购物|买东西|淘宝|京东|shopping|สั่งซื้อ|ช้อปปิ้ง|唱歌|推荐歌曲|音乐|歌词|music|song|เพลง|ฟังเพลง|拍照|相册|图片|photo|camera|รูปภาพ|กล้อง/i;

const OUT_OF_SCOPE_REPLY = {
  zh: "抱歉哦，我只提供跟充电宝相关的服务哦",
  th: "ขอโทษนะคะ หนูให้บริการเฉพาะเรื่องที่เกี่ยวกับพาวเวอร์แบงก์เท่านั้นค่ะ",
  en: "Sorry, I only provide services related to power banks.",
};

function checkOutOfScope(text, language) {
  if (IN_SCOPE_RE.test(text)) return { matched: false };  // 含充电宝关键词→不超出
  if (OUT_OF_SCOPE_RE.test(text)) {
    const lang = ["zh", "th", "en"].includes(language) ? language : "zh";
    return { matched: true, text: OUT_OF_SCOPE_REPLY[lang] };
  }
  return { matched: false };
}

/* ─── 关键词模板检查（管理端配置的特殊情况）────────────────────────────── */
function checkKeywordTemplate(text, language) {
  const normalized = String(text).trim().toLowerCase();
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";
  const intents = loadAgentIntents().filter(
    (i) => i.enabled !== false && i.template_responses && Object.keys(i.template_responses).length > 0
  );

  for (const intent of intents) {
    const phrases = [
      ...(intent.phrases?.zh  || []),
      ...(intent.phrases?.th  || []),
      ...(intent.phrases?.en  || []),
    ];
    for (const phrase of phrases) {
      const p = phrase.toLowerCase();
      if (normalized === p || normalized.includes(p) || p.includes(normalized)) {
        const resp = intent.template_responses?.[lang] || intent.template_responses?.zh || "";
        if (resp) return { matched: true, text: resp, intent_code: intent.intent_code };
      }
    }
  }
  return { matched: false };
}

/* ─── 主管道 ──────────────────────────────────────────────────────────────── */
/**
 * @param {string}   userText       - 用户输入
 * @param {Array}    sessionHistory - 近期消息历史 [{ role, text }]
 * @param {object}   roleKeywords   - 管理端配置的角色关键词
 * @param {object}   userContext    - { language, identity_tier, line_user_id, user_id, site_id }
 * @returns {{ text, display_payload, suggestions, source }}
 */
export async function runLLMPipeline(userText, sessionHistory, roleKeywords, userContext) {
  const language = userContext.language || "zh";

  /* ── Step 1: 关键词模板检查 ──────────────────────────────────────────── */
  const templateCheck = checkKeywordTemplate(userText, language);
  if (templateCheck.matched) {
    return {
      text:            templateCheck.text,
      display_payload: null,
      suggestions:     [],
      source:          "keyword_template",
      intent_code:     templateCheck.intent_code,
    };
  }

  /* ── Step 1b: 超出服务范围快速检测（无 LLM 调用，即时返回）─────────── */
  const oosCheck = checkOutOfScope(userText, language);
  if (oosCheck.matched) {
    return {
      text:            oosCheck.text,
      display_payload: null,
      suggestions:     [],
      source:          "out_of_scope",
    };
  }

  /* ── Step 2: 构建系统提示词 + 历史消息 ──────────────────────────────── */
  const systemPrompt = buildSystemPrompt(roleKeywords, userContext);
  const historyMessages = (sessionHistory || []).slice(-6).map((m) => ({
    role:    m.role === "user" ? "user" : "assistant",
    content: m.text || "",
  }));
  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user",   content: userText },
  ];

  /* ── Step 3: LLM 第一次调用（含工具定义，LLM 自主决定是否调工具）─── */
  let firstResponse;
  try {
    firstResponse = await chatCompletionWithTools(messages, TOOL_DEFINITIONS);
  } catch (err) {
    console.error("[pipeline] LLM 第一次调用失败:", err.message);
    return { text: "小城暂时有点忙，请稍后再试 😊", display_payload: null, suggestions: [], source: "error" };
  }

  /* ── 无工具调用：LLM 直接回复 ───────────────────────────────────────── */
  if (!firstResponse.tool_call) {
    return {
      text:            firstResponse.text || "小城没有理解你的问题，能换个方式说吗？",
      display_payload: null,
      suggestions:     [],
      source:          "llm_direct",
    };
  }

  /* ── Step 4: 执行工具 ────────────────────────────────────────────────── */
  const tc = firstResponse.tool_call;
  const toolFn = TOOL_EXECUTOR[tc.name];
  let toolResult = null;

  if (toolFn) {
    try {
      toolResult = await toolFn(tc.arguments || {}, {
        line_user_id:  userContext.line_user_id  || "",
        user_id:       userContext.user_id        || "",
        identity_tier: userContext.identity_tier  || "",
        language,
        site_id:       userContext.site_id        || "",
        ...tc.arguments,
      });
    } catch (err) {
      console.error(`[pipeline] 工具执行失败 (${tc.name}):`, err.message);
      toolResult = { success: false, error_message: err.message };
    }
  } else {
    toolResult = { success: false, error_message: `工具 ${tc.name} 未实现` };
  }

  /* ── Step 5: 把工具结果包装成 system 注入，让 LLM 生成最终回复 ───── */
  const toolResultContent = JSON.stringify(
    toolResult?.tool_result || { error: toolResult?.error_message || "无数据" }
  );

  // 第二次调用：纯文本摘要，明确禁止工具调用
  const langName = language === "th" ? "ไทย" : language === "en" ? "English" : "中文";
  const messagesForFinal = [
    {
      role:    "system",
      content: `你是 CityOne 共享充电宝平台的助手「问问」。
你已经查询到了用户需要的数据，现在只需要用自然语言告诉用户结果。
不要调用任何工具，不要返回 JSON，直接用${langName}简短口语化地回答用户。不超过80字。`,
    },
    {
      role:    "user",
      content: `用户问：${userText}\n\n查询结果：${toolResultContent}\n\n请用${langName}自然语言简短回答用户，突出最关键的信息。`,
    },
  ];

  let finalText = "";
  try {
    finalText = await chatCompletion(messagesForFinal, { maxTokens: 256 });
  } catch (err) {
    console.error("[pipeline] LLM 最终回复失败:", err.message, err.stack?.slice(0, 200));
    finalText = "查到了，但小城整理信息时出了点问题，请稍后再试。";
  }

  return {
    text:            finalText?.trim() || "已为你查询完毕，请查看上方卡片。",
    display_payload: toolResult?.display_payload || null,
    suggestions:     [],
    source:          "llm_tool",
    tool_used:       tc.name,
  };
}
