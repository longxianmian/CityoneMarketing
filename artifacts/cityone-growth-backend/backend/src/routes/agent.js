/**
 * routes/agent.js
 *
 * AI Agent 全部接口：
 *   用户端：session/init, messages, message, confirm, capabilities, quick-prompts
 *   管理端：admin/agent/config, intents, tools, logs, metrics
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __agentFilename = fileURLToPath(import.meta.url);
const __agentDirname  = path.dirname(__agentFilename);
const AGENT_DATA_DIR  = path.join(__agentDirname, "..", "..", "data");

function loadJsonData(filename, defaultValue = []) {
  const fp = path.join(AGENT_DATA_DIR, filename);
  if (!fs.existsSync(fp)) return defaultValue;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return defaultValue; }
}

import {
  createSession,
  getSession,
  getOrCreateSession,
  getLatestActiveSession,
  touchSession,
  addMessage,
  getSessionMessages
} from "../services/agent-session-service.js";
import { resolveAgentIdentity } from "../services/agent-identity-service.js";
import { writeAgentLog, queryAgentLogs, computeAgentMetrics } from "../services/agent-log-service.js";
import {
  loadAgentConfig, saveAgentConfig,
  loadAgentIntents, saveAgentIntents
} from "../services/agent-config-service.js";
import { checkLLMHealth } from "../services/agent-llm-service.js";
import { runLLMPipeline } from "../services/agent-llm-pipeline.js";
import { checkPolicy, POLICY_RESULTS } from "../services/agent-policy-service.js";

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function sessionIdFromPath(pathname) {
  return pathname.match(/^\/api\/agent\/session\/([^/]+)/)?.[1] || "";
}

// ─── 用户端接口 ──────────────────────────────────────────────────────────────

/**
 * POST /api/agent/session/init
 * 初始化会话，返回身份、能力、欢迎语、快捷问题
 */
