/**
 * a-system-signature.js
 *
 * A 系统 Webhook 签名校验工具（已实现，开发模式可旁路）
 *
 * 签名方案：
 *  Header: X-A-System-Sign: t=<Unix时间戳(秒)>,v1=<HMAC-SHA256-hex>
 *
 *  签名原文构建：
 *    1. 将请求体对象按 key 字典序（深度）排序后 JSON.stringify → stableBody
 *    2. 签名原文 = "<timestamp>.<stableBody>"
 *    3. 签名值  = HMAC-SHA256(secret, 签名原文).hex()
 *
 *  重放防护：|当前时间 - t| ≤ 300 秒（5 分钟）
 *
 * 环境变量：
 *  A_SYSTEM_WEBHOOK_SECRET   — 与 A 系统共享密钥（至少 32 位随机字符串）
 *  A_SYSTEM_WEBHOOK_ENABLED  — "true" | "false"（默认 false = 开发模式，跳过签名强制校验）
 *
 * 开发模式行为（A_SYSTEM_WEBHOOK_ENABLED != "true"）：
 *  - 如果 Header 中无 X-A-System-Sign，直接放行（方便 mock 测试不带签名）
 *  - 如果 Header 中有签名，仍然进行校验（发现格式错误则记录警告）
 *
 * 生产模式行为（A_SYSTEM_WEBHOOK_ENABLED = "true"）：
 *  - 必须提供有效签名，否则返回 401
 */

import crypto from "node:crypto";

/**
 * 对象 key 深度字典序排序后 JSON.stringify
 * 保证签名原文稳定，不因 key 插入顺序不同而导致签名不一致
 *
 * @param {any} obj
 * @returns {string}
 */
export function stableStringify(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
  return JSON.stringify(sorted, (_, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((a, k) => { a[k] = v[k]; return a; }, {});
    }
    return v;
  });
}

/**
 * 生成 X-A-System-Sign Header 值（供 mock 脚本和测试使用）
 *
 * @param {object} body     请求体对象
 * @param {string} secret   共享密钥
 * @param {number} [ts]     Unix 时间戳（秒），不填则取当前时间
 * @returns {string}  格式：t=<timestamp>,v1=<signature>
 */
export function buildASystemSignHeader(body, secret, ts) {
  const timestamp = ts ?? Math.floor(Date.now() / 1000);
  const stableBody = stableStringify(body);
  const signedPayload = `${timestamp}.${stableBody}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/**
 * 解析 X-A-System-Sign Header
 * @param {string} header  格式 "t=1700000000,v1=abc..."
 * @returns {{ timestamp: number, signature: string } | null}
 */
function parseSignHeader(header) {
  if (!header || typeof header !== "string") return null;
  const parts = {};
  for (const segment of header.split(",")) {
    const eqIdx = segment.indexOf("=");
    if (eqIdx < 0) continue;
    const key = segment.slice(0, eqIdx).trim();
    const val = segment.slice(eqIdx + 1).trim();
    parts[key] = val;
  }
  if (!parts.t || !parts.v1) return null;
  const timestamp = parseInt(parts.t, 10);
  if (isNaN(timestamp)) return null;
  return { timestamp, signature: parts.v1 };
}

/**
 * 验证 A 系统 Webhook 签名
 *
 * @param {object} options
 * @param {string} options.rawBody     请求原始 body 字符串（stableStringify 后的 JSON）
 * @param {string} options.signHeader  X-A-System-Sign 原始 header 值
 * @param {string} options.secret      共享密钥
 * @param {number} [options.tolerance] 重放防护时间窗口（秒），默认 300
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyASystemSignature({ rawBody, signHeader, secret, tolerance = 300 }) {
  const parsed = parseSignHeader(signHeader);
  if (!parsed) {
    return { valid: false, reason: "X-A-System-Sign Header 格式错误或缺失（期望 t=<ts>,v1=<sig>）" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return {
      valid: false,
      reason: `请求时间戳 ${parsed.timestamp} 与服务器当前时间 ${now} 相差超过 ${tolerance} 秒，疑似重放攻击`,
    };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const received = parsed.signature;

  // 长度不等则直接拒绝（timingSafeEqual 要求等长）
  if (expected.length !== received.length) {
    return { valid: false, reason: "签名长度不匹配" };
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  );

  return isValid ? { valid: true } : { valid: false, reason: "签名校验失败：签名值不匹配" };
}

/**
 * 是否处于生产签名强制模式
 * A_SYSTEM_WEBHOOK_ENABLED=true 时要求所有请求携带有效签名
 *
 * @returns {boolean}
 */
export function isASystemSignatureRequired() {
  return process.env.A_SYSTEM_WEBHOOK_ENABLED === "true" &&
    Boolean(process.env.A_SYSTEM_WEBHOOK_SECRET);
}
