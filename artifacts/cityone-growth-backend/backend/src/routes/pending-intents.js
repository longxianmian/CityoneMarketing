import { claimCouponTx } from "./coupons.js";
import { participateActivityTx } from "./activities.js";
import {
  consumePendingIntent,
  createPendingIntentError,
  issuePendingIntent,
} from "../services/pending-intent-service.js";

const SUPPORTED_ACTIONS = new Set([
  "claim_coupon",
  "participate_activity",
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

        throw createPendingIntentError(400, "UNSUPPORTED_PENDING_ACTION", "不支持的 pending intent 动作");
      },
    });

    return sendOk(res, sendJson, consumed.replayed ? "pending intent replayed" : "pending intent consumed", {
      replayed: consumed.replayed,
      payload: consumed.payload,
      result: consumed.result,
    });
  } catch (err) {
    return sendError(
      res,
      sendJson,
      err.statusCode || 500,
      err.errorCode || "PENDING_INTENT_CONSUME_FAILED",
      err.message || "pending intent 消费失败"
    );
  }
}
