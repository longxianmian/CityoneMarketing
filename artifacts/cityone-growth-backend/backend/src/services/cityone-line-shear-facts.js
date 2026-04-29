import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LINE_CONFIG_FILE = path.join(__dirname, "..", "..", "data", "line-config.json");

function isDeviceLikeUserId(value) {
  const v = String(value || "").trim();
  return !v || v.startsWith("dev_");
}

function readRequireFollow() {
  const envValue = String(process.env.LINE_REQUIRE_FOLLOW || "").trim().toLowerCase();
  if (envValue === "true" || envValue === "1" || envValue === "yes") return true;
  if (envValue === "false" || envValue === "0" || envValue === "no") return false;

  try {
    const config = JSON.parse(fs.readFileSync(LINE_CONFIG_FILE, "utf8"));
    if (typeof config?.requireFollow === "boolean") {
      return config.requireFollow;
    }
  } catch {
    // ignore
  }

  return true;
}

async function resolveUserFanState(client, effectiveIdentity = {}) {
  const candidates = [
    String(effectiveIdentity.lineUserId || "").trim(),
    String(effectiveIdentity.userId || "").trim(),
  ].filter(Boolean);
  if (!client || !candidates.length) {
    return {
      userIsFanDb: false,
      friendshipSource: "none",
    };
  }

  try {
    const { rows } = await client.query(
      `SELECT is_fan
         FROM users
        WHERE user_id = ANY($1::text[]) OR line_user_id = ANY($1::text[])
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1`,
      [candidates]
    );
    const row = rows?.[0] || null;
    const userIsFanDb = row?.is_fan === true;
    return {
      userIsFanDb,
      friendshipSource: userIsFanDb ? "users.is_fan" : "none",
    };
  } catch {
    return {
      userIsFanDb: false,
      friendshipSource: "query_failed",
    };
  }
}

export async function buildCityoneLineShearFacts({
  row,
  payload,
  effectiveIdentity,
  providedIdentity = {},
  consumeKey = "",
  request = {},
  safety = {},
  legacyFlags = {},
  client,
} = {}) {
  const requireFollow = readRequireFollow();
  const now = Date.now();
  const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  const friendshipState = await resolveUserFanState(client, effectiveIdentity);
  const identityMismatch = legacyFlags.identityMismatch === true;
  const identityBound = !!(
    String(effectiveIdentity?.userId || row?.user_id || "").trim() ||
    String(effectiveIdentity?.lineUserId || row?.line_user_id || "").trim()
  );
  const friendshipConfirmed = requireFollow === false || friendshipState.userIsFanDb === true || row?.status === "identified";
  const isExpired = safety.isExpired === true || (!!expiresAt && expiresAt < now);
  const isConsumed = safety.isConsumed === true || row?.status === "consumed";
  const isExecuting = safety.isExecuting === true || row?.status === "executing";
  const isFailed = safety.isFailed === true || row?.status === "failed";
  const mainlineReady = isExpired !== true
    && isConsumed !== true
    && isExecuting !== true
    && isFailed !== true
    && identityBound === true
    && identityMismatch !== true
    && friendshipConfirmed === true;

  return {
    request: {
      request_method: String(request.method || "POST").trim() || "POST",
      consume_endpoint_kind: String(
        request.consumeEndpointKind ||
        (legacyFlags.usedLegacyConsumeEndpoint ? "legacy_token_consume" : "intent_id_consume")
      ).trim(),
      consume_key: String(consumeKey || "").trim(),
      mode: String(request.mode || "audit").trim() || "audit",
    },
    pending_intent: {
      intent_id: String(payload?.intent_id || row?.intent_id || "").trim(),
      action_type: String(payload?.action || row?.action || "").trim(),
      status: String(row?.status || "").trim(),
      target_type: String(row?.target_type || "").trim(),
      target_id: String(payload?.resource_id || row?.resource_id || "").trim(),
      source_url: String(row?.source_url || row?.return_path || "").trim(),
      terminal_source: String(row?.terminal_source || row?.terminal || "").trim(),
      expires_at: row?.expires_at ? new Date(row.expires_at).toISOString() : null,
      consumed_at: row?.consumed_at ? new Date(row.consumed_at).toISOString() : null,
      has_resume_key: !!String(row?.resume_key || "").trim(),
    },
    identity: {
      stored_user_id: String(row?.user_id || "").trim(),
      stored_line_user_id: String(row?.line_user_id || "").trim(),
      provided_user_id: String(providedIdentity.userId || "").trim(),
      provided_line_user_id: String(providedIdentity.lineUserId || "").trim(),
      effective_user_id: String(effectiveIdentity?.userId || "").trim(),
      effective_line_user_id: String(effectiveIdentity?.lineUserId || "").trim(),
      identity_bound: identityBound,
      identity_mismatch: identityMismatch,
      identity_ready: identityBound === true && identityMismatch !== true,
      device_like_identity: isDeviceLikeUserId(effectiveIdentity?.userId || row?.user_id || ""),
    },
    friendship: {
      require_follow: requireFollow,
      user_is_fan_db: friendshipState.userIsFanDb,
      friendship_confirmed: friendshipConfirmed,
      follow_unconfirmed: requireFollow === true && friendshipConfirmed !== true,
      friendship_source: friendshipState.friendshipSource,
      pending_intent_status: String(row?.status || "").trim(),
    },
    safety: {
      is_expired: isExpired,
      is_consumed: isConsumed,
      is_executing: isExecuting,
      is_failed: isFailed,
      mainline_ready: mainlineReady,
    },
    legacy_flags: {
      used_legacy_consume_endpoint: legacyFlags.usedLegacyConsumeEndpoint === true,
      malformed_consume: legacyFlags.malformedConsume === true,
      has_resume_key: !!String(row?.resume_key || "").trim(),
      used_resume_key: legacyFlags.usedResumeKey === true,
    },
  };
}
