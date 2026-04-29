import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCityoneLineShearFacts } from "../src/services/cityone-line-shear-facts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..", "..", "..");

test("cityone line shear facts builder emits expected domains", async () => {
  const facts = await buildCityoneLineShearFacts({
    row: {
      intent_id: "intent_123",
      action: "claim_coupon",
      status: "identified",
      target_type: "coupon",
      resource_id: "coupon_001",
      source_url: "/coupon/coupon_001",
      terminal_source: "chrome",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      user_id: "U123",
      line_user_id: "U123",
      resume_key: "rk_123",
    },
    payload: {
      intent_id: "intent_123",
      action: "claim_coupon",
      resource_id: "coupon_001",
    },
    effectiveIdentity: {
      userId: "U123",
      lineUserId: "U123",
    },
    providedIdentity: {
      userId: "U123",
      lineUserId: "U123",
    },
    consumeKey: "consume:intent_123",
    legacyFlags: {
      usedLegacyConsumeEndpoint: false,
      malformedConsume: false,
      identityMismatch: false,
    },
    client: {
      async query() {
        return { rows: [{ is_fan: true }] };
      },
    },
  });

  assert.equal(facts.request.consume_endpoint_kind, "intent_id_consume");
  assert.equal(facts.pending_intent.intent_id, "intent_123");
  assert.equal(facts.identity.identity_bound, true);
  assert.equal(facts.identity.identity_ready, true);
  assert.equal(facts.friendship.user_is_fan_db, true);
  assert.equal(facts.friendship.follow_unconfirmed, false);
  assert.equal(facts.safety.is_expired, false);
  assert.equal(facts.safety.mainline_ready, true);
  assert.equal(facts.legacy_flags.has_resume_key, true);
});

test("identified status without fan evidence stays unconfirmed for friendship", async () => {
  const facts = await buildCityoneLineShearFacts({
    row: {
      intent_id: "intent_identified_not_fan",
      action: "claim_coupon",
      status: "identified",
      target_type: "coupon",
      resource_id: "coupon_002",
      source_url: "/coupon/coupon_002",
      terminal_source: "chrome",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      user_id: "U456",
      line_user_id: "U456",
      resume_key: "rk_456",
    },
    payload: {
      intent_id: "intent_identified_not_fan",
      action: "claim_coupon",
      resource_id: "coupon_002",
    },
    effectiveIdentity: {
      userId: "U456",
      lineUserId: "U456",
    },
    providedIdentity: {
      userId: "U456",
      lineUserId: "U456",
    },
    consumeKey: "consume:intent_identified_not_fan",
    legacyFlags: {
      usedLegacyConsumeEndpoint: false,
      malformedConsume: false,
      identityMismatch: false,
    },
    client: {
      async query() {
        return { rows: [{ is_fan: false }] };
      },
    },
  });

  assert.equal(facts.identity.identity_bound, true);
  assert.equal(facts.friendship.friendship_confirmed, false);
  assert.equal(facts.friendship.follow_unconfirmed, true);
  assert.equal(facts.safety.mainline_ready, false);
});

test("policy file covers required verdict rules and frontend does not call shear", () => {
  const policyPath = path.resolve(backendRoot, "src", "policies", "cityone-line-main-chain-policy.v1.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const ruleIds = new Set(policy.rules.map((rule) => rule.id));
  assert.equal(policy.id, "cityone-line-main-chain");
  assert.equal(policy.version, "cityone-line-main-chain-v1");
  assert.equal(policy.default_effect, "Hold");
  assert.ok(ruleIds.has("cityone.no.intent_expired"));
  assert.ok(ruleIds.has("cityone.no.intent_consumed"));
  assert.ok(ruleIds.has("cityone.no.identity_mismatch"));
  assert.ok(ruleIds.has("cityone.no.legacy_malformed_consume"));
  assert.ok(ruleIds.has("cityone.hold.identity_unbound"));
  assert.ok(ruleIds.has("cityone.hold.follow_unconfirmed"));
  assert.ok(ruleIds.has("cityone.hold.intent_executing"));
  assert.ok(ruleIds.has("cityone.yes.mainline_ready"));

  const frontendRoot = path.resolve(repoRoot, "artifacts", "cityone-growth-frontend", "src");
  const stack = [frontendRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|html)$/.test(entry.name)) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      assert.equal(content.includes("entropy-shear"), false, `${fullPath} should not reference entropy-shear`);
      assert.equal(content.includes("/shear"), false, `${fullPath} should not call /shear`);
    }
  }
});
