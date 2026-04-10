#!/usr/bin/env node
/**
 * mock-a-system-device-borrow.js
 *
 * 模拟 A 系统 device-borrow-event Webhook 的闭环自测脚本
 * 用途：在 Replit 开发环境完成链路联调自测，不需要真实 A 系统配合
 *
 * 功能：
 *  1. 构建模拟借机事件请求体（符合《A系统旁路接口契约初稿》字段）
 *  2. 生成 HMAC-SHA256 签名（可选，开发模式无签名也能通过）
 *  3. POST 到本地增长系统后端
 *  4. 打印完整响应
 *  5. 用相同 event_id 重放 → 验证幂等防重
 *
 * 使用方式：
 *   # 无签名（开发模式，A_SYSTEM_WEBHOOK_ENABLED=false，推荐先用这个）
 *   node backend/scripts/mock-a-system-device-borrow.js
 *
 *   # 带签名（测试签名校验，需提前设置 WEBHOOK_SECRET 环境变量）
 *   WEBHOOK_SECRET=your-secret node backend/scripts/mock-a-system-device-borrow.js
 *
 *   # 指定目标主机（默认 localhost:3100）
 *   TARGET_HOST=https://xxx.replit.dev node backend/scripts/mock-a-system-device-borrow.js
 *
 *   # 指定 a_system_station_id（需与 stations 表中已有数据匹配）
 *   A_STATION_ID=st_001 node backend/scripts/mock-a-system-device-borrow.js
 *
 *   # 指定 line_user_id（任意字符串即可，增长系统不校验用户是否存在）
 *   LINE_USER_ID=Uabcdef1234567 node backend/scripts/mock-a-system-device-borrow.js
 *
 * 环境变量总览：
 *   TARGET_HOST        后端地址，默认 http://localhost:3100
 *   WEBHOOK_SECRET     签名密钥（不填则不生成签名，开发模式可通过）
 *   A_STATION_ID       a_system_station_id（不填则从 DB 自动取第一个，也可不填）
 *   DEVICE_CODE        device_code（不填则不传）
 *   LINE_USER_ID       LINE 用户 ID（不填则用 mock_user_001）
 *   EVENT_ID           自定义 event_id（不填则自动生成，每次运行不同）
 */

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

// ─── 配置 ────────────────────────────────────────────────────────────────────

