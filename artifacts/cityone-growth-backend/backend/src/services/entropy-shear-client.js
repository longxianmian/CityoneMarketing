const DEFAULT_MODE = "audit";
const DEFAULT_TIMEOUT_MS = 800;
const DEFAULT_POLICY_VERSION = "cityone-line-main-chain.v1";

function readBoolEnv(name, fallback = false) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function readIntEnv(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getEntropyShearConfig() {
  return {
    enabled: readBoolEnv("ENTROPY_SHEAR_ENABLED", false),
    baseUrl: String(process.env.ENTROPY_SHEAR_URL || "").trim(),
    mode: String(process.env.ENTROPY_SHEAR_MODE || DEFAULT_MODE).trim() || DEFAULT_MODE,
    timeoutMs: readIntEnv("ENTROPY_SHEAR_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    policyVersion: String(process.env.ENTROPY_SHEAR_POLICY_VERSION || DEFAULT_POLICY_VERSION).trim() || DEFAULT_POLICY_VERSION,
  };
}

function normalizeShearPayload(payload = {}) {
  return {
    verdict: payload.verdict ?? null,
    reason: String(payload.reason || payload.message || "").trim() || null,
    applied_rule_id: String(payload.applied_rule_id || payload.rule_id || "").trim() || null,
    trace: payload.trace ?? null,
    signature: payload.signature ?? null,
    shear_id: String(payload.shear_id || payload.id || "").trim() || null,
  };
}

function buildFailOpenResult(config, reason, extra = {}) {
  return {
    enabled: config.enabled,
    mode: config.mode,
    policy_version: config.policyVersion,
    fail_open: true,
    skipped: false,
    verdict: null,
    reason,
    applied_rule_id: null,
    trace: null,
    signature: null,
    shear_id: null,
    ...extra,
  };
}

export async function evaluateEntropyShear({
  policyKey = "cityone-line-main-chain",
  facts,
  requestId = "",
  fetchImpl = fetch,
} = {}) {
  const config = getEntropyShearConfig();
  if (!config.enabled) {
    return {
      enabled: false,
      skipped: true,
      mode: config.mode,
      policy_version: config.policyVersion,
      verdict: null,
      reason: "entropy_shear_disabled",
      applied_rule_id: null,
      trace: null,
      signature: null,
      shear_id: null,
      fail_open: false,
    };
  }

  if (!config.baseUrl) {
    const result = buildFailOpenResult(config, "entropy_shear_url_missing");
    console.warn("[entropy-shear] fail-open: missing ENTROPY_SHEAR_URL", {
      mode: config.mode,
      policy_version: config.policyVersion,
      request_id: requestId,
    });
    return result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const endpoint = new URL("/shear", config.baseUrl).toString();
  const body = {
    policy_key: policyKey,
    policy_version: config.policyVersion,
    mode: config.mode,
    request_id: requestId || undefined,
    facts,
  };

  console.info("[entropy-shear] request", {
    endpoint,
    mode: config.mode,
    policy_key: policyKey,
    policy_version: config.policyVersion,
    request_id: requestId,
  });

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    const payload = normalizeShearPayload(json?.data || json);
    if (!response.ok) {
      throw new Error(payload.reason || `Entropy Shear HTTP ${response.status}`);
    }

    const result = {
      enabled: true,
      skipped: false,
      mode: config.mode,
      policy_version: config.policyVersion,
      fail_open: false,
      ...payload,
    };
    console.info("[entropy-shear] response", {
      mode: result.mode,
      policy_version: result.policy_version,
      verdict: result.verdict,
      applied_rule_id: result.applied_rule_id,
      shear_id: result.shear_id,
      request_id: requestId,
    });
    return result;
  } catch (err) {
    const reason = err?.name === "AbortError"
      ? `entropy_shear_timeout_${config.timeoutMs}ms`
      : (err?.message || "entropy_shear_request_failed");

    if (config.mode === "audit") {
      const result = buildFailOpenResult(config, reason, {
        error: String(err?.message || reason),
      });
      console.warn("[entropy-shear] fail-open", {
        mode: config.mode,
        policy_version: config.policyVersion,
        reason,
        request_id: requestId,
      });
      return result;
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}
