import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import { evaluateEntropyShear, getEntropyShearConfig } from "./entropy-shear-client.js";
import { buildCityoneLineShearFacts } from "./cityone-line-shear-facts.js";

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

function createResumeKey() {
  return `rk_${crypto.randomBytes(12).toString("base64url")}`;
}

function inferTargetType(action) {
  if (action === "claim_coupon") return "coupon";
  if (action === "participate_activity") return "activity";
  if (action === "redeem_product") return "product";
  if (action === "use_benefit") return "benefit";
  return "unknown";
}

function buildPayload({
  intentId,
  nonce,
  userId,
  lineUserId,
  action,
  resourceId,
  returnPath,
  successPath,
  failPath,
  backPath,
  terminal,
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
    success_path: String(successPath || "").trim(),
    fail_path: String(failPath || "").trim(),
    back_path: String(backPath || "").trim(),
    terminal: String(terminal || "").trim(),
    action_name: String(actionName || "").trim(),
    exp,
  };
}

export async function issuePendingIntent({
  userId,
  lineUserId,
  action,
  actionType,
  resourceId,
  targetId,
  targetType,
  returnPath,
  successPath,
  failPath,
  backPath,
  terminal = "",
  terminalSource = "",
  sourceUrl = "",
  attributionParams = {},
  actionName = "",
  metadata = {},
  ttlSeconds = DEFAULT_TTL_SECONDS,
}) {
  const normalizedAction = String(action || actionType || "").trim();
  const normalizedResourceId = String(resourceId || targetId || "").trim();
  const normalizedTerminal = String(terminal || terminalSource || "").trim();
  const normalizedTargetType = String(targetType || inferTargetType(normalizedAction)).trim();
  const normalizedSourceUrl = String(sourceUrl || returnPath || "").trim();
  const normalizedAttribution = attributionParams && typeof attributionParams === "object"
    ? attributionParams
    : {};
  const now = Date.now();
  const exp = Math.floor((now + ttlSeconds * 1000) / 1000);
  const intentId = `intent_${now}_${crypto.randomBytes(4).toString("hex")}`;
  const nonce = crypto.randomBytes(16).toString("hex");
  const resumeKey = createResumeKey();
  const payload = buildPayload({
    intentId,
    nonce,
    userId,
    lineUserId,
    action: normalizedAction,
    resourceId: normalizedResourceId,
    returnPath,
    successPath,
    failPath,
    backPath,
    terminal: normalizedTerminal,
    actionName,
    exp,
  });

  await query(
    `INSERT INTO pending_intents
       (intent_id, nonce, user_id, line_user_id, action, resource_id,
        return_path, success_path, fail_path, back_path, terminal,
        action_name, metadata, expires_at, resume_key,
        target_type, source_url, attribution_params, terminal_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      intentId,
      nonce,
      payload.user_id || null,
      payload.line_user_id || null,
      payload.action,
      payload.resource_id,
      payload.return_path,
      payload.success_path || payload.return_path,
      payload.fail_path || payload.return_path,
      payload.back_path,
      payload.terminal || null,
      payload.action_name || null,
      JSON.stringify(metadata || {}),
      new Date(exp * 1000),
      resumeKey,
      normalizedTargetType,
      normalizedSourceUrl || payload.return_path,
      JSON.stringify(normalizedAttribution),
      normalizedTerminal || "unknown",
    ]
  );

  return {
    token: signPayload(payload),
    resumeKey,
    payload,
  };
}

function rebuildPayloadFromRow(row) {
  return buildPayload({
    intentId: row.intent_id,
    nonce: row.nonce,
    userId: row.user_id || "",
    lineUserId: row.line_user_id || "",
    action: row.action || "",
    resourceId: row.resource_id || "",
    returnPath: row.return_path || "/welfare",
    successPath: row.success_path || row.return_path || "/welfare",
    failPath: row.fail_path || row.return_path || "/welfare",
    backPath: row.back_path || "/welfare",
    terminal: row.terminal || "",
    actionName: row.action_name || "",
    exp: Math.floor(new Date(row.expires_at).getTime() / 1000),
  });
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

function normalizePendingIntentRow(row) {
  if (!row) return null;
  return {
    intent_id: row.intent_id,
    action_type: row.action,
    target_type: row.target_type || inferTargetType(row.action),
    target_id: row.resource_id,
    resource_id: row.resource_id,
    source_url: row.source_url || row.return_path,
    attribution_params: normalizeStoredJson(row.attribution_params) || {},
    terminal_source: row.terminal_source || row.terminal || "unknown",
    status: row.status,
    expires_at: row.expires_at,
    consumed_at: row.consumed_at,
    result: normalizeStoredJson(row.result_json) || normalizeStoredJson(row.result_payload) || null,
    last_error: row.last_error || normalizeStoredJson(row.error_json)?.message || null,
    return_path: row.return_path,
    success_path: row.success_path,
    fail_path: row.fail_path,
    back_path: row.back_path,
    user_id: row.user_id || "",
    line_user_id: row.line_user_id || "",
  };
}

function createEntropyShearAuditResult(mode, overrides = {}) {
  return {
    enabled: false,
    skipped: true,
    mode,
    verdict: null,
    reason: null,
    applied_rule_id: null,
    trace: null,
    signature: null,
    shear_id: null,
    fail_open: false,
    ...overrides,
  };
}

function logEntropyShearAudit(payload = {}) {
  console.info("[entropy-shear][audit]", payload);
}

export async function runPendingIntentEntropyShearAudit({
  row,
  payload,
  effectiveIdentity,
  providedIdentity,
  consumeKey,
  client,
  legacyFlags = {},
  deps = {},
}) {
  const getConfig = deps.getEntropyShearConfig || getEntropyShearConfig;
  const buildFacts = deps.buildCityoneLineShearFacts || buildCityoneLineShearFacts;
  const evaluate = deps.evaluateEntropyShear || evaluateEntropyShear;
  const config = getConfig();
  const mode = String(config?.mode || "audit").trim() || "audit";

  if (!config?.enabled) {
    return createEntropyShearAuditResult(mode, {
      reason: "entropy_shear_disabled",
    });
  }

  try {
    const facts = await buildFacts({
      row,
      payload,
      effectiveIdentity,
      providedIdentity,
      consumeKey,
      request: {
        method: "POST",
        consumeEndpointKind: legacyFlags.usedLegacyConsumeEndpoint === true
          ? "legacy_token_consume"
          : "intent_id_consume",
        mode,
      },
      safety: {
        isExpired: false,
        isConsumed: row?.status === "consumed",
        isExecuting: row?.status === "executing",
        isFailed: row?.status === "failed",
      },
      legacyFlags,
      client,
    });

    const result = await evaluate({
      policyKey: "cityone-line-main-chain",
      facts,
      requestId: String(payload?.intent_id || row?.intent_id || "").trim(),
      fetchImpl: deps.fetchImpl,
    });

    logEntropyShearAudit({
      intent_id: String(payload?.intent_id || row?.intent_id || "").trim(),
      action_type: String(payload?.action || row?.action || "").trim(),
      verdict: result.verdict,
      reason: result.reason,
      applied_rule_id: result.applied_rule_id,
      shear_id: result.shear_id,
      mode: result.mode || mode,
    });

    return {
      ...result,
      facts,
    };
  } catch (err) {
    const failOpen = createEntropyShearAuditResult(mode, {
      enabled: config?.enabled === true,
      reason: "entropy_shear_audit_sidecar_failed",
      fail_open: true,
      error: String(err?.message || "unknown"),
    });
    logEntropyShearAudit({
      intent_id: String(payload?.intent_id || row?.intent_id || "").trim(),
      action_type: String(payload?.action || row?.action || "").trim(),
      verdict: failOpen.verdict,
      reason: failOpen.reason,
      applied_rule_id: failOpen.applied_rule_id,
      shear_id: failOpen.shear_id,
      mode,
    });
    return failOpen;
  }
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

export async function getPendingIntentById(intentId) {
  const normalizedIntentId = String(intentId || "").trim();
  if (!normalizedIntentId) {
    throw createPendingIntentError(400, "MISSING_PENDING_INTENT_ID", "缺少 pending intent id");
  }

  const { rows } = await query(
    `SELECT *
       FROM pending_intents
      WHERE intent_id = $1
      LIMIT 1`,
    [normalizedIntentId]
  );

  if (!rows.length) {
    throw createPendingIntentError(404, "PENDING_INTENT_NOT_FOUND", "pending intent 不存在");
  }

  const row = rows[0];
  if (new Date(row.expires_at).getTime() < Date.now() && row.status !== "consumed") {
    await query(
      `UPDATE pending_intents
          SET status = 'expired',
              last_error = COALESCE(last_error, 'pending intent 已过期'),
              updated_at = NOW()
        WHERE intent_id = $1
          AND status <> 'expired'
          AND status <> 'consumed'`,
      [normalizedIntentId]
    );
    row.status = "expired";
    row.last_error = row.last_error || "pending intent 已过期";
  }

  return normalizePendingIntentRow(row);
}

export async function bindPendingIntentIdentity({
  intentId,
  userId,
  lineUserId,
}) {
  const normalizedIntentId = String(intentId || "").trim();
  const normalizedUserId = String(userId || lineUserId || "").trim();
  const normalizedLineUserId = String(lineUserId || "").trim();
  if (!normalizedIntentId) {
    throw createPendingIntentError(400, "MISSING_PENDING_INTENT_ID", "缺少 pending intent id");
  }
  if (!normalizedUserId && !normalizedLineUserId) {
    throw createPendingIntentError(400, "MISSING_LINE_IDENTITY", "缺少 LINE 身份");
  }

  const { rows } = await query(
    `UPDATE pending_intents
        SET user_id = COALESCE(NULLIF($2, ''), user_id),
            line_user_id = COALESCE(NULLIF($3, ''), line_user_id),
            status = CASE
              WHEN status = 'pending' THEN 'identified'
              ELSE status
            END,
            updated_at = NOW()
      WHERE intent_id = $1
      RETURNING *`,
    [normalizedIntentId, normalizedUserId, normalizedLineUserId]
  );
  if (!rows.length) {
    throw createPendingIntentError(404, "PENDING_INTENT_NOT_FOUND", "pending intent 不存在");
  }
  return normalizePendingIntentRow(rows[0]);
}

export async function recordPendingIntentFriendship({
  intentId,
  userId,
  lineUserId,
  friendFlag,
}) {
  const normalizedIntentId = String(intentId || "").trim();
  const normalizedUserId = String(userId || lineUserId || "").trim();
  const normalizedLineUserId = String(lineUserId || "").trim();
  const isFan = friendFlag === true;
  if (!normalizedIntentId) {
    throw createPendingIntentError(400, "MISSING_PENDING_INTENT_ID", "缺少 pending intent id");
  }

  const { rows } = await query(
    `UPDATE pending_intents
        SET user_id = COALESCE(NULLIF($2, ''), user_id),
            line_user_id = COALESCE(NULLIF($3, ''), line_user_id),
            status = CASE
              WHEN $4::boolean = false AND status IN ('pending', 'identified') THEN 'waiting_follow'
              WHEN $4::boolean = true AND status = 'waiting_follow' THEN 'identified'
              ELSE status
            END,
            updated_at = NOW()
      WHERE intent_id = $1
      RETURNING *`,
    [normalizedIntentId, normalizedUserId, normalizedLineUserId, isFan]
  );
  if (!rows.length) {
    throw createPendingIntentError(404, "PENDING_INTENT_NOT_FOUND", "pending intent 不存在");
  }

  if (normalizedLineUserId || normalizedUserId) {
    await query(
      `INSERT INTO users (user_id, line_user_id, is_fan, created_at, updated_at, last_follow_checked_at)
       VALUES ($1, NULLIF($2, ''), $3, NOW(), NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         line_user_id = COALESCE(EXCLUDED.line_user_id, users.line_user_id),
         is_fan = EXCLUDED.is_fan,
         updated_at = NOW(),
         last_follow_checked_at = NOW()`,
      [normalizedUserId || normalizedLineUserId, normalizedLineUserId, isFan]
    ).catch(() => {});
  }

  return normalizePendingIntentRow(rows[0]);
}

export async function findLatestPendingIntent({
  userId,
  lineUserId,
}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedLineUserId = String(lineUserId || "").trim();
  if (!normalizedUserId && !normalizedLineUserId) return null;

  const params = [];
  const where = [`status = 'pending'`, `expires_at > NOW()`];

  if (normalizedUserId && normalizedLineUserId) {
    params.push(normalizedUserId, normalizedLineUserId);
    where.push(`(user_id = $${params.length - 1} OR line_user_id = $${params.length})`);
  } else if (normalizedUserId) {
    params.push(normalizedUserId);
    where.push(`user_id = $${params.length}`);
  } else {
    params.push(normalizedLineUserId);
    where.push(`line_user_id = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT *
       FROM pending_intents
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 1`,
    params
  );

  if (!rows.length) return null;

  const row = rows[0];
  const payload = rebuildPayloadFromRow(row);
  return {
    token: signPayload(payload),
    payload,
  };
}

export async function resolvePendingIntentResumeKey(resumeKey) {
  const key = String(resumeKey || "").trim();
  if (!key) {
    throw createPendingIntentError(400, "MISSING_PENDING_RESUME_KEY", "缺少 pending intent resume key");
  }

  const { rows } = await query(
    `SELECT *
       FROM pending_intents
      WHERE resume_key = $1
      LIMIT 1`,
    [key]
  );

  if (!rows.length) {
    throw createPendingIntentError(404, "PENDING_RESUME_KEY_NOT_FOUND", "pending intent resume key 不存在");
  }

  const row = rows[0];
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw createPendingIntentError(410, "PENDING_INTENT_EXPIRED", "pending intent 已过期");
  }

  const payload = rebuildPayloadFromRow(row);
  return {
    token: signPayload(payload),
    resumeKey: key,
    payload,
  };
}

export async function consumePendingIntent({
  token,
  intentId,
  consumeKey,
  userId,
  lineUserId,
  executor,
  deps = {},
}) {
  const verifyPendingIntentToken = deps.verifyToken || verifyToken;
  const runInTransaction = deps.withTransaction || withTransaction;
  const payload = token
    ? verifyPendingIntentToken(token)
    : null;
  const effectiveIntentId = String(intentId || payload?.intent_id || "").trim();
  if (!effectiveIntentId) {
    throw createPendingIntentError(400, "MISSING_PENDING_INTENT_ID", "缺少 pending intent id");
  }

  return runInTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT *
         FROM pending_intents
        WHERE intent_id = $1
        FOR UPDATE`,
      [effectiveIntentId]
    );
    if (!rows.length) {
      throw createPendingIntentError(404, "PENDING_INTENT_NOT_FOUND", "pending intent 不存在");
    }

    const row = rows[0];
    if (payload && String(row.nonce || "") !== String(payload.nonce || "")) {
      throw createPendingIntentError(409, "PENDING_INTENT_NONCE_MISMATCH", "pending intent nonce 不匹配");
    }
    const runtimePayload = payload || rebuildPayloadFromRow(row);

    if (row.status === "consumed") {
      return {
        replayed: true,
        payload: runtimePayload,
        result: normalizeStoredJson(row.result_json) || normalizeStoredJson(row.result_payload) || {},
      };
    }

    if (row.status === "failed") {
      return {
        replayed: true,
        payload: runtimePayload,
        result: normalizeStoredJson(row.error_json) || { error: true },
      };
    }

    if (row.status === "executing") {
      const executingAt = row.executing_at ? new Date(row.executing_at).getTime() : 0;
      const isStale = !executingAt || Date.now() - executingAt > 60 * 1000;
      if (!isStale) {
        return {
          replayed: true,
          payload: runtimePayload,
          result: {
            pending: true,
            code: "PENDING_INTENT_EXECUTING",
            message: "pending intent 正在处理中",
          },
        };
      }
    }

    const consumableStatuses = new Set(["pending", "identified", "waiting_follow", "executing"]);
    if (!consumableStatuses.has(row.status)) {
      throw createPendingIntentError(409, "PENDING_INTENT_NOT_CONSUMABLE", "pending intent 状态不可消费");
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query(
        `UPDATE pending_intents
            SET status = 'expired',
                last_error = 'pending intent 已过期',
                updated_at = NOW()
          WHERE intent_id = $1`,
        [runtimePayload.intent_id]
      );
      throw createPendingIntentError(410, "PENDING_INTENT_EXPIRED", "pending intent 已过期");
    }

    let effectiveIdentity = null;
    let identityMismatch = false;
    let identityError = null;
    try {
      effectiveIdentity = resolveEffectiveIdentity(row, { userId, lineUserId });
    } catch (err) {
      if (err?.errorCode === "PENDING_INTENT_USER_MISMATCH") {
        identityMismatch = true;
        identityError = err;
        effectiveIdentity = {
          userId: String(row.user_id || "").trim(),
          lineUserId: String(row.line_user_id || "").trim(),
          shouldBind: false,
        };
      } else {
        throw err;
      }
    }

    await runPendingIntentEntropyShearAudit({
      row,
      payload: runtimePayload,
      effectiveIdentity,
      providedIdentity: {
        userId,
        lineUserId,
      },
      consumeKey,
      client,
      legacyFlags: {
        usedLegacyConsumeEndpoint: !!token && !intentId,
        malformedConsume: false,
        identityMismatch,
        usedResumeKey: false,
      },
      deps,
    });

    if (identityError) {
      throw identityError;
    }

    if (effectiveIdentity.shouldBind) {
      await client.query(
        `UPDATE pending_intents
            SET user_id = $2,
                line_user_id = $3,
                updated_at = NOW()
          WHERE intent_id = $1`,
        [
          runtimePayload.intent_id,
          effectiveIdentity.userId || null,
          effectiveIdentity.lineUserId || null,
        ]
      );
    }

    const normalizedConsumeKey = String(consumeKey || `consume:${runtimePayload.intent_id}`).trim();
    await client.query(
      `UPDATE pending_intents
          SET status = 'executing',
              executing_at = NOW(),
              consume_key = COALESCE(consume_key, NULLIF($2, '')),
              updated_at = NOW()
        WHERE intent_id = $1`,
      [runtimePayload.intent_id, normalizedConsumeKey]
    );

    const metadata = row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {};
    try {
      const executionResult = await executor({
        payload: runtimePayload,
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
        [runtimePayload.intent_id, JSON.stringify(executionResult || {})]
      );

      return {
        replayed: false,
        payload: runtimePayload,
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
                last_error = $3,
                updated_at = NOW()
          WHERE intent_id = $1`,
        [runtimePayload.intent_id, JSON.stringify(errorPayload), errorPayload.message]
      );
      return {
        replayed: true,
        payload: runtimePayload,
        result: errorPayload,
      };
    }
  });
}
