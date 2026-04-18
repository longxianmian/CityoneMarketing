import { claimCouponTx } from "./coupons.js";
import { exchangeCouponForMallItemTx } from "./coupons.js";
import { participateActivityTx } from "./activities.js";
import { redeemMallItemTx } from "./mall-items.js";
import { useBenefitTx } from "./products.js";
import {
  consumePendingIntent,
  createPendingIntentError,
  decodePendingIntentToken,
  issuePendingIntent,
} from "../services/pending-intent-service.js";

const SUPPORTED_ACTIONS = new Set([
  "claim_coupon",
  "participate_activity",
  "redeem_product",
  "use_benefit",
]);

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

export async function handlePendingIntentIssue(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const action = String(body.action || "").trim();
    if (!SUPPORTED_ACTIONS.has(action)) {
      return sendError(res, sendJson, 400, "UNSUPPORTED_PENDING_ACTION", "不支持的 pending intent 动作");
    }

    const resourceId = String(body.resource_id || "").trim();
    if (!resourceId) {
      return sendError(res, sendJson, 400, "MISSING_RESOURCE_ID", "缺少 resource_id");
    }

    const userId = String(body.user_id || body.line_user_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    const returnPath = normalizePath(body.return_path, "/welfare");
    const backPath = normalizePath(body.back_path || returnPath.split("?")[0], "/welfare");
    const actionName = String(body.action_name || "").trim();
    const metadata = normalizeMetadata(body);

    const issued = await issuePendingIntent({
      userId,
      lineUserId,
      action,
      resourceId,
      returnPath,
      backPath,
      actionName,
      metadata,
    });

    logPendingIntent("issued", {
      intent_id: issued.payload.intent_id,
      action_type: issued.payload.action,
      terminal: classifyTerminal(req.headers["user-agent"]),
      line_user_id: lineUserId || "",
      canonical_user_id: userId || "",
      consume_status: "pending",
      result_code: 200,
    });

    return sendOk(res, sendJson, "pending intent issued", {
      token: issued.token,
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
  try {
    const body = await readBody(req);
    const token = String(body.token || "").trim();
    if (!token) {
      return sendError(res, sendJson, 400, "MISSING_PENDING_TOKEN", "缺少 pending intent token");
    }

    const currentUserId = String(body.user_id || body.line_user_id || "").trim();
    const currentLineUserId = String(body.line_user_id || "").trim();
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
      executor: async ({ payload, metadata, userId, lineUserId, client }) => {
        if (payload.action === "claim_coupon") {
          const claimResult = await claimCouponTx(client, {
            userId,
            lineUserId,
            couponId: payload.resource_id,
            source: metadata.source || {},
          });
          return {
            action: payload.action,
            redirect_path: payload.back_path,
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
            redirect_path: payload.back_path,
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
            redirect_path: payload.back_path,
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
            redirect_path: payload.back_path,
            action_result: useResult,
          };
        }

        throw createPendingIntentError(400, "UNSUPPORTED_PENDING_ACTION", "不支持的 pending intent 动作");
      },
    });

    logPendingIntent("consume_done", {
      intent_id: consumed.payload.intent_id,
      action_type: consumed.payload.action,
      terminal,
      line_user_id: currentLineUserId || consumed.payload.line_user_id || "",
      canonical_user_id: currentUserId || consumed.payload.user_id || "",
      consume_status: consumed.replayed ? "replayed" : "consumed",
      result_code: 200,
    });

    return sendOk(res, sendJson, consumed.replayed ? "pending intent replayed" : "pending intent consumed", {
      replayed: consumed.replayed,
      payload: consumed.payload,
      result: consumed.result,
    });
  } catch (err) {
    const token = err?.token || "";
    const decoded = token ? decodePendingIntentToken(token) : null;
    logPendingIntent("consume_error", {
      intent_id: decoded?.intent_id || "",
      action_type: decoded?.action || "",
      terminal: classifyTerminal(req.headers["user-agent"]),
      line_user_id: String((req.body && req.body.line_user_id) || decoded?.line_user_id || ""),
      canonical_user_id: String((req.body && (req.body.user_id || req.body.line_user_id)) || decoded?.user_id || ""),
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