export async function handleAgentSessionInit(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const lineUserId = String(body.line_user_id || "").trim();
    const language = String(body.language || "zh").trim();
    const siteId = String(body.site_id || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryCode = String(body.entry_code || "").trim();

    // 解析身份
    const identityParams = {
      line_user_id: lineUserId,
      user_id: body.user_id || "",
      site_id: siteId,
      entry_type: entryType,
      entry_code: entryCode,
      is_oa_followed: !!lineUserId,
      user_stage_code: lineUserId
        ? (body.user_id ? "identified_user" : "oa_followed_registered")
        : "visitor_unfollowed"
    };
    const identity = resolveAgentIdentity(identityParams);

    // 加载配置
    const config = loadAgentConfig();
    if (!config.enabled) {
      return sendError(res, sendJson, 503, "AGENT_DISABLED", "小城暂时关闭，请稍后再试。");
    }

    const welcomeText = config.welcome_messages?.[language] || config.welcome_messages?.zh;
    const quickPrompts = config.quick_prompts?.[language] || config.quick_prompts?.zh || [];

    // 优先恢复最近活跃会话，没有则创建新会话
    const { session, restored } = getOrCreateSession({
      lineUserId,
      userId: body.user_id || "",
      siteId,
      entryType,
      entryCode,
      language,
      identityTier: identity.identity_tier,
      scene: "agent_main"
    });

    // 只在全新会话时写入欢迎消息
    if (!restored) {
      addMessage({
        sessionId: session.session_id,
        role: "agent",
        type: "welcome",
        text: welcomeText,
        intentCode: "session_init",
        payload: {
          reply_type: "welcome",
          text: welcomeText,
          cards: [],
          suggestions: quickPrompts.slice(0, 4)
        }
      });
    }

    // 返回最近 50 条消息（恢复场景）
    const messages = getSessionMessages(session.session_id, 50);

    return sendOk(res, sendJson, "agent session initialized", {
      session_id: session.session_id,
      restored,
      identity_tier: identity.identity_tier,
      identity_label: identity.identity_label,
      member_level: identity.member_level,
      capabilities: identity.capabilities,
      available_tools: identity.available_tools,
      quick_prompts: quickPrompts.slice(0, 4),
      welcome_message: welcomeText,
      messages
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "SESSION_INIT_FAILED", err.message || "会话初始化失败");
  }
}

/**
 * GET /api/agent/session/latest?line_user_id=xxx
 * 获取该用户最近活跃会话（前端无本地 session_id 时用于恢复）
 */
export function handleAgentSessionLatest(req, res, url, sendJson) {
  try {
    const lineUserId = url.searchParams.get("line_user_id") || "";
    if (!lineUserId) return sendError(res, sendJson, 400, "MISSING_USER_ID", "line_user_id 必填");
    const session = getLatestActiveSession(lineUserId, "agent_main");
    if (!session) return sendOk(res, sendJson, "no active session", { session: null, messages: [] });
    const messages = getSessionMessages(session.session_id, 50);
    return sendOk(res, sendJson, "session restored", { session, messages });
  } catch (err) {
    return sendError(res, sendJson, 500, "SESSION_LATEST_FAILED", err.message || "查询失败");
  }
}

/**
 * GET /api/agent/session/:sessionId/messages
 * 获取会话历史消息
 */
export function handleAgentGetMessages(req, res, url, sendJson) {
  try {
    const sessionId = sessionIdFromPath(url.pathname);
    if (!sessionId) return sendError(res, sendJson, 400, "SESSION_ID_REQUIRED", "session_id 必填");

    const session = getSession(sessionId);
    if (!session) return sendError(res, sendJson, 404, "SESSION_NOT_FOUND", "未找到会话");

    const limit = Number(url.searchParams.get("limit") || 50);
    const messages = getSessionMessages(sessionId, limit);

    return sendOk(res, sendJson, "messages loaded", { session, messages, count: messages.length });
  } catch (err) {
    return sendError(res, sendJson, 500, "GET_MESSAGES_FAILED", err.message || "获取消息失败");
  }
}

/**
 * POST /api/agent/session/:sessionId/message
 * 发送用户消息，返回 Agent 结构化回复
 */
export async function handleAgentSendMessage(req, res, url, sendJson, readBody) {
  try {
    const sessionId = sessionIdFromPath(url.pathname);
    if (!sessionId) return sendError(res, sendJson, 400, "SESSION_ID_REQUIRED", "session_id 必填");

    const session = getSession(sessionId);
    if (!session) return sendError(res, sendJson, 404, "SESSION_NOT_FOUND", "未找到会话");

    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) return sendError(res, sendJson, 400, "TEXT_REQUIRED", "text 必填");

    const language = body.language || session.language || "zh";

    // 写入用户消息
    const userMsg = addMessage({ sessionId, role: "user", text });

    // 1. 解析身份
    const identity = resolveAgentIdentity({
      line_user_id: session.line_user_id,
      user_id: session.user_id,
      site_id: session.site_id,
      entry_type: session.entry_type,
      entry_code: session.entry_code,
      is_oa_followed: !!session.line_user_id,
      user_stage_code: session.user_id ? "identified_user" : (session.line_user_id ? "oa_followed_registered" : "visitor_unfollowed")
    });

    // 2. 加载角色关键词（管理端配置）
    const allKeywords = loadJsonData("agent-role-keywords.json", []);
    const roleKeywords = allKeywords.find((k) => k.agent_code === "wenwen" && k.language === language)
      || allKeywords.find((k) => k.agent_code === "wenwen" && k.language === "zh")
      || {};

    // 3. 加载历史消息（最近 8 条）
    const sessionHistory = getSessionMessages(sessionId, 8);

    // 4. LLM Function Calling 主管道
    //    关键词模板检查 → LLM 自主调工具 → 工具执行 → LLM 生成回复
    const userContext = {
      language,
      identity_tier: identity.identity_tier,
      line_user_id:  session.line_user_id || "",
      user_id:       session.user_id || "",
      site_id:       session.site_id || "",
    };

    const pipelineResult = await runLLMPipeline(text, sessionHistory, roleKeywords, userContext);

    // 5a. 权限策略检查：pipeline 识别 intent 后才能判断是否允许
    const recognizedIntent = pipelineResult.intent_code || "";
    const policyResult = checkPolicy(identity.identity_tier, recognizedIntent);

    if (policyResult.result === POLICY_RESULTS.NEED_FOLLOW) {
      const INTENT_LABELS = {
        zh: {
          points_balance_query: "查询积分余额", coupon_list_query: "查看我的卡券",
          coupon_recommend: "领取优惠卡券", recent_orders_query: "查看订单记录",
          points_balance_redeem: "积分兑换", benefit_claim_query: "查看专属福利",
          invite_poster_generate: "生成邀请海报", member_rights_query: "查看会员权益",
          activity_query: "参与活动", after_sale_apply: "申请售后",
        },
        th: {
          points_balance_query: "ดูคะแนน", coupon_list_query: "ดูคูปองของฉัน",
          coupon_recommend: "รับคูปอง", recent_orders_query: "ดูประวัติออเดอร์",
          points_balance_redeem: "แลกคะแนน", benefit_claim_query: "รับสิทธิพิเศษ",
          invite_poster_generate: "สร้างโปสเตอร์ชวนเพื่อน", member_rights_query: "ดูสิทธิสมาชิก",
          activity_query: "เข้าร่วมกิจกรรม", after_sale_apply: "ขอบริการหลังขาย",
        },
        en: {
          points_balance_query: "check points balance", coupon_list_query: "view my coupons",
          coupon_recommend: "claim coupons", recent_orders_query: "view order history",
          points_balance_redeem: "redeem points", benefit_claim_query: "view exclusive benefits",
          invite_poster_generate: "generate invite poster", member_rights_query: "view member rights",
          activity_query: "join activities", after_sale_apply: "apply for after-sales",
        },
      };
      const langLabels = INTENT_LABELS[language] || INTENT_LABELS.zh;
      const intentLabel = langLabels[recognizedIntent] || (language === "th" ? "ฟีเจอร์นี้" : language === "en" ? "this feature" : "该功能");
      const followText = {
        zh: `需要先关注 CityOne LINE OA 才能${intentLabel}。关注后马上可以使用！`,
        th: `กรุณาติดตาม CityOne LINE OA ก่อนเพื่อ${intentLabel}`,
        en: `Please follow CityOne LINE OA first to ${intentLabel}.`,
      }[language] || `需要先关注 CityOne LINE OA 才能使用该功能。`;

      const agentMsg = addMessage({
        sessionId, role: "agent", type: "follow_required",
        text: followText, intentCode: recognizedIntent,
        payload: { reply_type: "follow_required", text: followText, intent_code: recognizedIntent }
      });
      touchSession(sessionId);
      writeAgentLog({
        sessionId, messageId: userMsg.message_id,
        lineUserId: session.line_user_id, userId: session.user_id,
        identityTier: identity.identity_tier, inputText: text,
        intentCode: recognizedIntent, intentConfidence: 1,
        toolCode: "", toolResultStatus: "blocked_need_follow",
        needConfirm: false, finalAction: "need_follow"
      });
      return sendOk(res, sendJson, "message processed", {
        user_message_id: userMsg.message_id,
        agent_message_id: agentMsg.message_id,
        intent: { code: recognizedIntent, name: recognizedIntent, confidence: 1, recognition_mode: pipelineResult.source || "llm" },
        identity_tier: identity.identity_tier,
        policy_result: "need_follow",
        reply: {
          reply_type: "follow_required",
          text: followText,
          intent_code: recognizedIntent,
          dispatch_mode: "blocked",
          suggestions: [],
          confirm_action: null,
        }
      });
    }

    // 5. 构建回复 payload（支持向量召回新字段）
    const dispatchMode = pipelineResult.dispatch_mode || "chat_only";
    const hasConfirmAction = !!pipelineResult.display_payload?.confirm_action;
    // 透传工具结果卡片（raw backend 格式，前端 normalizeMessage 负责映射）
    const toolCards = Array.isArray(pipelineResult.display_payload?.cards)
      ? pipelineResult.display_payload.cards
      : [];
    const replyPayload = {
      reply_type:      hasConfirmAction
                         ? "confirm_request"
                         : (toolCards.length > 0 ? "tool_result" : "text"),
      text:            pipelineResult.text || "",
      cards:           toolCards,           // ← 前端 buildAIMessages 读 reply.cards
      display_payload: pipelineResult.display_payload || null,
      suggestions:     pipelineResult.suggestions || [],
      source:          pipelineResult.source || "llm",
      intent_code:     pipelineResult.intent_code || "",
      dispatch_mode:   dispatchMode,
      // 确认卡片字段（tool_then_confirm 时）
      confirm_action:  pipelineResult.display_payload?.confirm_action || null,
    };

    // 6. 写入 Agent 回复消息
    const agentMsg = addMessage({
      sessionId,
      role:       "agent",
      type:       replyPayload.reply_type,
      text:       replyPayload.text,
      intentCode: pipelineResult.intent_code || pipelineResult.tool_used || "llm",
      payload:    replyPayload
    });

    // 更新会话最近活跃时间
    touchSession(sessionId);

    // 7. 记录日志
    writeAgentLog({
      sessionId,
      messageId:        userMsg.message_id,
      lineUserId:       session.line_user_id,
      userId:           session.user_id,
      identityTier:     identity.identity_tier,
      inputText:        text,
      intentCode:       pipelineResult.intent_code || pipelineResult.tool_used || "llm",
      intentConfidence: 1,
      toolCode:         pipelineResult.tool_used || "",
      toolResultStatus: pipelineResult.source || "llm",
      needConfirm:      false,
      finalAction:      "allowed"
    });

    return sendOk(res, sendJson, "message processed", {
      user_message_id: userMsg.message_id,
      agent_message_id: agentMsg.message_id,
      intent: {
        code: pipelineResult.intent_code || pipelineResult.tool_used || "llm",
        name: pipelineResult.tool_used || "llm",
        confidence: 1,
        recognition_mode: pipelineResult.source || "llm"
      },
      identity_tier: identity.identity_tier,
      policy_result: "allowed",
      reply: replyPayload
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "MESSAGE_FAILED", err.message || "消息处理失败");
  }
}

/**
 * POST /api/agent/session/:sessionId/confirm
 * 对需要二次确认的动作做确认并执行
 */
export async function handleAgentConfirm(req, res, url, sendJson, readBody) {
  try {
    const sessionId = sessionIdFromPath(url.pathname);
    if (!sessionId) return sendError(res, sendJson, 400, "SESSION_ID_REQUIRED", "session_id 必填");

    const session = getSession(sessionId);
    if (!session) return sendError(res, sendJson, 404, "SESSION_NOT_FOUND", "未找到会话");

    const body = await readBody(req);
    const intentCode = String(body.intent_code || "").trim();
    const confirmed = !!body.confirmed;
    const language = body.language || session.language || "zh";

    if (!confirmed) {
      const replyPayload = {
        reply_type: "text",
        text: { zh: "已取消，有其他问题随时告诉我。", th: "ยกเลิกแล้ว", en: "Cancelled. Feel free to ask anything else." }[language],
        cards: [],
        suggestions: []
      };
      addMessage({ sessionId, role: "agent", text: replyPayload.text, intentCode: "confirm_cancelled", replyPayload });
      return sendOk(res, sendJson, "confirm cancelled", { reply: replyPayload });
    }

    // 确认后执行工具
    const identity = resolveAgentIdentity({
      line_user_id: session.line_user_id,
      user_id: session.user_id,
      site_id: session.site_id,
      entry_type: session.entry_type,
      entry_code: session.entry_code,
      is_oa_followed: !!session.line_user_id,
      user_stage_code: session.user_id ? "identified_user" : (session.line_user_id ? "oa_followed_registered" : "visitor_unfollowed")
    });

    const toolResult = await routeAndExecute(intentCode, body.slots || {}, {
      line_user_id: session.line_user_id,
      user_id: session.user_id,
      identity_tier: identity.identity_tier,
      language
    });

    const replyPayload = buildReply({ intentCode, toolResult, identityTier: identity.identity_tier, language, policyResult: { result: "allowed" } });
    addMessage({ sessionId, role: "agent", text: replyPayload.text, intentCode: `${intentCode}_confirmed`, replyPayload });

    writeAgentLog({
      sessionId, lineUserId: session.line_user_id, userId: session.user_id,
      identityTier: identity.identity_tier, inputText: `[CONFIRM] ${intentCode}`,
      intentCode, intentConfidence: 1, toolCode: toolResult?.tool_code || "",
      toolResultStatus: toolResult?.success ? "success" : "error",
      needConfirm: false, finalAction: "confirmed_executed"
    });

    return sendOk(res, sendJson, "confirm executed", { reply: replyPayload });
  } catch (err) {
    return sendError(res, sendJson, 500, "CONFIRM_FAILED", err.message || "确认执行失败");
  }
}

/**
 * GET /api/agent/capabilities
 * 获取当前用户可用能力（无需会话）
 */
export async function handleAgentCapabilities(req, res, url, sendJson) {
  try {
    const lineUserId = url.searchParams.get("line_user_id") || "";
    const userId = url.searchParams.get("user_id") || "";
    const identity = resolveAgentIdentity({
      line_user_id: lineUserId,
      user_id: userId,
      is_oa_followed: !!lineUserId,
      user_stage_code: userId ? "identified_user" : (lineUserId ? "oa_followed_registered" : "visitor_unfollowed")
    });
    return sendOk(res, sendJson, "capabilities loaded", {
      identity_tier: identity.identity_tier,
      identity_label: identity.identity_label,
      capabilities: identity.capabilities,
      available_tools: identity.available_tools
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "CAPABILITIES_FAILED", err.message || "获取能力失败");
  }
}

/**
 * GET /api/agent/quick-prompts
 * 获取快捷问题
 */
export function handleAgentQuickPrompts(req, res, url, sendJson) {
  const language = url.searchParams.get("language") || "zh";
  const config = loadAgentConfig();
  const prompts = config.quick_prompts?.[language] || config.quick_prompts?.zh || [];
  return sendOk(res, sendJson, "quick prompts loaded", { language, prompts });
}

// ─── 管理端接口 ──────────────────────────────────────────────────────────────

export function handleAdminAgentConfigGet(req, res, url, sendJson) {
  return sendOk(res, sendJson, "agent config loaded", loadAgentConfig());
}

export async function handleAdminAgentConfigUpdate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const current = loadAgentConfig();
    const updated = { ...current };

    if (body.enabled !== undefined) updated.enabled = !!body.enabled;
    if (body.welcome_messages) updated.welcome_messages = { ...current.welcome_messages, ...body.welcome_messages };
    if (body.quick_prompts) updated.quick_prompts = { ...current.quick_prompts, ...body.quick_prompts };
    if (body.identity_rules) updated.identity_rules = { ...current.identity_rules, ...body.identity_rules };
    if (body.tool_switches) updated.tool_switches = { ...current.tool_switches, ...body.tool_switches };

    saveAgentConfig(updated);
    return sendOk(res, sendJson, "agent config updated", updated);
  } catch (err) {
    return sendError(res, sendJson, 500, "CONFIG_UPDATE_FAILED", err.message || "配置更新失败");
  }
}

