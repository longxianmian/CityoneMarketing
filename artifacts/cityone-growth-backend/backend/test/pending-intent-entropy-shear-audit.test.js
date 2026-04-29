import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { consumePendingIntent } from "../src/services/pending-intent-service.js";

function createPendingRow(overrides = {}) {
  return {
    intent_id: "intent_123",
    nonce: "nonce_123",
    user_id: "U123",
    line_user_id: "U123",
    action: "claim_coupon",
    resource_id: "coupon_001",
    return_path: "/coupon/coupon_001",
    success_path: "/coupon/coupon_001",
    fail_path: "/coupon/coupon_001",
    back_path: "/coupon/coupon_001",
    terminal: "chrome",
    terminal_source: "chrome",
    target_type: "coupon",
    source_url: "/coupon/coupon_001",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    status: "identified",
    metadata: {},
    resume_key: "rk_123",
    ...overrides,
  };
}

function createFakeClient(row, { isFan = true } = {}) {
  return {
    async query(sql, params) {
      if (sql.includes("FROM pending_intents") && sql.includes("FOR UPDATE")) {
        return { rows: [row] };
      }
      if (sql.includes("FROM users")) {
        return { rows: [{ is_fan: isFan }] };
      }
      if (sql.includes("SET user_id = $2")) {
        row.user_id = params[1];
        row.line_user_id = params[2];
        return { rows: [] };
      }
      if (sql.includes("SET status = 'executing'")) {
        row.status = "executing";
        row.consume_key = params[1];
        return { rows: [] };
      }
      if (sql.includes("SET status = 'consumed'")) {
        row.status = "consumed";
        row.result_json = params[1];
        row.result_payload = params[1];
        row.consumed_at = new Date().toISOString();
        return { rows: [] };
      }
      if (sql.includes("SET status = 'failed'")) {
        row.status = "failed";
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

async function runConsumeWithEntropyShear(options = {}) {
  const row = createPendingRow(options.row);
  const client = createFakeClient(row, { isFan: options.isFan ?? true });
  let executorCalls = 0;
  const consoleInfoMock = mock.method(console, "info", () => {});
  const consoleWarnMock = mock.method(console, "warn", () => {});

  try {
    const result = await consumePendingIntent({
      intentId: row.intent_id,
      consumeKey: `consume:${row.intent_id}`,
      userId: options.userId || "U123",
      lineUserId: options.lineUserId || "U123",
      executor: async () => {
        executorCalls += 1;
        return {
          resultCode: "claimed",
          nextPath: "/coupon/coupon_001",
        };
      },
      deps: {
        withTransaction: async (fn) => fn(client),
        getEntropyShearConfig: () => ({
          enabled: true,
          mode: options.mode || "audit",
          policyVersion: "cityone-line-main-chain-v1",
        }),
        evaluateEntropyShear: options.evaluateEntropyShear || (async () => ({
          verdict: options.verdict ?? "Yes",
          reason: `${String(options.verdict ?? "Yes").toLowerCase()}_reason`,
          applied_rule_id: options.appliedRuleId || `rule.${String(options.verdict ?? "Yes").toLowerCase()}` ,
          trace: { verdict: options.verdict ?? "Yes" },
          signature: "sig_123",
          shear_id: `shear_${String(options.verdict ?? "Yes").toLowerCase()}` ,
          mode: options.mode || "audit",
          fail_open: options.failOpen === true,
          error: options.failOpen === true ? "shear down" : null,
        })),
      },
    });

    return {
      result,
      executorCalls,
      infoCalls: consoleInfoMock.mock.calls,
      warnCalls: consoleWarnMock.mock.calls,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      executorCalls,
      infoCalls: consoleInfoMock.mock.calls,
      warnCalls: consoleWarnMock.mock.calls,
      error,
    };
  } finally {
    consoleInfoMock.mock.restore();
    consoleWarnMock.mock.restore();
  }
}

function hasLog(calls, marker) {
  return calls.some((call) => call.arguments[0] === marker);
}

test("audit mode with No verdict still executes consume", async () => {
  const outcome = await runConsumeWithEntropyShear({ mode: "audit", verdict: "No" });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.infoCalls, "[entropy-shear][audit]"), true);
});

test("audit mode with Hold verdict still executes consume", async () => {
  const outcome = await runConsumeWithEntropyShear({ mode: "audit", verdict: "Hold" });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.infoCalls, "[entropy-shear][audit]"), true);
});

test("audit mode with unavailable shear service still executes consume", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "audit",
    evaluateEntropyShear: async () => {
      throw new Error("shear down");
    },
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.infoCalls, "[entropy-shear][audit]"), true);
});

