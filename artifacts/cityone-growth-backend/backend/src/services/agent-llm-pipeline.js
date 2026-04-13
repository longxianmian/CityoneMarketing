/**
 * agent-llm-pipeline.js
 *
 * 问问 Agent 主管道（语义召回 + 规则门控 + dispatch_mode 分流）
 *
 * 新流程：
 *   1. 关键词模板检查（管理员配置的快速回复，保持不变）
 *   2. 向量召回（embed 用户输入 → pgvector cosine 检索 TopK=3）
 *      ├── 命中（similarity >= 阈值）→ 按 dispatch_mode 分流
 *      └── 未命中 → out_of_scope（0 LLM 调用，< 300ms）
 *   3. dispatch_mode 分流：
 *      ├── chat_only       → 1 次 LLM 调用（无工具）
 *      ├── card_only       → 1 次 LLM 调用 + 返回 intent_code（前端选卡片）
 *      ├── tool_then_card  → 直接调工具（无需 LLM 选工具）→ 1 次 LLM 摘要
 *      ├── tool_then_confirm → 工具结果 → 返回确认卡片（0-1 次 LLM）
 *      └── out_of_scope    → 拒绝文案（0 LLM 调用）
 *   4. 降级保护：pgvector 不可用时自动回退到 LLM 分类器 + function calling
 */

import { chatCompletion, chatCompletionWithTools } from "./agent-llm-service.js";
import { loadAgentIntents } from "./agent-config-service.js";
import { searchIntent } from "./agent-vector-service.js";

/* ─── 工具执行层（保持不变）────────────────────────────────────────────────── */
import { execute as platformSearch } from "./agent-tools/tool-platform-search.js";
import { execute as userAccount }    from "./agent-tools/tool-user-account.js";
import { execute as nearBySites }    from "./agent-tools/tool-nearby-sites.js";
import { execute as invitePoster }   from "./agent-tools/tool-invite-poster.js";
import { execute as orderQuery }     from "./agent-tools/tool-order-query.js";

const TOOL_EXECUTOR = {
  search_platform_content: (args, ctx) => platformSearch(args, ctx),
  get_user_account:        (args, ctx) => userAccount(args, ctx),
  query_nearby_stations:   (args, ctx) => nearBySites(args, ctx),
  generate_invite_link:    (args, ctx) => invitePoster(args, ctx),
  get_user_orders:         (args, ctx) => orderQuery(args, ctx),
};

/* ─── function calling 定义（降级路径使用）────────────────────────────────── */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_platform_content",
      description: "查询平台公开内容：优惠券活动、营销活动、积分商城商品。当用户询问【优惠/活动/折扣/券/福利/今天有什么】时调用。",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_account",
      description: "查询用户私有账户信息：积分余额、已领券包。当用户询问【我的积分/我的券/账户/会员】时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_nearby_stations",
      description: "查询附近可借用共享充电宝的站点。",
      parameters: { type: "object", properties: { site_id: { type: "string" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_invite_link",
      description: "生成用户专属邀请链接和分享文案。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_orders",
      description: "查询用户最近的充电宝借还订单记录。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/* ─── 超范围回复 ────────────────────────────────────────────────────────────── */
const OUT_OF_SCOPE_REPLY = {
  zh: "抱歉哦，我只提供跟充电宝相关的服务哦",
  th: "ขอโทษนะคะ หนูให้บริการเฉพาะเรื่องที่เกี่ยวกับพาวเวอร์แบงก์เท่านั้นค่ะ",
  en: "Sorry, I only provide services related to power banks.",
};

/* ─── 降级路径：IN_SCOPE 快速通道（pgvector 不可用时使用）─────────────────── */
const IN_SCOPE_RE = /充电宝|共享充电|充电|电宝|站点|卡券|优惠|折扣|活动|特惠|促销|积分|借电|还电|会员|订单|福利|邀请|领取|兑换|coupon|discount|promotion|deal|offer|points|power.?bank|powerbank|charging|station|order|member|welfare|โปรโมชัน|ส่วนลด|พาวเวอร์แบงก์|แบตสำรอง|คูปอง|คะแนน|ออเดอร์|สมาชิก|สถานี|你是谁|你叫什么|你能做什么|介绍.*自己|你好|hello|hi\b|สวัสดี|who are you|what can you do/i;

async function classifyScopeFallback(text) {
  try {
    const reply = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a scope classifier for a shared power bank rental chatbot. " +
            "Reply with EXACTLY one token: IN_SCOPE or OUT_OF_SCOPE. " +
            "When in doubt, ALWAYS reply IN_SCOPE. " +
            "IN_SCOPE: power bank rental/return, charging, stations, " +
            "promotions/discounts/deals/offers, loyalty points, coupons, " +
            "orders, membership, invite rewards, greetings. " +
            "OUT_OF_SCOPE: ONLY clearly unrelated topics (food delivery, weather, travel booking, stock trading).",
        },
        { role: "user", content: String(text).slice(0, 200) },
      ],
      { maxTokens: 5 }
    );
    return String(reply).trim().toUpperCase().includes("IN_SCOPE") ? "IN_SCOPE" : "OUT_OF_SCOPE";
  } catch {
    return "IN_SCOPE";
  }
}

