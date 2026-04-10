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
 * 生成签名访问 URL
 */
export function signedUrl(objectKey, expires = URL_EXPIRES) {
  const client = getClient();
  return client.signatureUrl(objectKey, { expires });
}

/**
 * 删除 OSS 对象
 */
export async function deleteObject(objectKey) {
  const client = getClient();
  await client.delete(objectKey);
}