test("guard mode with Yes verdict executes consume", async () => {
  const outcome = await runConsumeWithEntropyShear({ mode: "guard", verdict: "Yes", appliedRuleId: "cityone.yes.mainline_ready" });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
});

test("guard mode with Hold verdict passes and logs hold-pass", async () => {
  const outcome = await runConsumeWithEntropyShear({ mode: "guard", verdict: "Hold", appliedRuleId: "cityone.hold.follow_unconfirmed", isFan: false });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.warnCalls, "[entropy-shear][guard][hold-pass]"), true);
});

test("identified status without fan evidence evaluates to Hold in audit mode and still executes", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "audit",
    isFan: false,
    row: { status: "identified" },
    evaluateEntropyShear: async ({ facts }) => {
      assert.equal(facts.identity.identity_bound, true);
      assert.equal(facts.friendship.friendship_confirmed, false);
      assert.equal(facts.friendship.follow_unconfirmed, true);
      assert.equal(facts.safety.mainline_ready, false);
      return {
        verdict: "Hold",
        reason: "follow_unconfirmed",
        applied_rule_id: "cityone.hold.follow_unconfirmed",
        trace: { verdict: "Hold" },
        signature: "sig_hold",
        shear_id: "shear_hold",
        mode: "audit",
        fail_open: false,
      };
    },
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.infoCalls, "[entropy-shear][audit]"), true);
});

test("identified status without fan evidence evaluates to Hold in guard mode and still executes", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    isFan: false,
    row: { status: "identified" },
    evaluateEntropyShear: async ({ facts }) => {
      assert.equal(facts.identity.identity_bound, true);
      assert.equal(facts.friendship.friendship_confirmed, false);
      assert.equal(facts.friendship.follow_unconfirmed, true);
      assert.equal(facts.safety.mainline_ready, false);
      return {
        verdict: "Hold",
        reason: "follow_unconfirmed",
        applied_rule_id: "cityone.hold.follow_unconfirmed",
        trace: { verdict: "Hold" },
        signature: "sig_hold_guard",
        shear_id: "shear_hold_guard",
        mode: "guard",
        fail_open: false,
      };
    },
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.warnCalls, "[entropy-shear][guard][hold-pass]"), true);
});

test("guard mode blocks allowlisted No identity mismatch before executor", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    verdict: "No",
    appliedRuleId: "cityone.no.identity_mismatch",
    row: { user_id: "stored_user", line_user_id: "stored_user" },
    userId: "other_user",
    lineUserId: "other_user",
  });
  assert.equal(outcome.executorCalls, 0);
  assert.equal(outcome.error?.errorCode, "ENTROPY_SHEAR_GUARD_BLOCKED");
  assert.equal(outcome.error?.guard?.verdict, "No");
  assert.equal(hasLog(outcome.warnCalls, "[entropy-shear][guard][blocked]"), true);
});

test("guard mode blocks allowlisted No intent expired before executor", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    verdict: "No",
    appliedRuleId: "cityone.no.intent_expired",
  });
  assert.equal(outcome.executorCalls, 0);
  assert.equal(outcome.error?.errorCode, "ENTROPY_SHEAR_GUARD_BLOCKED");
  assert.equal(outcome.error?.guard?.applied_rule_id, "cityone.no.intent_expired");
});

test("guard mode with unknown No rule does not block and logs unknown-no-pass", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    verdict: "No",
    appliedRuleId: "cityone.no.future_rule_not_allowlisted",
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.warnCalls, "[entropy-shear][guard][unknown-no-pass]"), true);
});

test("guard mode with fail-open result does not block and logs fail-open", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    verdict: null,
    failOpen: true,
    appliedRuleId: null,
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(hasLog(outcome.warnCalls, "[entropy-shear][guard][fail-open]"), true);
});

test("guard mode does not break consumed replay semantics", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    row: {
      status: "consumed",
      result_json: { resultCode: "claimed", replay: true },
    },
  });
  assert.equal(outcome.error, null);
  assert.equal(outcome.executorCalls, 0);
  assert.equal(outcome.result.replayed, true);
  assert.equal(outcome.result.result.resultCode, "claimed");
});

test("guard mode keeps expired intent semantics before executor", async () => {
  const outcome = await runConsumeWithEntropyShear({
    mode: "guard",
    row: {
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      status: "identified",
    },
  });
  assert.equal(outcome.executorCalls, 0);
  assert.equal(outcome.error?.errorCode, "PENDING_INTENT_EXPIRED");
});
