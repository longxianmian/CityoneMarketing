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
  assert.equal(config.policyVersion, "cityone-line-main-chain.v1");
});

test("entropy shear client returns normalized audit response", async () => {
  resetEnv({
    ENTROPY_SHEAR_ENABLED: "true",
    ENTROPY_SHEAR_URL: "https://shear.example.com/base",
    ENTROPY_SHEAR_MODE: "audit",
  });

  let seenUrl = "";
  const result = await evaluateEntropyShear({
    requestId: "intent_1",
    facts: { request: { mode: "audit" } },
    fetchImpl: async (url) => {
      seenUrl = String(url);
      return {
        ok: true,
        async json() {
          return {
            data: {
              verdict: "Yes",
              reason: "ok",
              applied_rule_id: "rule.yes",
              trace: { step: "done" },
              signature: "sig_123",
              shear_id: "shear_123",
            },
          };
        },
      };
    },
  });

  assert.equal(seenUrl, "https://shear.example.com/shear");
  assert.equal(result.verdict, "Yes");
  assert.equal(result.reason, "ok");
  assert.equal(result.applied_rule_id, "rule.yes");
  assert.equal(result.shear_id, "shear_123");
  assert.equal(result.fail_open, false);
});

test("entropy shear client fails open in audit mode when unavailable", async () => {
  resetEnv({
    ENTROPY_SHEAR_ENABLED: "true",
    ENTROPY_SHEAR_URL: "https://shear.example.com",
    ENTROPY_SHEAR_MODE: "audit",
  });

  const result = await evaluateEntropyShear({
    requestId: "intent_2",
    facts: { request: { mode: "audit" } },
    fetchImpl: async () => {
      throw new Error("service unavailable");
    },
  });

  assert.equal(result.fail_open, true);
  assert.equal(result.verdict, null);
  assert.match(String(result.reason || ""), /service unavailable|request_failed/);
});