const TARGET_HOST   = process.env.TARGET_HOST   || "http://localhost:3100";
const WEBHOOK_PATH  = "/api/a-system/webhook/device-borrow-event";
const SECRET        = process.env.WEBHOOK_SECRET || "";
const A_STATION_ID  = process.env.A_STATION_ID  || "asys_station_mock_001";
const DEVICE_CODE   = process.env.DEVICE_CODE   || "dev_mock_001";
const LINE_USER_ID  = process.env.LINE_USER_ID  || "Umock_line_user_001";
const EVENT_ID      = process.env.EVENT_ID      || `mock_evt_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

// ─── 签名工具 ─────────────────────────────────────────────────────────────────

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  return JSON.stringify(obj, (_, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((a, k) => { a[k] = v[k]; return a; }, {});
    }
    return v;
  });
}

function buildSignHeader(body, secret) {
  if (!secret) return null;
  const timestamp     = Math.floor(Date.now() / 1000);
  const stableBody    = stableStringify(body);
  const signedPayload = `${timestamp}.${stableBody}`;
  const signature     = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

// ─── HTTP 请求封装 ────────────────────────────────────────────────────────────

function post(urlStr, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url        = new URL(urlStr);
    const bodyStr    = stableStringify(body);
    const headers    = {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(bodyStr),
      ...extraHeaders,
    };

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      { hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""), method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── 格式化输出 ───────────────────────────────────────────────────────────────

function printResult(label, res) {
  const ok = res.status >= 200 && res.status < 300;
  const icon = ok ? "✅" : "❌";
  console.log(`\n${icon} ${label}`);
  console.log(`   HTTP Status: ${res.status}`);
  console.log(`   Response   :`, JSON.stringify(res.body, null, 2).split("\n").join("\n   "));
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  CityOne 增长系统 × A系统 Webhook 模拟联调自测");
  console.log("=".repeat(60));
  console.log(`  目标地址  : ${TARGET_HOST}${WEBHOOK_PATH}`);
  console.log(`  event_id  : ${EVENT_ID}`);
  console.log(`  a_station : ${A_STATION_ID}`);
  console.log(`  device    : ${DEVICE_CODE}`);
  console.log(`  line_user : ${LINE_USER_ID}`);
  console.log(`  签名模式  : ${SECRET ? "有签名（HMAC-SHA256）" : "无签名（开发模式旁路）"}`);
  console.log("-".repeat(60));

  // ── 构建请求体（符合 A 系统接口契约初稿）────────────────────────────────
  const eventBody = {
    event_id:            EVENT_ID,
    event_type:          "device_borrow",
    a_system_station_id: A_STATION_ID,
    a_system_device_id:  "asys_dev_mock_001",
    device_code:         DEVICE_CODE,
    a_system_user_id:    "asys_user_mock_001",
    line_user_id:        LINE_USER_ID,
    order_id:            `order_mock_${Date.now()}`,
    borrow_at:           new Date().toISOString(),
    extra: {
      location: "Bangkok, Thailand",
      device_model: "PowerBank-X1",
    },
  };

  // ── 生成签名 Header（可选）────────────────────────────────────────────
  const signHeader = buildSignHeader(eventBody, SECRET);
  const headers    = signHeader ? { "X-A-System-Sign": signHeader } : {};

  if (signHeader) {
    console.log(`\n  签名 Header: ${signHeader.slice(0, 60)}...`);
  }

  // ─── 第一次发送：期望成功触发奖励 ─────────────────────────────────────
  console.log("\n[STEP 1] 首次发送 device-borrow-event →");
  const res1 = await post(`${TARGET_HOST}${WEBHOOK_PATH}`, eventBody, headers);
  printResult("首次请求结果", res1);

  const firstOk = res1.status === 200;
  if (!firstOk) {
    console.log("\n⚠️  首次请求未返回 200，请检查：");
    console.log("   1. 增长系统后端是否已启动（port 3100）");
    console.log("   2. stations 表是否有 a_system_station_id = " + A_STATION_ID);
    console.log("   3. 该站点是否有 status=enabled 的 entry_instances");
    console.log("   4. 对应活动是否 status=active");
    console.log("\n   可以先运行 seed 脚本插入测试数据，或指定已有的 A_STATION_ID 重试：");
    console.log("   A_STATION_ID=<已有ID> node backend/scripts/mock-a-system-device-borrow.js");
    process.exit(1);
  }

  // ─── 第二次发送：相同 event_id → 幂等防重 ─────────────────────────────
  console.log("\n[STEP 2] 相同 event_id 重放（验证幂等）→");
  // 重新生成签名（时间戳不同，签名不同，但 event_id 相同）
  const signHeader2 = buildSignHeader(eventBody, SECRET);
  const headers2    = signHeader2 ? { "X-A-System-Sign": signHeader2 } : {};
  const res2 = await post(`${TARGET_HOST}${WEBHOOK_PATH}`, eventBody, headers2);
  printResult("重放请求结果", res2);

  const isIdempotent = res2.status === 200 &&
    (res2.body?.msg === "already_processed" || res2.body?.data?.already_processed === true);

  // ─── 结果汇总 ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  自测结果汇总");
  console.log("=".repeat(60));
  console.log(`  首次请求触发奖励  : ${firstOk ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  event_id 幂等防重 : ${isIdempotent ? "✅ PASS" : "❌ FAIL（重放请求应返回 already_processed）"}`);

  if (firstOk && isIdempotent) {
    console.log("\n🎉 模拟联调闭环自测通过！链路可以正常运行。");
    console.log("   现在可以查看数据库确认写入：");
    console.log("   - a_system_webhook_events（两条：success + duplicate）");
    console.log("   - activity_participations（一条）");
    console.log("   - points_ledger（一条）");
    console.log("   - points_accounts（已更新）");
  } else {
    console.log("\n⚠️  部分测试未通过，请检查上方响应内容定位问题。");
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\n脚本运行异常：", err.message);
  process.exit(1);
});
