/**
 * 媒体资产路由
 * POST   /api/media/upload     上传图片/视频到 OSS（或降级到本地）
 * GET    /api/media/view-url   刷新签名预览 URL
 * DELETE /api/media/:id        软删除媒体资产（预留）
 */
import fs   from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import busboy from "busboy";
import { createRequire } from "node:module";

import {
  OSS_CONFIGURED,
  buildObjectKey,
  putObject,
  signedUrl,
  deleteObject,
} from "../services/ossService.js";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = path.join(__dirname, "..", "..", "data");
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");
const MEDIA_FILE  = path.join(DATA_DIR, "media-assets.json");

// ── 允许的 MIME ──────────────────────────────────────────────────────────────
const ALLOWED_IMAGE = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const ALLOWED_VIDEO = new Set(["video/mp4","video/webm","video/quicktime"]);
const ALLOWED_ALL   = new Set([...ALLOWED_IMAGE, ...ALLOWED_VIDEO]);

const MAX_IMAGE_BYTES = parseInt(process.env.MEDIA_MAX_IMAGE_SIZE || String(10 * 1024 * 1024), 10);
const MAX_VIDEO_BYTES = parseInt(process.env.MEDIA_MAX_VIDEO_SIZE || String(200 * 1024 * 1024), 10);

