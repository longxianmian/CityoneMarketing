import test from "node:test";
import assert from "node:assert/strict";

import { evaluateEntropyShear, getEntropyShearConfig } from "../src/services/entropy-shear-client.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides = {}) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV, overrides);
}

test("entropy shear client reads env config with defaults", () => {
  resetEnv({
    ENTROPY_SHEAR_ENABLED: "true",
    ENTROPY_SHEAR_URL: "https://shear.example.com",
  });
  const config = getEntropyShearConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.baseUrl, "https://shear.example.com");
  assert.equal(config.mode, "audit");
  assert.equal(config.timeoutMs, 800);
  assert.equal(config.policyVersion, "cityone-line-main-chain-v1");
  assert.match(String(config.policyPath || ""), /cityone-line-main-chain-policy\.v1\.json$/);
});

test("entropy shear client sends full policy payload and returns normalized response", async () => {
  resetEnv({
    ENTROPY_SHEAR_ENABLED: "true",
    ENTROPY_SHEAR_URL: "https://shear.example.com/base",
    ENTROPY_SHEAR_MODE: "audit",
    ENTROPY_SHEAR_POLICY_VERSION: "cityone-line-main-chain-v1",
  });

  let seenUrl = "";
  let seenBody = null;
  const result = await evaluateEntropyShear({
    requestId: "intent_1",
    facts: { request: { mode: "audit" }, safety: { mainline_ready: true } },
    fetchImpl: async (url, options = {}) => {
      seenUrl = String(url);
      seenBody = JSON.parse(String(options.body || "{}"));
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            verdict: "Yes",
            reason: "ok",
            applied_rule_id: "cityone.yes.mainline_ready",
            trace: [{ rule_id: "cityone.yes.mainline_ready", evaluated: true, matched: true, detail: "matched" }],
            signature: `sha256:${"a".repeat(64)}`,
            shear_id: "entropy-shear-20260429-123456"
          });
        },
      };
    },
  });

  assert.equal(seenUrl, "https://shear.example.com/shear");
  assert.ok(seenBody.policy);
  assert.ok(seenBody.facts);
  assert.equal(seenBody.policy.id, "cityone-line-main-chain");
  assert.equal(seenBody.policy.version, "cityone-line-main-chain-v1");
  assert.equal(seenBody.policy_key, undefined);
  assert.equal(seenBody.mode, undefined);
  assert.equal(result.verdict, "Yes");
  assert.equal(result.reason, "ok");
  assert.equal(result.applied_rule_id, "cityone.yes.mainline_ready");
  assert.equal(result.shear_id, "entropy-shear-20260429-123456");
  assert.equal(result.fail_open, false);
});

test("entropy shear client fails open in audit mode and keeps 422 response body", async () => {
  resetEnv({
    ENTROPY_SHEAR_ENABLED: "true",
    ENTROPY_SHEAR_URL: "https://shear.example.com",
    ENTROPY_SHEAR_MODE: "audit",
  });

  const result = await evaluateEntropyShear({
    requestId: "intent_2",
    facts: { request: { mode: "audit" } },
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      async text() {
        return JSON.stringify({
          error: "policy_schema_violation",
          detail: "policy.version is required",
        });
      },
    }),
  });

  assert.equal(result.fail_open, true);
  assert.equal(result.verdict, null);
  assert.equal(result.reason, "Entropy Shear HTTP 422");
  assert.deepEqual(result.response_body, {
    error: "policy_schema_violation",
    detail: "policy.version is required",
  });
  assert.equal(result.error_detail, "policy.version is required");
});
