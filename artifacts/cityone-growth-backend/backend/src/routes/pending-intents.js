// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止动作恢复重新回到首页/个人中心 fallback。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimCouponTx } from "./coupons.js";
import { exchangeCouponForMallItemTx } from "./coupons.js";
import { participateActivityTx } from "./activities.js";
import { redeemMallItemTx } from "./mall-items.js";
import { useBenefitTx } from "./products.js";
import { query } from "../db/pool.js";
import {
  bindPendingIntentIdentity,
  consumePendingIntent,
  createPendingIntentError,
  decodePendingIntentToken,
  findLatestPendingIntent,
  getPendingIntentById,
  issuePendingIntent,
  recordPendingIntentFriendship,
  resolvePendingIntentResumeKey,
} from "../services/pending-intent-service.js";

// 先读规范再改代码：
// - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
// - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
//
// 强约束：
// - 执行型动作只能由 pending-intents/consume 在服务端统一执行
// - 不允许前端页面自己 claim / participate / redeem / use
// - result nextPath 必须服从 open-in-line / continue 主链，不回退旧首页恢复器

const SUPPORTED_ACTIONS = new Set([
  "claim_coupon",
  "participate_activity",
  "redeem_product",
  "use_benefit",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LINE_CONFIG_FILE = path.join(__dirname, "..", "..", "data", "line-config.json");

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}

function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}

function normalizePath(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) {
    throw createPendingIntentError(400, "INVALID_PENDING_INTENT_PATH", "pending intent 路径必须以 / 开头");
  }
  return raw;
}

function normalizeMetadata(body = {}) {
  return {
    source: body.source && typeof body.source === "object" ? body.source : {},
  };
}

