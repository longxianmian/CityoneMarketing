import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODE = "audit";
const DEFAULT_TIMEOUT_MS = 800;
const DEFAULT_POLICY_VERSION = "cityone-line-main-chain-v1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_POLICY_PATH = path.join(__dirname, "..", "policies", "cityone-line-main-chain-policy.v1.json");

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
    policyPath: String(process.env.ENTROPY_SHEAR_POLICY_PATH || DEFAULT_POLICY_PATH).trim() || DEFAULT_POLICY_PATH,
  };
}

function loadEntropyShearPolicy(config) {
  const raw = JSON.parse(fs.readFileSync(config.policyPath, "utf8"));
  const policy = {
    ...raw,
    version: config.policyVersion || raw.version,
  };

  if (!policy || typeof policy !== "object") {
    throw new Error("Entropy Shear policy must be a JSON object");
  }
  if (!String(policy.id || "").trim()) {
    throw new Error("Entropy Shear policy.id is required");
  }
  if (!String(policy.version || "").trim()) {
    throw new Error("Entropy Shear policy.version is required");
  }
  if (!Array.isArray(policy.rules)) {
    throw new Error("Entropy Shear policy.rules must be an array");
  }
  if (!String(policy.default_effect || "").trim()) {
    throw new Error("Entropy Shear policy.default_effect is required");
  }
  if (!String(policy.default_reason || "").trim()) {
    throw new Error("Entropy Shear policy.default_reason is required");
  }

  return policy;
}

function normalizeShearPayload(payload = {}) {
  return {
    verdict: payload.verdict ?? null,
    reason: String(payload.reason || payload.message || "").trim() || null,
    applied_rule_id: String(payload.applied_rule_id || payload.rule_id || "").trim() || null,
    trace: payload.trace ?? null,
    signature: payload.signature ?? null,
    shear_id: String(payload.shear_id || payload.id || "").trim() || null,
    route: String(payload.route || "").trim() || null,
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

async function readResponseBody(response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return { json: null, raw: "" };
  }
  try {
    return {
      json: JSON.parse(text),
      raw: text,
    };
  } catch {
    return {
      json: null,
      raw: text,
    };
  }
}

export async function evaluateEntropyShear({
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
    console.warn("[entropy-shear] fail-open", {
      mode: config.mode,
      policy_version: config.policyVersion,
      reason: result.reason,
      request_id: requestId,
    });
    return result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const endpoint = new URL("/shear", config.baseUrl).toString();

  try {
    const policy = loadEntropyShearPolicy(config);
    const body = {
      policy,
      facts,
    };

    console.info("[entropy-shear] request", {
      endpoint,
      mode: config.mode,
      policy_id: policy.id,
      policy_version: policy.version,
      request_id: requestId,
    });

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const { json, raw } = await readResponseBody(response);
    const payload = normalizeShearPayload(json?.data || json || {});

    if (!response.ok) {
      const err = new Error(`Entropy Shear HTTP ${response.status}`);
      err.status = response.status;
      err.responseBody = json ?? raw ?? null;
      err.detail = json?.detail || payload.reason || raw || "";
      throw err;
    }

    const result = {
      enabled: true,
      skipped: false,
      mode: config.mode,
      policy_version: policy.version,
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
        response_body: err?.responseBody ?? null,
        error_detail: String(err?.detail || "").trim() || null,
      });
      console.warn("[entropy-shear] fail-open", {
        mode: config.mode,
        policy_version: config.policyVersion,
        reason,
        request_id: requestId,
        response_body: err?.responseBody ?? null,
      });
      return result;
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}
