import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

const DEFAULT_TTL_SECONDS = 10 * 60;

function base64urlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function getSecret() {
  return String(
    process.env.PENDING_INTENT_SECRET ||
    process.env.JWT_SECRET ||
    "cityone-pending-intent-dev-secret"
  );
}

function signPayload(payload) {
  const encoded = base64urlEncode(normalizeJson(payload));
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const value = String(token || "").trim();
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    throw createPendingIntentError(400, "INVALID_PENDING_INTENT", "pending intent token 非法");
  }

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    throw createPendingIntentError(400, "INVALID_PENDING_INTENT", "pending intent 签名无效");
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(encoded));
  } catch {
    throw createPendingIntentError(400, "INVALID_PENDING_INTENT", "pending intent 载荷解析失败");
  }

  if (!payload || typeof payload !== "object") {
    throw createPendingIntentError(400, "INVALID_PENDING_INTENT", "pending intent 载荷无效");
  }

  const exp = Number(payload.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0 || exp * 1000 < Date.now()) {
    throw createPendingIntentError(410, "PENDING_INTENT_EXPIRED", "pending intent 已过期");
  }

  return payload;
}

export function createPendingIntentError(statusCode, errorCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
}

function buildPayload({
  intentId,
  nonce,
  userId,
  lineUserId,
  action,
  resourceId,
  returnPath,
  backPath,
  actionName,
  exp,
}) {
  return {
    intent_id: intentId,
    nonce,
    user_id: String(userId || "").trim(),
    line_user_id: String(lineUserId || "").trim(),
    action: String(action || "").trim(),
    resource_id: String(resourceId || "").trim(),
    return_path: String(returnPath || "").trim(),
    back_path: String(backPath || "").trim(),
    action_name: String(actionName || "").trim(),
    exp,
  };
}

export async function issuePendingIntent({
  userId,
  lineUserId,
  action,
  resourceId,
  returnPath,
  backPath,
  actionName = "",
  metadata = {},
  ttlSeconds = DEFAULT_TTL_SECONDS,
}) {
  const now = Date.now();
  const exp = Math.floor((now + ttlSeconds * 1000) / 1000);
  const intentId = `intent_${now}_${crypto.randomBytes(4).toString("hex")}`;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = buildPayload({
    intentId,
    nonce,
    userId,
    lineUserId,
    action,
    resourceId,
    returnPath,
    backPath,
    actionName,
    exp,
  });

  await query(
    `INSERT INTO pending_intents
       (intent_id, nonce, user_id, line_user_id, action, resource_id,
        return_path, back_path, action_name, metadata, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      intentId,
      nonce,
      payload.user_id || null,
      payload.line_user_id || null,
      payload.action,
      payload.resource_id,
      payload.return_path,
      payload.back_path,
      payload.action_name || null,
      JSON.stringify(metadata || {}),
      new Date(exp * 1000),
    ]
  );

  return {
    token: signPayload(payload),
    payload,
  };
}

function normalizeStoredJson(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function isDeviceLikeUserId(value) {
  const v = String(value || "").trim();
  return !v || v.startsWith("dev_");
}

function resolveEffectiveIdentity(row, { userId, lineUserId }) {
  const nextUserId = String(userId || "").trim();
  const nextLineUserId = String(lineUserId || "").trim();
  const storedUserId = String(row.user_id || "").trim();
  const storedLineUserId = String(row.line_user_id || "").trim();

  if (!storedUserId) {
    return {
      userId: nextUserId || nextLineUserId,
      lineUserId: nextLineUserId || nextUserId,
      shouldBind: true,
    };
  }

  if (
    isDeviceLikeUserId(storedUserId) &&
    nextUserId &&
    !isDeviceLikeUserId(nextUserId)
  ) {
    return {
      userId: nextUserId,
      lineUserId: nextLineUserId || nextUserId,
      shouldBind: true,
    };
  }

  if (nextUserId && storedUserId && nextUserId !== storedUserId) {
    throw createPendingIntentError(409, "PENDING_INTENT_USER_MISMATCH", "pending intent 与当前用户不匹配");
  }

  return {
    userId: storedUserId,
    lineUserId: storedLineUserId || nextLineUserId || storedUserId,
    shouldBind: false,
  };
}

export function decodePendingIntentToken(token) {
  return verifyToken(token);
}

export async function consumePendingIntent({
  token,
  userId,
  lineUserId,
  executor,
}) {
  const payload = verifyToken(token);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT *
         FROM pending_intents
        WHERE intent_id = $1
        FOR UPDATE`,
      [payload.intent_id]
    );
    if (!rows.length) {
      throw createPendingIntentError(404, "PENDING_INTENT_NOT_FOUND", "pending intent 不存在");
    }

    const row = rows[0];
    if (String(row.nonce || "") !== String(payload.nonce || "")) {
      throw createPendingIntentError(409, "PENDING_INTENT_NONCE_MISMATCH", "pending intent nonce 不匹配");
    }

    if (row.status === "consumed") {
      return {
        replayed: true,
        payload,
        result: normalizeStoredJson(row.result_json) || normalizeStoredJson(row.result_payload) || {},
      };
    }

    if (row.status === "failed") {
      return {
        replayed: true,
        payload,
        result: normalizeStoredJson(row.error_json) || { error: true },
      };
    }

    if (row.status !== "pending") {
      throw createPendingIntentError(409, "PENDING_INTENT_NOT_PENDING", "pending intent 状态不可消费");
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query(
        `UPDATE pending_intents
            SET status = 'expired', updated_at = NOW()
          WHERE intent_id = $1`,
        [payload.intent_id]
      );
      throw createPendingIntentError(410, "PENDING_INTENT_EXPIRED", "pending intent 已过期");
    }

    const effectiveIdentity = resolveEffectiveIdentity(row, { userId, lineUserId });
    if (effectiveIdentity.shouldBind) {
      await client.query(
        `UPDATE pending_intents
            SET user_id = $2,
                line_user_id = $3,
                updated_at = NOW()
          WHERE intent_id = $1`,
        [
          payload.intent_id,
          effectiveIdentity.userId || null,
          effectiveIdentity.lineUserId || null,
        ]
      );
    }

    const metadata = row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {};
    try {
      const executionResult = await executor({
        payload,
        row,
        metadata,
        userId: effectiveIdentity.userId,
        lineUserId: effectiveIdentity.lineUserId,
        client,
      });

      await client.query(
        `UPDATE pending_intents
            SET status = 'consumed',
                result_payload = $2,
                result_json = $2,
                error_json = NULL,
                consumed_at = NOW(),
                updated_at = NOW()
          WHERE intent_id = $1`,
        [payload.intent_id, JSON.stringify(executionResult || {})]
      );

      return {
        replayed: false,
        payload,
        result: executionResult || {},
      };
    } catch (err) {
      const errorPayload = {
        error: true,
        code: err?.errorCode || "PENDING_INTENT_EXECUTION_FAILED",
        message: err?.message || "pending intent 执行失败",
      };
      await client.query(
        `UPDATE pending_intents
            SET status = 'failed',
                error_json = $2,
                updated_at = NOW()
          WHERE intent_id = $1`,
        [payload.intent_id, JSON.stringify(errorPayload)]
      );
      throw err;
    }
  });
}