export function handleAdminAgentIntentsGet(req, res, url, sendJson) {
  return sendOk(res, sendJson, "agent intents loaded", loadAgentIntents());
}

export async function handleAdminAgentIntentsUpdate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const intents = loadAgentIntents();

    // 支持更新单个意图的 enabled + phrases
    const intentCode = String(body.intent_code || "").trim();
    if (!intentCode) return sendError(res, sendJson, 400, "INTENT_CODE_REQUIRED", "intent_code 必填");

    const idx = intents.findIndex((i) => i.intent_code === intentCode);
    if (idx < 0) return sendError(res, sendJson, 404, "INTENT_NOT_FOUND", "未找到该意图");

    if (body.enabled !== undefined) intents[idx].enabled = !!body.enabled;
    if (body.phrases) intents[idx].phrases = { ...intents[idx].phrases, ...body.phrases };
    if (body.need_confirm !== undefined) intents[idx].need_confirm = !!body.need_confirm;

    saveAgentIntents(intents);
    return sendOk(res, sendJson, "intent updated", intents[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "INTENT_UPDATE_FAILED", err.message || "意图更新失败");
  }
}

export function handleAdminAgentToolsGet(req, res, url, sendJson) {
  const config = loadAgentConfig();
  return sendOk(res, sendJson, "tool switches loaded", config.tool_switches || {});
}

