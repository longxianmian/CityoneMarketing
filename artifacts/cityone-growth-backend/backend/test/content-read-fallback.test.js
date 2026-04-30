import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { handleActivityList } from "../src/routes/activities.js";
import { handleGetBanners } from "../src/routes/banners.js";
import { handleUserCouponList } from "../src/routes/coupons.js";
import { handleGetMallItems } from "../src/routes/mall-items.js";
import { readFallbackList } from "../src/services/read-fallback-data.js";

function createSendJsonCapture() {
  const state = { statusCode: null, payload: null };
  const sendJson = (_res, statusCode, payload) => {
    state.statusCode = statusCode;
    state.payload = payload;
    return payload;
  };
  return { state, sendJson };
}

function createDbError() {
  return new Error("connect ECONNREFUSED 127.0.0.1:5432");
}

test("DB success path does not call fallback for banners", async () => {
  const { state, sendJson } = createSendJsonCapture();
  let fallbackCalled = false;
  const url = new URL("http://localhost/api/growth/banners?enabled=true");

  await handleGetBanners({}, {}, sendJson, url, {
    queryFn: async () => ({
      rows: [{
        banner_code: "bn_001",
        title: { zh: "t" },
        sub_title: { zh: "s" },
        image_url: "",
        position_key: "home_top",
        enabled: true,
        sort_order: 0,
      }],
    }),
    readFallbackListFn: async () => {
      fallbackCalled = true;
      throw new Error("should not run");
    },
  });

  assert.equal(fallbackCalled, false);
  assert.equal(state.statusCode, 200);
  assert.equal(state.payload.data.total, 1);
  assert.equal(state.payload.data.list[0].id, "bn_001");
});

test("activities route falls back to local JSON when DB is unavailable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-activities-fallback-"));
  fs.writeFileSync(path.join(tempDir, "activities.json"), JSON.stringify([
    { activity_id: "a1", activity_type: "sos", status: "active", sort_order: 1, created_at: "2026-01-01T00:00:00.000Z" },
    { activity_id: "a2", activity_type: "general", status: "draft", sort_order: 2, created_at: "2026-01-02T00:00:00.000Z" }
  ]), "utf8");
  const { state, sendJson } = createSendJsonCapture();
  const url = new URL("http://localhost/api/activities?activity_type=sos&status=active&page=1&pageSize=20");

  await handleActivityList({}, {}, url, sendJson, {
    queryFn: async () => { throw createDbError(); },
    readFallbackListFn: async (fileName) => readFallbackList(fileName, { baseDir: tempDir }),
  });

  assert.equal(state.statusCode, 200);
  assert.equal(state.payload.data.length, 1);
  assert.equal(state.payload.data[0].activity_id, "a1");
});

test("coupons route falls back to local JSON when DB is unavailable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-coupons-fallback-"));
  fs.writeFileSync(path.join(tempDir, "coupons.json"), JSON.stringify([
    {
      id: "coupon_001",
      name: { zh: "c1" },
      status: 1,
      discount_value: 10,
      min_amount: 0,
      total_count: 1,
      claimed_count: 0,
      valid_to: "2099-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    }
  ]), "utf8");
  const { state, sendJson } = createSendJsonCapture();
  const url = new URL("http://localhost/api/user/coupons");

  await handleUserCouponList({}, {}, url, sendJson, {
    queryFn: async () => { throw createDbError(); },
    readFallbackListFn: async (fileName) => readFallbackList(fileName, { baseDir: tempDir }),
  });

  assert.equal(state.statusCode, 200);
  assert.equal(state.payload.data.length, 1);
  assert.equal(state.payload.data[0].id, "coupon_001");
});

test("mall items route falls back to local JSON when DB is unavailable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-mall-fallback-"));
  fs.writeFileSync(path.join(tempDir, "mall-items.json"), JSON.stringify([
    { id: "mi_001", on_shelf: true, sort_order: 1, created_at: "2026-01-01T00:00:00.000Z", points_required: 20 },
    { id: "mi_002", on_shelf: false, sort_order: 2, created_at: "2026-01-02T00:00:00.000Z", points_required: 30 }
  ]), "utf8");
  const { state, sendJson } = createSendJsonCapture();
  const url = new URL("http://localhost/api/growth/mall/items?onShelf=true&pageNum=1&pageSize=20");

  await handleGetMallItems({}, {}, sendJson, url, {
    queryFn: async () => { throw createDbError(); },
    readFallbackListFn: async (fileName) => readFallbackList(fileName, { baseDir: tempDir }),
  });

  assert.equal(state.statusCode, 200);
  assert.equal(state.payload.data.total, 1);
  assert.equal(state.payload.data.list[0].id, "mi_001");
});

test("fallback file missing does not fake success for coupons", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-coupons-missing-"));
  const { state, sendJson } = createSendJsonCapture();
  const url = new URL("http://localhost/api/user/coupons");

  await handleUserCouponList({}, {}, url, sendJson, {
    queryFn: async () => { throw createDbError(); },
    readFallbackListFn: async (fileName) => readFallbackList(fileName, { baseDir: tempDir }),
  });

  assert.equal(state.statusCode, 500);
  assert.equal(state.payload.error, "DB_ERROR");
});

test("banners fallback keeps compatibility with banner_code or id", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-banners-fallback-"));
  fs.writeFileSync(path.join(tempDir, "banners.json"), JSON.stringify([
    { id: "legacy_bn_001", title: { zh: "banner" }, sub_title: { zh: "" }, enabled: true, sort_order: 0, position_key: "home_top" }
  ]), "utf8");
  const { state, sendJson } = createSendJsonCapture();
  const url = new URL("http://localhost/api/growth/banners?enabled=true&position_key=home_top");

  await handleGetBanners({}, {}, sendJson, url, {
    queryFn: async () => { throw createDbError(); },
    readFallbackListFn: async (fileName) => readFallbackList(fileName, { baseDir: tempDir }),
  });

  assert.equal(state.statusCode, 200);
  assert.equal(state.payload.data.list[0].id, "legacy_bn_001");
});