function classifyTerminal(userAgent = "") {
  const ua = String(userAgent || "");
  if (/Line\//i.test(ua) || / LIFF/i.test(ua)) return "line_client";
  if (/MicroMessenger/i.test(ua)) return "wechat_webview";
  if (/CriOS|Chrome/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return "safari";
  return "unknown";
}

function logPendingIntent(event, payload = {}) {
  try {
    console.info(`[pending-intent] ${JSON.stringify({ event, ...payload })}`);
  } catch {
    console.info(`[pending-intent] ${event}`);
  }
}

function inferTargetType(action) {
  if (action === "claim_coupon") return "coupon";
  if (action === "participate_activity") return "activity";
  if (action === "redeem_product") return "product";
  if (action === "use_benefit") return "benefit";
  return "unknown";
}

function readLineChannelId() {
  const fromEnv = String(
    process.env.LINE_LOGIN_CHANNEL_ID ||
    process.env.LINE_CHANNEL_ID ||
    process.env.LINE_CLIENT_ID ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;
  try {
    const cfg = JSON.parse(fs.readFileSync(LINE_CONFIG_FILE, "utf8"));
    return String(cfg.channelId || cfg.channel_id || "").trim();
  } catch {
    return "";
  }
}

function readLineLiffId() {
  const fromEnv = String(
    process.env.LINE_LIFF_ID ||
    process.env.VITE_LINE_LIFF_ID ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;
  try {
    const cfg = JSON.parse(fs.readFileSync(LINE_CONFIG_FILE, "utf8"));
    return String(cfg.liffId || cfg.liff_id || "").trim();
  } catch {
    return "";
  }
}

function buildLiffContinueUrl(intentId) {
  const liffId = readLineLiffId();
  const normalizedIntentId = String(intentId || "").trim();
  if (!liffId || !normalizedIntentId) return "";
  return `https://liff.line.me/${liffId}/continue?intent=${encodeURIComponent(normalizedIntentId)}`;
}

async function verifyLineIdToken(idToken) {
  const token = String(idToken || "").trim();
  const channelId = readLineChannelId();
  if (!token) {
    throw createPendingIntentError(400, "MISSING_LINE_ID_TOKEN", "缺少 LINE ID Token");
  }
  if (!channelId) {
    throw createPendingIntentError(500, "LINE_CHANNEL_NOT_CONFIGURED", "LINE Login Channel ID 未配置");
  }

  const params = new URLSearchParams();
  params.set("id_token", token);
  params.set("client_id", channelId);

  const resp = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.sub) {
    throw createPendingIntentError(401, "LINE_ID_TOKEN_VERIFY_FAILED", data?.error_description || "LINE ID Token 验证失败");
  }
  return data;
}

function buildPendingIntentExecutor() {
  return async ({ payload, metadata, userId, lineUserId, client }) => {
    if (payload.action === "claim_coupon") {
      const claimResult = await claimCouponTx(client, {
        userId,
        lineUserId,
        couponId: payload.resource_id,
        source: metadata.source || {},
      });
      return {
        action: payload.action,
        nextPath: payload.success_path || payload.return_path,
        resultCode: claimResult?.alreadyClaimed ? "already_claimed" : "claimed",
        action_result: claimResult,
      };
    }

    if (payload.action === "participate_activity") {
      const activityResult = await participateActivityTx(client, {
        activityId: payload.resource_id,
        userId,
        lineUserId,
        source: metadata.source || {},
      });
      return {
        action: payload.action,
        nextPath: payload.success_path || payload.return_path,
        resultCode: activityResult?.alreadyJoined ? "already_joined" : "joined",
        action_result: activityResult,
      };
    }

    if (payload.action === "redeem_product") {
      const source = metadata.source || {};
      const hasCouponSource = String(source.coupon_id || "").trim();
      let redeemResult;
      if (hasCouponSource) {
        redeemResult = await exchangeCouponForMallItemTx(client, {
          userId,
          lineUserId,
          couponId: String(source.coupon_id || "").trim(),
          userProductId: String(source.user_product_id || "").trim(),
          requestedItemId: payload.resource_id,
          deliveryType: source.delivery_type || null,
          deliveryName: source.delivery_name || null,
          deliveryPhone: source.delivery_phone || null,
          deliveryAddress: source.delivery_address || null,
          deliveryStationId: source.delivery_station_id || null,
        });
      } else {
        redeemResult = await redeemMallItemTx(client, {
          userId,
          lineUserId,
          itemId: payload.resource_id,
          source,
          deliveryType: source.delivery_type || null,
          deliveryName: source.delivery_name || null,
          deliveryPhone: source.delivery_phone || null,
          deliveryAddress: source.delivery_address || null,
          deliveryStationId: source.delivery_station_id || null,
        });
      }
      if (redeemResult?.error) {
        throw createPendingIntentError(
          redeemResult.error.code || 400,
          redeemResult.error.key || "REDEEM_PRODUCT_FAILED",
          redeemResult.error.msg || "商品兑换失败"
        );
      }
      return {
        action: payload.action,
        nextPath: payload.success_path || payload.return_path,
        resultCode: redeemResult?.result ? "redeemed" : "redeem_completed",
        action_result: redeemResult,
      };
    }

    if (payload.action === "use_benefit") {
      const source = metadata.source || {};
      const useResult = await useBenefitTx({
        userProductId: String(source.user_product_id || payload.resource_id || "").trim(),
        stationId: String(source.station_id || "").trim(),
        bridgeStatus: String(source.bridge_status || "completed").trim(),
      });
      return {
        action: payload.action,
        nextPath: payload.success_path || payload.return_path,
        resultCode: useResult?.product_status === "used" ? "used" : "use_completed",
        action_result: useResult,
      };
    }

    throw createPendingIntentError(400, "UNSUPPORTED_PENDING_ACTION", "不支持的 pending intent 动作");
  };
}

export async function handlePendingIntentIssue(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const action = String(body.action || body.action_type || "").trim();
    if (!SUPPORTED_ACTIONS.has(action)) {
      return sendError(res, sendJson, 400, "UNSUPPORTED_PENDING_ACTION", "不支持的 pending intent 动作");
    }

    const resourceId = String(body.resource_id || body.target_id || "").trim();
    if (!resourceId) {
      return sendError(res, sendJson, 400, "MISSING_RESOURCE_ID", "缺少 resource_id");
    }

    const userId = String(body.user_id || body.line_user_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    const sourceUrl = String(body.source_url || body.return_path || "").trim();
    const returnPath = normalizePath(body.return_path || sourceUrl || "/welfare", "/welfare");
    const successPath = normalizePath(body.success_path || returnPath, returnPath);
    const failPath = normalizePath(body.fail_path || returnPath, returnPath);
    const backPath = normalizePath(body.back_path || returnPath.split("?")[0], "/welfare");
    const actionName = String(body.action_name || "").trim();
    const attributionParams = body.attribution_params && typeof body.attribution_params === "object"
      ? body.attribution_params
      : {};
    const metadata = {
      ...normalizeMetadata(body),
      attribution_params: attributionParams,
    };
    const terminal = String(body.terminal_source || body.terminal || "").trim() || classifyTerminal(req.headers["user-agent"]);

    const issued = await issuePendingIntent({
      userId,
      lineUserId,
      action,
      resourceId,
      targetType: String(body.target_type || inferTargetType(action)).trim(),
      sourceUrl,
      attributionParams,
      returnPath,
      successPath,
      failPath,
      backPath,
      terminal,
      actionName,
      metadata,
    });

    logPendingIntent("CITYONE_INTENT_CREATED", {
      intent_id: issued.payload.intent_id,
      action_type: issued.payload.action,
      terminal,
      line_user_id: lineUserId || "",
      canonical_user_id: userId || "",
      consume_status: "pending",
      result_code: 200,
    });

    return sendOk(res, sendJson, "pending intent issued", {
      intent_id: issued.payload.intent_id,
      continue_url: `/welfare/continue?intent=${encodeURIComponent(issued.payload.intent_id)}`,
      liff_continue_url: buildLiffContinueUrl(issued.payload.intent_id),
      expires_at: new Date(issued.payload.exp * 1000).toISOString(),
      token: issued.token,
      resume_key: issued.resumeKey,
      payload: issued.payload,
    });
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_ISSUE_FAILED",
      err.message || "pending intent 创建失败"
    );
  }
}

export async function handlePendingIntentConsume(req, res, url, sendJson, readBody) {
  let token = "";
  let currentUserId = "";
  let currentLineUserId = "";
  try {
    const body = await readBody(req);
    token = String(body.token || "").trim();
    if (!token) {
      return sendError(res, sendJson, 400, "MISSING_PENDING_TOKEN", "缺少 pending intent token");
    }

    currentUserId = String(body.user_id || body.line_user_id || "").trim();
    currentLineUserId = String(body.line_user_id || "").trim();
    const terminal = classifyTerminal(req.headers["user-agent"]);
    const decoded = decodePendingIntentToken(token);

    logPendingIntent("consume_start", {
      intent_id: decoded.intent_id,
      action_type: decoded.action,
      terminal,
      line_user_id: currentLineUserId || decoded.line_user_id || "",
      canonical_user_id: currentUserId || decoded.user_id || "",
      consume_status: "started",
      result_code: 0,
    });

    const consumed = await consumePendingIntent({
      token,
      userId: currentUserId,
      lineUserId: currentLineUserId,
      executor: buildPendingIntentExecutor(),
    });

    logPendingIntent("consume_done", {
      intent_id: consumed.payload.intent_id,
      action_type: consumed.payload.action,
      terminal,
      line_user_id: currentLineUserId || consumed.payload.line_user_id || "",
      canonical_user_id: currentUserId || consumed.payload.user_id || "",
      consume_status: consumed.replayed ? "replayed" : "consumed",
      result_code: consumed.result?.resultCode || 200,
    });

    return sendOk(res, sendJson, consumed.replayed ? "pending intent replayed" : "pending intent consumed", {
      replayed: consumed.replayed,
      payload: consumed.payload,
      result: consumed.result,
    });
  } catch (err) {
    const decoded = token ? decodePendingIntentToken(token) : null;
    logPendingIntent("consume_error", {
      intent_id: decoded?.intent_id || "",
      action_type: decoded?.action || "",
      terminal: classifyTerminal(req.headers["user-agent"]),
      line_user_id: currentLineUserId || decoded?.line_user_id || "",
      canonical_user_id: currentUserId || decoded?.user_id || "",
      consume_status: "failed",
      result_code: err.statusCode || 500,
    });
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_CONSUME_FAILED",
      err.message || "pending intent 消费失败"
    );
  }
}

export async function handlePendingIntentGet(req, res, url, sendJson, intentId) {
  try {
    const data = await getPendingIntentById(intentId);
    return sendOk(res, sendJson, "pending intent loaded", data);
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_FETCH_FAILED",
      err.message || "pending intent 查询失败"
    );
  }
}

