/**
 * routes/agent.js
 *
 * AI Agent 全部接口：
 *   用户端：session/init, messages, message, confirm, capabilities, quick-prompts
 *   管理端：admin/agent/config, intents, tools, logs, metrics
 */

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
import { recognizeIntent } from "../services/agent-intent-service.js";
import { checkPolicy, POLICY_RESULTS } from "../services/agent-policy-service.js";
import { routeAndExecute } from "../services/agent-tool-router.js";
import { buildReply } from "../services/agent-reply-service.js";
import { writeAgentLog, queryAgentLogs, computeAgentMetrics } from "../services/agent-log-service.js";
import {
  loadAgentConfig, saveAgentConfig,
  loadAgentIntents, saveAgentIntents
} from "../services/agent-config-service.js";
import { generateReplyText, checkLLMHealth } from "../services/agent-llm-service.js";

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
      return sendError(res, sendJson, 503, "AGENT_DISABLED", "AI 助理暂时关闭");
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

    // 2. 意图识别（LLM优先，关键词兜底；传入当前身份可用意图白名单）
    const intentResult = await recognizeIntent(text, language, {
      site_id: session.site_id,
      entry_type: session.entry_type,
      entry_code: session.entry_code,
      allowed_intents: identity.capabilities
    });

    // 3. 权限检查
    const policyResult = checkPolicy(identity.identity_tier, intentResult.intent_code, intentResult.need_confirm);

    // 4. 工具执行（如果允许）
    let toolResult = null;
    let toolResultStatus = "skipped";

    if (policyResult.result === POLICY_RESULTS.ALLOWED) {
      toolResult = await routeAndExecute(intentResult.intent_code, intentResult.slots, {
        line_user_id: session.line_user_id,
        user_id: session.user_id,
        identity_tier: identity.identity_tier,
        language,
        site_id: session.site_id
      });
      toolResultStatus = toolResult ? (toolResult.success ? "success" : "error") : "info_only";
    } else {
      toolResultStatus = policyResult.result;
    }

    // 5. 构建结构化回复（rule-based 骨架：cards + suggestions）
    const replyPayload = buildReply({
      intentCode: intentResult.intent_code,
      toolResult,
      identityTier: identity.identity_tier,
      language,
      policyResult
    });

    // 6. LLM 生成自然语言回复文本（替换 rule-based 文本，仅在允许执行时使用）
    if (policyResult.result === POLICY_RESULTS.ALLOWED && intentResult.intent_code !== "unknown") {
      try {
        const recentMsgs = getSessionMessages(sessionId, 6);
        const history = recentMsgs.map((m) => `${m.role === "user" ? "用户" : "助理"}: ${m.text}`);
        const llmText = await generateReplyText(
          intentResult.intent_code,
          toolResult,
          identity.identity_tier,
          language,
          history
        );
        if (llmText && llmText.trim()) replyPayload.text = llmText.trim();
      } catch {
        // LLM 生成失败，保留 rule-based 文本
      }
    }

    // 7. 写入 Agent 回复消息
    const agentMsg = addMessage({
      sessionId,
      role: "agent",
      type: replyPayload.reply_type || "tool_result",
      text: replyPayload.text,
      intentCode: intentResult.intent_code,
      payload: replyPayload
    });

    // 7b. 更新会话最近活跃时间
    touchSession(sessionId);

    // 7. 记录日志
    writeAgentLog({
      sessionId,
      messageId: userMsg.message_id,
      lineUserId: session.line_user_id,
      userId: session.user_id,
      identityTier: identity.identity_tier,
      inputText: text,
      intentCode: intentResult.intent_code,
      intentConfidence: intentResult.confidence,
      toolCode: toolResult?.tool_code || "",
      toolResultStatus,
      needConfirm: intentResult.need_confirm,
      finalAction: policyResult.result
    });

    return sendOk(res, sendJson, "message processed", {
      user_message_id: userMsg.message_id,
      agent_message_id: agentMsg.message_id,
      intent: {
        code: intentResult.intent_code,
        name: intentResult.intent_name,
        confidence: intentResult.confidence,
        recognition_mode: intentResult.recognition_mode || "unknown"
      },
      identity_tier: identity.identity_tier,
      policy_result: policyResult.result,
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