export async function handleAdminAgentToolsUpdate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const config = loadAgentConfig();
    const toolSwitches = { ...(config.tool_switches || {}) };

    for (const [k, v] of Object.entries(body)) {
      toolSwitches[k] = !!v;
    }

    config.tool_switches = toolSwitches;
    saveAgentConfig(config);
    return sendOk(res, sendJson, "tool switches updated", toolSwitches);
  } catch (err) {
    return sendError(res, sendJson, 500, "TOOL_UPDATE_FAILED", err.message || "工具开关更新失败");
  }
}

export function handleAdminAgentLogsGet(req, res, url, sendJson) {
  const sessionId = url.searchParams.get("sessionId") || "";
  const lineUserId = url.searchParams.get("lineUserId") || "";
  const intentCode = url.searchParams.get("intentCode") || "";
  const limit = Number(url.searchParams.get("limit") || 50);
  const offset = Number(url.searchParams.get("offset") || 0);
  const result = queryAgentLogs({ sessionId, lineUserId, intentCode, limit, offset });
  return sendOk(res, sendJson, "agent logs loaded", result);
}

export function handleAdminAgentMetricsGet(req, res, url, sendJson) {
  const metrics = computeAgentMetrics();
  return sendOk(res, sendJson, "agent metrics loaded", metrics);
}

/**
 * GET /api/agent/llm/health
 * 检查 LLM 是否可用
 */
export async function handleAgentLLMHealth(req, res, url, sendJson) {
  try {
    const result = await checkLLMHealth();
    return sendOk(res, sendJson, "llm health checked", result);
  } catch (err) {
    return sendError(res, sendJson, 500, "LLM_HEALTH_FAILED", err.message || "LLM 健康检查失败");
  }
}
