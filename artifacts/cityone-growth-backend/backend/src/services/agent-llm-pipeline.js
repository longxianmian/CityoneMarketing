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

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  工具架构（两层设计，参考阿里店小蜜 / OpenAI GPT Actions 方案）          │
 * │                                                                         │
 * │  Layer 1 - 平台知识层（无状态，运营新增内容自动生效，无需改代码）         │
 * │    search_platform_content  扫描优惠券/活动/积分商城等所有公开内容       │
 * │                                                                         │
 * │  Layer 2 - 用户私有数据层（有状态，需身份验证）                          │
 * │    get_user_account         积分余额 + 钱包券（合并为一次查询）          │
 * │    query_nearby_stations    附近站点（位置相关）                         │
 * │    generate_invite_link     生成邀请链接（动作类）                       │
 * │    get_user_orders          订单历史                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { execute as platformSearch } from "./agent-tools/tool-platform-search.js";
import { execute as userAccount }    from "./agent-tools/tool-user-account.js";
import { execute as nearBySites }    from "./agent-tools/tool-nearby-sites.js";
import { execute as invitePoster }   from "./agent-tools/tool-invite-poster.js";
import { execute as orderQuery }     from "./agent-tools/tool-order-query.js";

/* ─── 工具函数定义（5 工具，职责清晰）─────────────────────────────────────── */
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_platform_content",
      description: [
        "查询平台公开内容：优惠券活动、营销活动、积分商城商品。",
        "当用户询问【优惠/活动/折扣/有什么券可以领/今天有什么/商城有什么/福利】时调用。",
        "接受可选 query 参数做关键词筛选，不传则返回全部当前有效内容。",
        "มีโปรโมชัน / มีส่วนลดไหม / Any promotions / What deals are available → 调用此工具。",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "可选关键词，如 '耳机' '充电' 'coupon'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_account",
      description: [
        "查询用户私有账户信息：积分余额、已领券包、推荐券。",
        "当用户询问【我的积分/我有多少分/我的券/钱包/账户/会员】时调用。",
        "คะแนนของฉัน / My points / My coupons / My wallet → 调用此工具。",
      ].join(" "),
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_nearby_stations",
      description: "查询附近可借用共享充电宝的站点位置和库存。 สถานีใกล้เคียง / Nearby stations.",
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
      name: "generate_invite_link",
      description: "生成用户专属邀请链接和分享文案，邀请好友注册/使用充电宝获取奖励。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_orders",
      description: "查询用户最近的充电宝借还订单记录、消费历史。 ประวัติออเดอร์ / Order history.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/* ─── 工具执行映射 ────────────────────────────────────────────────────────── */
const TOOL_EXECUTOR = {
  search_platform_content: (args, ctx) => platformSearch(args, ctx),
  get_user_account:        (args, ctx) => userAccount(args, ctx),
  query_nearby_stations:   (args, ctx) => nearBySites(args, ctx),
  generate_invite_link:    (args, ctx) => invitePoster(args, ctx),
  get_user_orders:         (args, ctx) => orderQuery(args, ctx),
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
    "【工具调用规则】需要查询任何数据时必须调用对应工具，严禁猜测或编造数据。尤其是：",
    "  - 用户询问优惠/活动/折扣/有什么券 → 必须调用 query_available_coupons",
    "  - 用户询问我的积分/余额 → 必须调用 query_points_balance",
    "  - 用户询问我有什么券/我的券包 → 必须调用 query_coupons",
    "  - 用户询问附近站点/哪里可以借 → 必须调用 query_nearby_stations",
    "工具返回数据后，用简短自然语言摘要要点，不要重复工具原始数据。",
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
  }

  // 兜底：若 LLM 摘要为空，根据工具和数据生成有意义的回复
  if (!finalText?.trim()) {
    finalText = buildToolFallback(tc.name, toolResult, language);
  }

  return {
    text:            finalText.trim(),
    display_payload: toolResult?.display_payload || null,
    suggestions:     [],
    source:          "llm_tool",
    tool_used:       tc.name,
  };
}