export async function handlePendingIntentConsumeById(req, res, url, sendJson, readBody, intentId) {
  let currentUserId = "";
  let currentLineUserId = "";
  try {
    const body = await readBody(req);
    currentUserId = String(body.user_id || body.line_user_id || "").trim();
    currentLineUserId = String(body.line_user_id || "").trim();
    const consumeKey = String(body.idempotency_key || body.consume_key || `consume:${intentId}`).trim();
    const terminal = classifyTerminal(req.headers["user-agent"]);

    const intent = await getPendingIntentById(intentId);
    logPendingIntent("CITYONE_INTENT_CONSUME_START", {
      intent_id: intent.intent_id,
      action_type: intent.action_type,
      target_type: intent.target_type,
      target_id: intent.target_id,
      terminal_source: terminal,
      user_id: currentUserId || intent.user_id || "",
      line_user_id: currentLineUserId || intent.line_user_id || "",
      intent_status: intent.status,
    });

    const consumed = await consumePendingIntent({
      intentId,
      consumeKey,
      userId: currentUserId || intent.user_id || "",
      lineUserId: currentLineUserId || intent.line_user_id || "",
      executor: buildPendingIntentExecutor(),
    });

    logPendingIntent(consumed.replayed ? "CITYONE_INTENT_CONSUME_DUPLICATE" : "CITYONE_INTENT_CONSUME_SUCCESS", {
      intent_id: consumed.payload.intent_id,
      action_type: consumed.payload.action,
      terminal_source: terminal,
      user_id: currentUserId || consumed.payload.user_id || "",
      line_user_id: currentLineUserId || consumed.payload.line_user_id || "",
      intent_status: consumed.replayed ? "replayed" : "consumed",
      consume_result: consumed.result?.resultCode || consumed.result?.code || 200,
    });

    return sendOk(res, sendJson, consumed.replayed ? "pending intent replayed" : "pending intent consumed", {
      replayed: consumed.replayed,
      payload: consumed.payload,
      result: consumed.result,
    });
  } catch (err) {
    logPendingIntent("CITYONE_INTENT_FAILED", {
      intent_id: intentId || "",
      terminal_source: classifyTerminal(req.headers["user-agent"]),
      user_id: currentUserId,
      line_user_id: currentLineUserId,
      error_code: err.errorCode || "PENDING_INTENT_CONSUME_FAILED",
    });
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_CONSUME_FAILED",
      err.message || "pending intent 消费失败"
    );
  }
}

