/**
 * OSS 服务层 — 阿里云 OSS 上传 / 签名访问 / 删除
 * 若环境变量未配置则降级为 null（调用方自行判断）
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const OSS_REGION     = process.env.ALIYUN_OSS_REGION     || "";
const OSS_BUCKET     = process.env.ALIYUN_OSS_BUCKET     || "";
const OSS_AK_ID      = process.env.ALIYUN_OSS_ACCESS_KEY_ID     || "";
const OSS_AK_SECRET  = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || "";
const URL_EXPIRES    = parseInt(process.env.ALIYUN_OSS_URL_EXPIRES || "86400", 10); // 默认 24h

export const OSS_CONFIGURED = !!(OSS_REGION && OSS_BUCKET && OSS_AK_ID && OSS_AK_SECRET);
export const LOCAL_MEDIA_FALLBACK_ALLOWED = String(process.env.ALLOW_LOCAL_MEDIA_FALLBACK || "").trim().toLowerCase() === "true";

let _client = null;
function getClient() {
  if (!_client) {
    if (!OSS_CONFIGURED) throw new Error("OSS 环境变量未配置");
    const OSS = require("ali-oss");
    _client = new OSS({
      region: OSS_REGION,
      bucket: OSS_BUCKET,
      accessKeyId: OSS_AK_ID,
      accessKeySecret: OSS_AK_SECRET,
      secure: true,
    });
  }
  return _client;
}

/**
 * 规范化 objectKey
 * 格式: {moduleType}/{yyyy}/{mm}/{dd}/{timestamp}-{random8}.{ext}
 */
export function buildObjectKey(moduleType, ext) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(now.getUTCDate()).padStart(2, "0");
  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const safe = (moduleType || "uploads").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/|\/$/g, "") || "uploads";
  return `${safe}/${yyyy}/${mm}/${dd}/${ts}-${rand}.${ext}`;
}

/**
 * 上传 Buffer 到 OSS
 * @returns {{ objectKey, previewUrl, bucket, sizeBytes }}
 */
export async function putObject(buffer, objectKey, contentType) {
  const client = getClient();
  await client.put(objectKey, buffer, {
    headers: { "Content-Type": contentType },
  });
  const previewUrl = signedUrl(objectKey);
  return { objectKey, previewUrl, bucket: OSS_BUCKET, sizeBytes: buffer.length };
}

/**
 * 服务端签名 URL 缓存
 * 同一 objectKey 在 TTL 内始终返回相同 URL，让浏览器 HTTP 缓存正常生效。
 * 阿里云 / AWS 官方最佳实践：Presigned URL 应在服务端缓存，避免每次生成
 * 导致浏览器无法复用缓存（签名参数变化 → 浏览器视为新资源 → 重新下载）。
 */
const _signedUrlCache = new Map(); // objectKey → { url, generatedAt }
const SIGNED_URL_CACHE_TTL_MS = 50 * 60 * 1000; // 50 min（URL 有效期 24h，提前刷新留余量）

/**
 * 生成签名访问 URL（带服务端缓存）
 */
export function signedUrl(objectKey, expires = URL_EXPIRES) {
  const cached = _signedUrlCache.get(objectKey);
  if (cached && (Date.now() - cached.generatedAt) < SIGNED_URL_CACHE_TTL_MS) {
    return cached.url;
  }
  const client = getClient();
  const url = client.signatureUrl(objectKey, { expires });
  _signedUrlCache.set(objectKey, { url, generatedAt: Date.now() });
  return url;
}

/**
 * 将字段值解析为可直接访问的 URL（用于 GET 响应）
 * - 空值 / 已是 http(s):// / 以 / 开头（本地文件）→ 原样返回
 * - 其他（OSS 对象 Key）→ 生成 HMAC 签名 URL（纯本地计算，无网络调用）
 */
export function resolveOssUrl(value) {
  if (!value) return value || "";
  if (value.startsWith("http") || value.startsWith("/")) return value;
  if (!OSS_CONFIGURED) return value;
  try { return signedUrl(value); } catch { return value; }
}

/**
 * 将字段值还原为 OSS 对象 Key（用于 POST/PUT 存库前处理）
 * - 若传入的是 aliyuncs.com 签名 URL → 提取路径作为 object key
 * - 本地 /uploads/... 或已是 object key → 原样返回
 */
export function revertOssUrl(value) {
  if (!value) return value || "";
  if (!value.startsWith("http")) return value;
  try {
    const u = new URL(value);
    if (u.hostname.includes("aliyuncs.com")) return u.pathname.slice(1);
  } catch {}
  return value;
}

function createMediaRefError(fieldName, message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.errorCode = "INVALID_MEDIA_REF";
  err.fieldName = fieldName;
  return err;
}

/**
 * 生产级媒体字段规范：
 * - 允许空值
 * - 允许 OSS object key
 * - 允许临时传入 aliyuncs.com 签名 URL（会被还原成 object key）
 * - 不允许本地 /uploads/... 路径
 * - 不允许任意外链 http(s) 地址
 */
export function normalizeManagedAssetRef(value, fieldName = "media") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = revertOssUrl(raw);
  if (!normalized) return "";

  if (normalized.startsWith("/uploads/")) {
    throw createMediaRefError(fieldName, `${fieldName} 不能再保存为本地 /uploads 路径，请重新通过 OSS 上传后再保存`);
  }
  if (/^https?:\/\//i.test(normalized)) {
    throw createMediaRefError(fieldName, `${fieldName} 必须使用 OSS 存储，不支持直接保存外链地址`);
  }

  return normalized;
}

/**
 * 删除 OSS 对象
 */
export async function deleteObject(objectKey) {
  const client = getClient();
  await client.delete(objectKey);
}
