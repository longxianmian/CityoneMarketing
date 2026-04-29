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

function createFakeClient(row) {
  return {
    async query(sql, params) {
      if (sql.includes("FROM pending_intents") && sql.includes("FOR UPDATE")) {
        return { rows: [row] };
      }
      if (sql.includes("FROM users")) {
        return { rows: [{ is_fan: true }] };
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

async function runConsumeWithAuditVerdict(verdict, options = {}) {
  const row = createPendingRow(options.row);
  const client = createFakeClient(row);
  let executorCalls = 0;
  const consoleInfoMock = mock.method(console, "info", () => {});

  try {
    const result = await consumePendingIntent({
      intentId: row.intent_id,
      consumeKey: `consume:${row.intent_id}`,
      userId: "U123",
      lineUserId: "U123",
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
          mode: "audit",
          policyVersion: "cityone-line-main-chain.v1",
        }),
        evaluateEntropyShear: options.evaluateEntropyShear || (async () => ({
          verdict,
          reason: `${String(verdict || "").toLowerCase()}_reason`,
          applied_rule_id: `rule.${String(verdict || "").toLowerCase()}`,
          trace: { verdict },
          signature: "sig_123",
          shear_id: `shear_${String(verdict || "").toLowerCase()}`,
          mode: "audit",
          fail_open: false,
        })),
      },
    });

    const logHit = consoleInfoMock.mock.calls.some((call) => (
      call.arguments[0] === "[entropy-shear][audit]" &&
      call.arguments[1]?.mode === "audit"
    ));

    return {
      result,
      executorCalls,
      logHit,
    };
  } finally {
    consoleInfoMock.mock.restore();
  }
}

test("audit mode with Yes verdict still executes consume", async () => {
  const outcome = await runConsumeWithAuditVerdict("Yes");
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(outcome.result.result.resultCode, "claimed");
  assert.equal(outcome.logHit, true);
});

test("audit mode with No verdict still executes consume and logs", async () => {
  const outcome = await runConsumeWithAuditVerdict("No");
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(outcome.logHit, true);
});

test("audit mode with Hold verdict still executes consume and logs", async () => {
  const outcome = await runConsumeWithAuditVerdict("Hold");
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(outcome.logHit, true);
});

test("audit mode with unavailable shear service still executes consume", async () => {
  const outcome = await runConsumeWithAuditVerdict(null, {
    evaluateEntropyShear: async () => {
      throw new Error("shear down");
    },
  });
  assert.equal(outcome.executorCalls, 1);
  assert.equal(outcome.result.replayed, false);
  assert.equal(outcome.logHit, true);
});