export async function handleLineIdentitySync(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const intentId = String(body.intent_id || body.intent || "").trim();
    const idToken = String(body.id_token || "").trim();
    const verified = await verifyLineIdToken(idToken);
    const lineUserId = String(verified.sub || "").trim();
    const displayName = String(verified.name || "").trim();
    const pictureUrl = String(verified.picture || "").trim();
    const userId = lineUserId;

    await query(
      `INSERT INTO users (user_id, line_user_id, display_name, picture_url, created_at, updated_at, last_identified_at)
       VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NOW(), NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         line_user_id = COALESCE(EXCLUDED.line_user_id, users.line_user_id),
         display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
         picture_url = COALESCE(NULLIF(EXCLUDED.picture_url, ''), users.picture_url),
         updated_at = NOW(),
         last_identified_at = NOW()`,
      [userId, lineUserId, displayName, pictureUrl]
    ).catch(() => {});

    let intent = null;
    if (intentId) {
      intent = await bindPendingIntentIdentity({ intentId, userId, lineUserId });
    }
    const userRes = await query(
      `SELECT is_fan, identity_level
         FROM users
        WHERE user_id = $1 OR line_user_id = $1
        LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    const userRow = userRes.rows?.[0] || {};

    logPendingIntent("CITYONE_IDENTITY_SYNCED", {
      intent_id: intentId,
      user_id: userId,
      line_user_id: lineUserId,
      intent_status: intent?.status || "",
    });

    return sendOk(res, sendJson, "line identity synced", {
      user_id: userId,
      line_user_id: lineUserId,
      identity_level: userRow.identity_level || "visitor",
      is_fan: userRow.is_fan === true,
      profile: {
        display_name: displayName,
        picture_url: pictureUrl,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "LINE_IDENTITY_SYNC_FAILED",
      err.message || "LINE 身份同步失败"
    );
  }
}

export async function handleLineFriendshipCheck(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const intentId = String(body.intent_id || body.intent || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    const userId = String(body.user_id || lineUserId || "").trim();
    const friendFlag = body.friendFlag === true || body.friend_flag === true || body.is_fan === true;
    const intent = await recordPendingIntentFriendship({
      intentId,
      userId,
      lineUserId,
      friendFlag,
    });

    logPendingIntent("CITYONE_FRIENDSHIP_CHECKED", {
      intent_id: intentId,
      action_type: intent.action_type,
      target_type: intent.target_type,
      target_id: intent.target_id,
      user_id: userId,
      line_user_id: lineUserId,
      friendFlag,
      intent_status: intent.status,
    });
    if (!friendFlag) {
      logPendingIntent("CITYONE_FOLLOW_REQUIRED", {
        intent_id: intentId,
        user_id: userId,
        line_user_id: lineUserId,
        redirect_to: `/welfare/follow?intent=${encodeURIComponent(intentId)}`,
      });
    }

    return sendOk(res, sendJson, "line friendship checked", {
      is_fan: friendFlag,
      source: String(body.source || "liff"),
      checked_at: new Date().toISOString(),
      intent_status: intent.status,
    });
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "LINE_FRIENDSHIP_CHECK_FAILED",
      err.message || "LINE 关注状态记录失败"
    );
  }
}

export async function handlePendingIntentResume(req, res, url, sendJson) {
  try {
    const resumeKey = String(url.searchParams.get("resume_key") || url.searchParams.get("key") || "").trim();
    const resolved = await resolvePendingIntentResumeKey(resumeKey);
    return sendOk(res, sendJson, "pending intent resume resolved", {
      token: resolved.token,
      resume_key: resolved.resumeKey,
      payload: resolved.payload,
    });
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_RESUME_FAILED",
      err.message || "pending intent resume key 解析失败"
    );
  }
}

export async function handlePendingIntentLatest(req, res, url, sendJson) {
  try {
    const userId = String(url.searchParams.get("user_id") || "").trim();
    const lineUserId = String(url.searchParams.get("line_user_id") || "").trim();
    if (!userId && !lineUserId) {
      return sendError(res, sendJson, 400, "MISSING_PENDING_IDENTITY", "缺少 user_id 或 line_user_id");
    }

    const latest = await findLatestPendingIntent({ userId, lineUserId });
    return sendOk(res, sendJson, latest ? "pending intent found" : "pending intent not found", latest);
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_FETCH_FAILED",
      err.message || "pending intent 查询失败"
    );
  }
}