/* ─── 工具兜底文案（LLM 摘要为空时使用，对应新 5 工具架构）─────────────── */
function buildToolFallback(toolName, toolResult, language) {
  const res = toolResult?.tool_result || {};
  const ok  = toolResult?.success !== false;
  const lang = ["zh", "th", "en"].includes(language) ? language : "zh";

  const T = {
    /* ── Layer 1: 平台知识层 ── */
    search_platform_content: {
      zh: ok
        ? ((res.total ?? 0) > 0
          ? `平台目前有${res.coupon_count > 0 ? ` ${res.coupon_count} 张优惠券` : ""}${res.activity_count > 0 ? `、${res.activity_count} 个活动` : ""}${res.mall_count > 0 ? `、${res.mall_count} 件商城商品` : ""}，快去福利中心看看吧～`
          : "平台目前暂无进行中的优惠活动，请稍后再来哦。")
        : "优惠查询暂时不可用，请稍后再试。",
      th: ok
        ? ((res.total ?? 0) > 0 ? `มีโปรโมชัน ${res.total} รายการตอนนี้ ไปดูที่ศูนย์สวัสดิการเลย!` : "ยังไม่มีโปรโมชันที่กำลังดำเนินอยู่")
        : "ไม่สามารถดึงข้อมูลโปรโมชันได้",
      en: ok
        ? ((res.total ?? 0) > 0 ? `There are ${res.total} active promotion(s) now. Head to the Benefits Center!` : "No active promotions at the moment.")
        : "Promotion query unavailable.",
    },

    /* ── Layer 2: 用户私有数据层 ── */
    get_user_account: {
      zh: ok
        ? `您当前可用积分 ${res.points?.available_points ?? 0} 分` +
          (res.wallet?.count > 0 ? `，钱包里有 ${res.wallet.count} 张可用券` : "") +
          (res.prizes?.count > 0 ? `，另有 ${res.prizes.count} 张活动奖品` : "") +
          ((res.wallet?.count || 0) + (res.prizes?.count || 0) === 0 ? "，暂无可用卡券。" : "。")
        : "账户信息查询暂时不可用，请稍后再试。",
      th: ok
        ? `คะแนนที่ใช้ได้ ${res.points?.available_points ?? 0} คะแนน` +
          (res.wallet?.count > 0 ? ` มีคูปอง ${res.wallet.count} ใบ` : "") +
          (res.prizes?.count > 0 ? ` มีของรางวัล ${res.prizes.count} รายการ` : "") +
          ((res.wallet?.count || 0) + (res.prizes?.count || 0) === 0 ? " ยังไม่มีคูปอง" : "")
        : "ไม่สามารถดึงข้อมูลบัญชีได้",
      en: ok
        ? `You have ${res.points?.available_points ?? 0} points` +
          (res.wallet?.count > 0 ? `, ${res.wallet.count} coupon(s) in wallet` : "") +
          (res.prizes?.count > 0 ? `, ${res.prizes.count} activity prize(s)` : "") +
          ((res.wallet?.count || 0) + (res.prizes?.count || 0) === 0 ? ", no coupons yet." : ".")
        : "Account query unavailable.",
    },
    query_nearby_stations: {
      zh: ok ? (res.total > 0 ? `附近共有 ${res.total} 个站点，可快速借还充电宝。` : "附近暂时没有找到站点信息。") : "站点查询暂时不可用。",
      th: ok ? (res.total > 0 ? `พบสถานี ${res.total} แห่งในบริเวณใกล้เคียง` : "ยังไม่พบสถานีในบริเวณใกล้เคียง") : "ไม่สามารถดึงข้อมูลสถานีได้",
      en: ok ? (res.total > 0 ? `Found ${res.total} station(s) nearby.` : "No stations found nearby.") : "Station query unavailable.",
    },
    generate_invite_link: {
      zh: ok ? "已为您生成专属邀请链接，分享给好友即可获得奖励～" : "邀请链接生成失败，请稍后再试。",
      th: ok ? "สร้างลิงก์เชิญเฉพาะของคุณแล้ว แชร์ให้เพื่อนเพื่อรับรางวัล" : "ไม่สามารถสร้างลิงก์เชิญได้",
      en: ok ? "Your invite link is ready. Share it with friends to earn rewards!" : "Failed to generate invite link.",
    },
    get_user_orders: {
      zh: ok ? (res.total > 0 ? `您最近共有 ${res.total} 条订单记录。` : "暂时没有找到最近的订单记录。") : "订单查询暂时不可用。",
      th: ok ? (res.total > 0 ? `มีประวัติออเดอร์ ${res.total} รายการ` : "ยังไม่มีประวัติออเดอร์") : "ไม่สามารถดึงข้อมูลออเดอร์ได้",
      en: ok ? (res.total > 0 ? `You have ${res.total} recent order(s).` : "No recent orders found.") : "Order query unavailable.",
    },
  };

  const generic = ok
    ? { zh: "已为您查询完毕～", th: "ดึงข้อมูลเรียบร้อยแล้ว", en: "Query complete." }
    : { zh: "查询暂时不可用，请稍后再试。", th: "ไม่สามารถดึงข้อมูลได้", en: "Query unavailable, please try again." };

  return T[toolName]?.[lang] ?? generic[lang];
}
