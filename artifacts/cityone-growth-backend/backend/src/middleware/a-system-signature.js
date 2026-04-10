/**
 * a-system-signature.js
 *
 * A 系统 Webhook 签名校验中间件（预留阶段）
 *
 * 当前状态：
 *  - 签名校验逻辑已定义，暂未在路由中强制启用
 *  - 待 A 系统提供正式共享密钥后，在 a-system.js 路由中引入并调用
 *
 * 约定签名方案：
 *  Header: X-A-System-Sign: t=<Unix时间戳(秒)>,v1=<HMAC-SHA256-hex>
 *
 *  签名原文: <timestamp>.<JSON.stringify(请求体，keys 字典序排序)>
 *  签名算法: HMAC-SHA256(共享密钥, 签名原文)
 *  输出格式: hex 字符串
 *
 *  重放防护: |当前时间 - t| ≤ 300 秒（5 分钟）
 *
 * 环境变量：
 *  A_SYSTEM_WEBHOOK_SECRET  — A 系统与增长系统共享密钥（至少 32 位随机字符串）
 *                             未配置时签名校验不启用，路由返回 501
 */

import crypto from "node:crypto";

/**
 * 解析 X-A-System-Sign Header
 * @param {string} header 原始 header 值，格式 "t=1700000000,v1=abc..."
 * @returns {{ timestamp: number, signature: string } | null}
 */
function parseSignHeader(header) {
  if (!header) return null;
  const parts = {};
  for (const segment of header.split(",")) {
    const eqIdx = segment.indexOf("=");
    if (eqIdx < 0) continue;
    parts[segment.slice(0, eqIdx).trim()] = segment.slice(eqIdx + 1).trim();
  }
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parseInt(parts.t, 10), signature: parts.v1 };
}

/**
 * 验证 A 系统 Webhook 签名
 *
 * @param {object} options
 * @param {string} options.rawBody     请求原始 body 字符串（JSON 文本）
 * @param {string} options.signHeader  X-A-System-Sign 原始 header 值
 * @param {string} options.secret      共享密钥
 * @param {number} [options.tolerance] 重放防护时间窗口（秒），默认 300
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyASystemSignature({ rawBody, signHeader, secret, tolerance = 300 }) {
  const parsed = parseSignHeader(signHeader);
  if (!parsed) {
    return { valid: false, reason: "签名 Header 格式错误或缺失" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { valid: false, reason: `请求时间戳与服务器相差超过 ${tolerance} 秒，疑似重放攻击` };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(parsed.signature.padEnd(expected.length, "0").slice(0, expected.length), "hex")
  );

  return valid ? { valid: true } : { valid: false, reason: "签名不匹配" };
}

/**
 * 检查 A 系统 Webhook 密钥是否已配置
 * 未配置时路由应返回 501，不进行业务处理
 *
 * @returns {boolean}
 */
export function isASystemWebhookEnabled() {
  return Boolean(process.env.A_SYSTEM_WEBHOOK_SECRET);
}

/**
 * 使用示例（待联调后在 a-system.js 中启用）：
 *
 * import { verifyASystemSignature, isASystemWebhookEnabled } from '../middleware/a-system-signature.js'
 *
 * // 在 handler 中：
 * if (!isASystemWebhookEnabled()) {
 *   return sendJson(res, 501, { code: 501, msg: 'A系统 Webhook 密钥未配置' })
 * }
 * const rawBody = await readRawBody(req)  // 取原始字符串
 * const signHeader = req.headers['x-a-system-sign'] || ''
 * const { valid, reason } = verifyASystemSignature({
 *   rawBody,
 *   signHeader,
 *   secret: process.env.A_SYSTEM_WEBHOOK_SECRET,
 * })
 * if (!valid) return sendJson(res, 401, { code: 401, error: 'SIGNATURE_INVALID', msg: reason })
 */