// ── JSON 持久化 ───────────────────────────────────────────────────────────────
function ensureDirs() {
  [DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}
function loadAssets() {
  ensureDirs();
  try { const p = JSON.parse(fs.readFileSync(MEDIA_FILE, "utf-8")); return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function saveAssets(list) {
  ensureDirs();
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function makeId() { return "ma_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }

// ── 图片压缩（sharp，可选） ───────────────────────────────────────────────────
async function compressImage(buffer, mimeType) {
  try {
    const sharp = require("sharp");
    const img = sharp(buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
    if (mimeType === "image/gif") {
      return { buffer: await img.gif().toBuffer(), mime: "image/gif", ext: "gif" };
    }
    return { buffer: await img.webp({ quality: 82 }).toBuffer(), mime: "image/webp", ext: "webp" };
  } catch (e) {
    return { buffer, mime: mimeType, ext: mimeType.split("/")[1] || "bin" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/media/upload
// ─────────────────────────────────────────────────────────────────────────────
export function handleMediaUpload(req, res, sendJson) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return sendJson(res, 400, { code: 400, msg: "请求必须为 multipart/form-data", error: "BAD_REQUEST" });
  }

  const moduleType = "uploads";
  let settled = false;
  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_VIDEO_BYTES + 1 } });

  bb.on("file", (_field, fileStream, info) => {
    const { mimeType } = info;
    if (!ALLOWED_ALL.has(mimeType)) {
      fileStream.resume();
      if (!settled) { settled = true; sendJson(res, 400, { code: 400, msg: `不支持的文件类型: ${mimeType}`, error: "INVALID_TYPE" }); }
      return;
    }

    const isImage = ALLOWED_IMAGE.has(mimeType);
    const maxSize = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    const chunks  = [];
    let totalSize = 0;
    let limited   = false;

    fileStream.on("data", chunk => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        limited = true;
        fileStream.resume();
        if (!settled) {
          settled = true;
          sendJson(res, 400, { code: 400, msg: `文件超过最大限制 ${Math.round(maxSize/1024/1024)}MB`, error: "FILE_TOO_LARGE" });
        }
        return;
      }
      chunks.push(chunk);
    });

    fileStream.on("end", async () => {
      if (limited || settled) return;
      settled = true;

      try {
        const rawBuffer = Buffer.concat(chunks);
        let finalBuffer = rawBuffer;
        let finalMime   = mimeType;
        let finalExt    = mimeType.split("/")[1] || "bin";

        if (isImage) {
          const compressed = await compressImage(rawBuffer, mimeType);
          finalBuffer = compressed.buffer;
          finalMime   = compressed.mime;
          finalExt    = compressed.ext;
        }

        let url, objectKey;

        if (OSS_CONFIGURED) {
          objectKey = buildObjectKey(moduleType, finalExt);
          const result = await putObject(finalBuffer, objectKey, finalMime);
          url = result.previewUrl;
        } else {
          // 降级：保存到本地 uploads/
          ensureDirs();
          const saveName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${finalExt}`;
          fs.writeFileSync(path.join(UPLOADS_DIR, saveName), finalBuffer);
          url = `/uploads/${saveName}`;
          objectKey = null;
        }

        const asset = {
          id:           makeId(),
          bucket:       OSS_CONFIGURED ? process.env.ALIYUN_OSS_BUCKET : null,
          object_key:   objectKey,
          url,
          mime_type:    finalMime,
          size_bytes:   finalBuffer.length,
          storage:      OSS_CONFIGURED ? "oss" : "local",
          status:       "active",
          created_at:   new Date().toISOString(),
        };

        const list = loadAssets();
        list.push(asset);
        saveAssets(list);

        sendJson(res, 200, {
          code: 200, msg: "上传成功",
          data: {
            id:           asset.id,
            mediaAssetId: asset.id,
            objectKey:    objectKey,
            url,
            mimeType:     finalMime,
            sizeBytes:    finalBuffer.length,
            storage:      asset.storage,
          },
        });
      } catch (err) {
        console.error("[media/upload] error:", err.message);
        sendJson(res, 500, { code: 500, msg: `上传失败: ${err.message}`, error: "UPLOAD_FAILED" });
      }
    });

    fileStream.on("error", err => {
      if (!settled) { settled = true; sendJson(res, 500, { code: 500, msg: "文件流读取失败", error: "STREAM_ERROR" }); }
    });
  });

  bb.on("error", err => {
    if (!settled) { settled = true; sendJson(res, 500, { code: 500, msg: "解析失败", error: "PARSE_ERROR" }); }
  });

  req.pipe(bb);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/media/view-url?key=xxx[&expires=3600]
// ─────────────────────────────────────────────────────────────────────────────
export function handleMediaViewUrl(req, res, sendJson, url) {
  const objectKey = url.searchParams.get("key") || "";
  if (!objectKey) return sendJson(res, 400, { code: 400, msg: "缺少 key 参数", error: "MISSING_KEY" });
  if (!OSS_CONFIGURED) return sendJson(res, 503, { code: 503, msg: "OSS 未配置", error: "OSS_NOT_CONFIGURED" });
  try {
    const expires    = parseInt(url.searchParams.get("expires") || "86400", 10);
    const previewUrl = signedUrl(objectKey, expires);
    sendJson(res, 200, { code: 200, msg: "ok", data: { objectKey, previewUrl, expiresIn: expires } });
  } catch (err) {
    sendJson(res, 500, { code: 500, msg: "签名生成失败", error: "SIGN_FAILED" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/media/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function handleMediaDelete(req, res, sendJson, assetId) {
  if (!req._admin) return sendJson(res, 401, { code: 401, msg: "未登录", error: "UNAUTH" });
  const list  = loadAssets();
  const idx   = list.findIndex(a => a.id === assetId);
  if (idx === -1) return sendJson(res, 404, { code: 404, msg: "资产不存在", error: "NOT_FOUND" });
  const asset = list[idx];

  try {
    if (asset.storage === "oss" && asset.object_key && OSS_CONFIGURED) {
      await deleteObject(asset.object_key);
    } else if (asset.storage === "local" && asset.url) {
      const localPath = path.join(UPLOADS_DIR, path.basename(asset.url));
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  } catch (e) {
    console.warn("[media/delete] storage delete failed:", e.message);
  }

  list[idx] = { ...asset, status: "deleted", deleted_at: new Date().toISOString() };
  saveAssets(list);
  sendJson(res, 200, { code: 200, msg: "已删除", data: null });
}