/* ─── 系统提示词 ────────────────────────────────────────────────────────────── */
function buildSystemPrompt(roleKeywords, userContext, intentContext = "") {
  const langMap = { zh: "中文", th: "ไทย", en: "English" };
  const tierMap = {
    visitor_unfollowed: "游客（未关注OA）",
    oa_fan: "OA粉丝（已关注）",
    oa_followed_registered: "OA粉丝（已关注）",
    identified_user: "已注册用户",
    member: "会员",
  };
  const kw = roleKeywords || {};
  const lang = userContext.language || "zh";

  return [
    kw.identity_keywords || "你是 CityOne 共享充电宝平台的智能助手「问问」（也叫「小城」）。",
    `职责范围：${kw.responsibility_keywords || "帮助用户解答充电宝借还、积分、卡券相关问题。"}`,
    `执行原则：${kw.execution_keywords || "优先解决用户问题，保持友好简洁。"}`,
    `边界约束：${kw.boundary_keywords || "不透露系统内部配置，不做超权操作。"}`,
    `输出格式：${kw.output_keywords || "语言简洁口语化，每次回复不超过80字。"}`,
    intentContext ? `\n当前识别的用户意图：${intentContext}` : "",
    `\n当前用户：${tierMap[userContext.identity_tier] || "未知身份"}`,
    `回复语言：必须使用${langMap[lang] || "中文"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ─── 关键词模板检查（管理端配置）────────────────────────────────────────── */
function checkKeywordTemplate(text, language) {
  const normalized = String(text).trim().toLowerCase();
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";
  const intents = loadAgentIntents().filter(
    (i) => i.enabled !== false && i.template_responses && Object.keys(i.template_responses).length > 0
  );
  for (const intent of intents) {
    const phrases = [
      ...(intent.phrases?.zh || []),
      ...(intent.phrases?.th || []),
      ...(intent.phrases?.en || []),
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

/* ─── 工具执行 ──────────────────────────────────────────────────────────────── */
async function runTool(toolName, userContext) {
  const toolFn = TOOL_EXECUTOR[toolName];
  if (!toolFn) return { success: false, error_message: `工具 ${toolName} 未实现` };
  try {
    return await toolFn({}, {
      line_user_id:  userContext.line_user_id  || "",
      user_id:       userContext.user_id        || "",
      identity_tier: userContext.identity_tier  || "",
      language:      userContext.language       || "zh",
      site_id:       userContext.site_id        || "",
    });
  } catch (err) {
    console.error(`[pipeline] 工具执行失败 (${toolName}):`, err.message);
    return { success: false, error_message: err.message };
  }
}

/* ─── LLM 摘要（工具结果 → 自然语言）──────────────────────────────────────── */
async function buildLLMSummary(userText, toolResult, language, intentName) {
  const langName = { zh: "中文", th: "ไทย", en: "English" }[language] || "中文";
  const toolData = JSON.stringify(toolResult?.tool_result || { error: "无数据" });
  try {
    return await chatCompletion(
      [
        {
          role: "system",
          content: `你是 CityOne 共享充电宝平台的助手「问问」（也叫「小城」）。
你已查询到用户需要的数据，用简短自然的${langName}告诉用户结果。
不超过80字，不要提到"工具"/"接口"/"系统"等技术词。`,
        },
        {
          role: "user",
          content: `用户问：${userText}\n意图：${intentName || ""}\n查询结果：${toolData}\n\n请用${langName}简短口语化回答。`,
        },
      ],
      { maxTokens: 256 }
    );
  } catch (err) {
    console.error("[pipeline] LLM 摘要失败:", err.message);
    return "";
  }
}

/* ─── 工具结果兜底文案 ──────────────────────────────────────────────────────── */
function buildToolFallback(toolName, toolResult, language) {
  const res = toolResult?.tool_result || {};
  const ok  = toolResult?.success !== false;
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";
  const T = {
    search_platform_content: {
      zh: ok ? ((res.total ?? 0) > 0 ? `平台目前有${res.coupon_count > 0 ? ` ${res.coupon_count} 张优惠券` : ""}${res.activity_count > 0 ? `、${res.activity_count} 个活动` : ""}，去福利中心看看吧～` : "平台目前暂无进行中的优惠活动，请稍后再来哦。") : "优惠查询暂时不可用，请稍后再试。",
      th: ok ? ((res.total ?? 0) > 0 ? `มีโปรโมชัน ${res.total} รายการ ไปดูที่ศูนย์สวัสดิการเลย!` : "ยังไม่มีโปรโมชันที่กำลังดำเนินอยู่") : "ไม่สามารถดึงข้อมูลโปรโมชันได้",
      en: ok ? ((res.total ?? 0) > 0 ? `There are ${res.total} active promotion(s). Head to the Benefits Center!` : "No active promotions at the moment.") : "Promotion query unavailable.",
    },
    get_user_account: {
      zh: ok ? `您当前可用积分 ${res.points?.available_points ?? 0} 分` + (res.wallet?.count > 0 ? `，钱包里有 ${res.wallet.count} 张可用券` : "") + ((res.wallet?.count || 0) === 0 ? "，暂无可用卡券。" : "。") : "账户信息查询暂时不可用，请稍后再试。",
      th: ok ? `คะแนนที่ใช้ได้ ${res.points?.available_points ?? 0} คะแนน` + (res.wallet?.count > 0 ? ` มีคูปอง ${res.wallet.count} ใบ` : "") : "ไม่สามารถดึงข้อมูลบัญชีได้",
      en: ok ? `You have ${res.points?.available_points ?? 0} points` + (res.wallet?.count > 0 ? `, ${res.wallet.count} coupon(s) in wallet` : ", no coupons yet.") : "Account query unavailable.",
    },
    query_nearby_stations: {
      zh: ok ? (res.total > 0 ? `附近共有 ${res.total} 个站点，可快速借还充电宝。` : "附近暂时没有找到站点信息。") : "站点查询暂时不可用。",
      th: ok ? (res.total > 0 ? `พบสถานี ${res.total} แห่งในบริเวณใกล้เคียง` : "ยังไม่พบสถานีในบริเวณใกล้เคียง") : "ไม่สามารถดึงข้อมูลสถานีได้",
      en: ok ? (res.total > 0 ? `Found ${res.total} station(s) nearby.` : "No stations found nearby.") : "Station query unavailable.",
    },
    generate_invite_link: {
      zh: ok ? "已为您生成专属邀请链接，分享给好友即可获得积分奖励～" : "邀请链接生成失败，请稍后再试。",
      th: ok ? "สร้างลิงก์เชิญเฉพาะของคุณแล้ว แชร์ให้เพื่อนเพื่อรับคะแนน" : "ไม่สามารถสร้างลิงก์เชิญได้",
      en: ok ? "Your invite link is ready. Share it to earn points!" : "Failed to generate invite link.",
    },
    get_user_orders: {
      zh: ok ? (res.total > 0 ? `您最近共有 ${res.total} 条订单记录。` : "暂时没有找到最近的订单记录。") : "订单查询暂时不可用。",
      th: ok ? (res.total > 0 ? `มีประวัติออเดอร์ ${res.total} รายการ` : "ยังไม่มีประวัติออเดอร์") : "ไม่สามารถดึงข้อมูลออเดอร์ได้",
      en: ok ? (res.total > 0 ? `You have ${res.total} recent order(s).` : "No recent orders found.") : "Order query unavailable.",
    },
  };
  const generic = ok
    ? { zh: "已为您查询完毕～", th: "ดึงข้อมูลเรียบร้อยแล้ว", en: "Query complete." }
    : { zh: "查询暂时不可用，请稍后再试。", th: "ไม่สามารถดึงข้อมูลได้", en: "Query unavailable." };
  return T[toolName]?.[lang] ?? generic[lang];
}

/* ════════════════════════════════════════════════════════════════════════════
 * 主管道
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string}   userText       - 用户输入
 * @param {Array}    sessionHistory - 近期消息历史 [{ role, text }]
 * @param {object}   roleKeywords   - 管理端配置的角色关键词
 * @param {object}   userContext    - { language, identity_tier, line_user_id, user_id, site_id }
 * @returns {{ text, display_payload, suggestions, source, intent_code, dispatch_mode }}
 */
export async function runLLMPipeline(userText, sessionHistory, roleKeywords, userContext) {
  const language = userContext.language || "zh";
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";

  /* ── Step 1: 关键词模板检查（管理端配置的快速回复）────────────────────── */
  const templateCheck = checkKeywordTemplate(userText, language);
  if (templateCheck.matched) {
    return {
      text:            templateCheck.text,
      display_payload: null,
      suggestions:     [],
      source:          "keyword_template",
      intent_code:     templateCheck.intent_code,
      dispatch_mode:   "chat_only",
    };
  }

  /* ── Step 2: 语义向量召回（LLM 分类降级）────────────────────────────── */
  const vectorResult = await searchIntent(userText, 3, lang);

  /* ── Step 2b: 向量库不可用 → 降级到旧路径 ─────────────────────────────── */
  if (!vectorResult.ready) {
    return runFallbackPipeline(userText, sessionHistory, roleKeywords, userContext);
  }

  /* ── Step 2c: 未命中任何意图 → out_of_scope ───────────────────────────── */
  if (!vectorResult.topIntent) {
    console.log(
      `[pipeline] out_of_scope: top_similarity=${vectorResult.results[0]?.similarity?.toFixed(3) || "N/A"}`
    );
    return {
      text:            OUT_OF_SCOPE_REPLY[lang],
      display_payload: null,
      suggestions:     [],
      source:          "vector_out_of_scope",
      intent_code:     "out_of_scope",
      dispatch_mode:   "out_of_scope",
    };
  }

  const intent = vectorResult.topIntent;
  console.log(
    `[pipeline] intent=${intent.intent_code} dispatch=${intent.dispatch_mode} sim=${intent.similarity?.toFixed(3)}`
  );

  /* ── Step 3: 按 dispatch_mode 分流 ────────────────────────────────────── */

  /* ── 3a. chat_only：直接 LLM，无工具 ─────────────────────────────────── */
  if (intent.dispatch_mode === "chat_only" || intent.dispatch_mode === "greeting") {
    const historyMessages = (sessionHistory || []).slice(-6).map((m) => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: m.text || "",
    }));
    const systemPrompt = buildSystemPrompt(roleKeywords, userContext, intent.intent_name);
    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: userText },
    ];
    let text = "";
    try {
      text = await chatCompletion(messages, { maxTokens: 256 });
    } catch (err) {
      console.error("[pipeline] chat_only LLM 失败:", err.message);
      text = lang === "th" ? "ขอโทษนะคะ ลองใหม่อีกครั้งนะคะ" : lang === "en" ? "Sorry, please try again." : "小城暂时有点忙，请稍后再试 😊";
    }
    return {
      text:            text || "小城没有理解你的问题，能换个方式说吗？",
      display_payload: null,
      suggestions:     [],
      source:          "vector_chat_only",
      intent_code:     intent.intent_code,
      dispatch_mode:   "chat_only",
    };
  }

  /* ── 3b. card_only：1 次 LLM + 前端选卡片 ────────────────────────────── */
  if (intent.dispatch_mode === "card_only") {
    const systemPrompt = buildSystemPrompt(roleKeywords, userContext, intent.intent_name);
    const cardHint = {
      zh: `（回复完后用户会看到操作入口卡片，你只需用1-2句自然语言介绍一下即可）`,
      th: `（ผู้ใช้จะเห็นการ์ดปุ่มด้านล่าง ตอบแค่ 1-2 ประโยคก็พอ）`,
      en: `(An action card will appear below your reply. Keep your response to 1-2 sentences.)`,
    }[lang];
    let text = "";
    try {
      text = await chatCompletion(
        [
          { role: "system", content: systemPrompt + "\n" + cardHint },
          { role: "user", content: userText },
        ],
        { maxTokens: 128 }
      );
    } catch (err) {
      console.error("[pipeline] card_only LLM 失败:", err.message);
    }
    return {
      text:            text || (lang === "zh" ? "好的，为您找到相关入口～" : lang === "th" ? "ค่ะ นี่คือทางเข้าที่คุณต้องการ" : "Here you go!"),
      display_payload: null,
      suggestions:     [],
      source:          "vector_card_only",
      intent_code:     intent.intent_code,
      dispatch_mode:   "card_only",
    };
  }

  /* ── 3c. tool_then_confirm：查工具 → 推确认卡片 ──────────────────────── */
  if (intent.dispatch_mode === "tool_then_confirm") {
    // after_sale_apply 等：先给出引导文案，再推确认卡片
    const confirmTexts = {
      zh: { text: "好的，您遇到了设备问题。请确认以下操作，我帮您记录并联系客服跟进。", confirmText: "确认提交", actionCode: intent.intent_code, actionText: `提交${intent.intent_name}申请` },
      th: { text: "ค่ะ คุณพบปัญหากับอุปกรณ์ กรุณายืนยันเพื่อให้ทีมงานติดตาม", confirmText: "ยืนยัน", actionCode: intent.intent_code, actionText: `ส่งคำขอ${intent.intent_name}` },
      en: { text: "Got it! Please confirm below and we'll have support follow up.", confirmText: "Confirm", actionCode: intent.intent_code, actionText: `Submit ${intent.intent_name} request` },
    }[lang];

    return {
      text:          confirmTexts.text,
      display_payload: {
        confirm_action: {
          actionCode:  confirmTexts.actionCode,
          actionText:  confirmTexts.actionText,
          confirmText: confirmTexts.confirmText,
        },
      },
      suggestions:   [],
      source:        "vector_tool_confirm",
      intent_code:   intent.intent_code,
      dispatch_mode: "tool_then_confirm",
    };
  }

  /* ── 3d. tool_then_card（主路径）：直接调工具 → LLM 摘要 ─────────────── */
  if (intent.dispatch_mode === "tool_then_card" && intent.tool_name) {
    const toolResult = await runTool(intent.tool_name, userContext);

    let finalText = await buildLLMSummary(userText, toolResult, language, intent.intent_name);
    if (!finalText?.trim()) {
      finalText = buildToolFallback(intent.tool_name, toolResult, language);
    }

    return {
      text:            finalText.trim(),
      display_payload: toolResult?.display_payload || null,
      suggestions:     [],
      source:          "vector_tool_card",
      intent_code:     intent.intent_code,
      dispatch_mode:   "tool_then_card",
      tool_used:       intent.tool_name,
    };
  }

  /* ── 3e. 兜底（tool_then_pay 或未知模式）→ chat_only 降级 ───────────── */
  const systemPrompt = buildSystemPrompt(roleKeywords, userContext, intent.intent_name);
  let text = "";
  try {
    text = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      { maxTokens: 256 }
    );
  } catch (err) {
    text = lang === "zh" ? "小城暂时有点忙，请稍后再试 😊" : "Please try again later.";
  }
  return {
    text:            text,
    display_payload: null,
    suggestions:     [],
    source:          "vector_fallback",
    intent_code:     intent.intent_code,
    dispatch_mode:   "chat_only",
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 降级路径（pgvector 不可用时）：IN_SCOPE_RE + LLM 分类器 + function calling
 * ════════════════════════════════════════════════════════════════════════════ */
async function runFallbackPipeline(userText, sessionHistory, roleKeywords, userContext) {
  console.log("[pipeline] 降级到 LLM function calling 路径");
  const language = userContext.language || "zh";
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";

  // 范围判断
  if (!IN_SCOPE_RE.test(userText)) {
    const scope = await classifyScopeFallback(userText);
    if (scope === "OUT_OF_SCOPE") {
      return {
        text:            OUT_OF_SCOPE_REPLY[lang],
        display_payload: null,
        suggestions:     [],
        source:          "fallback_out_of_scope",
        intent_code:     "out_of_scope",
        dispatch_mode:   "out_of_scope",
      };
    }
  }

  // LLM with function calling
  const systemPrompt = buildSystemPrompt(roleKeywords, userContext);
  const historyMessages = (sessionHistory || []).slice(-6).map((m) => ({
    role:    m.role === "user" ? "user" : "assistant",
    content: m.text || "",
  }));
  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userText },
  ];

  let firstResponse;
  try {
    firstResponse = await chatCompletionWithTools(messages, TOOL_DEFINITIONS);
  } catch (err) {
    console.error("[pipeline] fallback LLM 调用失败:", err.message);
    return {
      text:            lang === "zh" ? "小城暂时有点忙，请稍后再试 😊" : "Please try again later.",
      display_payload: null,
      suggestions:     [],
      source:          "error",
      dispatch_mode:   "chat_only",
    };
  }

  if (!firstResponse.tool_call) {
    return {
      text:            firstResponse.text || "小城没有理解你的问题，能换个方式说吗？",
      display_payload: null,
      suggestions:     [],
      source:          "fallback_llm_direct",
      dispatch_mode:   "chat_only",
    };
  }

  // 执行工具
  const tc = firstResponse.tool_call;
  const toolResult = await runTool(tc.name, userContext);

  // 生成最终回复
  const toolResultContent = JSON.stringify(toolResult?.tool_result || { error: toolResult?.error_message || "无数据" });
  const langName = language === "th" ? "ไทย" : language === "en" ? "English" : "中文";
  let finalText = "";
  try {
    finalText = await chatCompletion(
      [
        {
          role: "system",
          content: `你是 CityOne 助手「问问」。已查询到数据，用${langName}简短口语化回答，不超过80字。`,
        },
        {
          role: "user",
          content: `用户问：${userText}\n查询结果：${toolResultContent}\n请用${langName}回答：`,
        },
      ],
      { maxTokens: 256 }
    );
  } catch {}

  if (!finalText?.trim()) {
    finalText = buildToolFallback(tc.name, toolResult, language);
  }

  return {
    text:            finalText.trim(),
    display_payload: toolResult?.display_payload || null,
    suggestions:     [],
    source:          "fallback_llm_tool",
    tool_used:       tc.name,
    dispatch_mode:   "tool_then_card",
  };
}
