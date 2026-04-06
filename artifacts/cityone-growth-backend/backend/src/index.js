import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import busboy from "busboy";
import crypto from "node:crypto";
import {
  handleEntryResolve,
  handleEntryLivePreview,
  handleOAReturnPreview,
  handleEntryConfig,
  handleEntryAllowedTypes,
  handleEntryFeatureRules
} from "./routes/entry.js";
import {
  handleRouteList,
  handleRouteLogs,
  handleRouteCreate,
  handleRouteUpdate,
  handleRouteEnable,
  handleRouteDisable,
  handleRouteTestMatch
} from "./routes/routes.js";
import {
  handleEntryTemplateList,
  handleEntryTemplateCreate,
  handleEntryTemplateUpdate,
  handleEntryTemplateDelete,
  handleEntryInstanceList,
  handleEntryInstanceCreate,
  handleEntryInstanceUpdate,
  handleEntryInstanceDisable,
  handleQrAssetList
} from "./routes/entries.js";
import {
  handleLandingTemplateGet,
  handleLandingTemplateCreate,
  handleLandingTemplateUpdate,
  handleCreativeBindingList,
  handleCreativeBindingCreate,
  handleFollowSuccessDispatch
} from "./routes/landing.js";
import {
  handleGameProgramList,
  handleGameProgramCreate,
  handleGameProgramUpdate,
  handleGameProgramDelete,
} from "./routes/game-programs.js";
import {
  handleActivityTemplateGet,
  handleActivityTemplateCreate,
  handleActivityTemplateUpdate,
  handleActivityList,
  handleActivityGet,
  handleActivityCreate,
  handleActivityUpdate,
  handleActivityDelete,
  handleActivityProductBindingList,
  handleActivityProductBindingCreate
} from "./routes/activities.js";
import {
  handleProductTemplateGet,
  handleProductTemplateCreate,
  handleProductTemplateUpdate,
  handleDigitalProductGet,
  handleDigitalProductCreate,
  handleDigitalProductUpdate,
  handleProductClaim,
  handleProductExchange,
  handleProductPurchase,
  handleProductUse
} from "./routes/products.js";
import {
  handlePrizeList,
  handlePrizeCreate,
  handlePrizeUpdate,
  handlePrizeDelete,
  handleFortuneThemeList,
  handleFortuneThemeCreate,
  handleSignList,
  handleSignCreate,
  handleGrantChance,
  handleWheelStart,
  handleWheelDraw,
  handleScratchStart,
  handleScratchReveal,
  handleFortuneStart,
  handleFortuneDraw
} from "./routes/interactions.js";
import {
  handleUserPointsSummary,
  handleUserPointsLedger,
  handleUserPointsRedeems,
  handleAdminPointsAccounts,
  handleAdminShareRelations,
  handleAdminConsumeRelations,
  handlePointsRules,
  handlePointsAdjust,
} from "./routes/growth-points.js";
import {
  handleAgentSessionInit,
  handleAgentSessionLatest,
  handleAgentGetMessages,
  handleAgentSendMessage,
  handleAgentConfirm,
  handleAgentCapabilities,
  handleAgentQuickPrompts,
  handleAdminAgentConfigGet,
  handleAdminAgentConfigUpdate,
  handleAdminAgentIntentsGet,
  handleAdminAgentIntentsUpdate,
  handleAdminAgentToolsGet,
  handleAdminAgentToolsUpdate,
  handleAdminAgentLogsGet,
  handleAdminAgentMetricsGet,
  handleAgentLLMHealth
} from "./routes/agent.js";
import { handleTranslate } from "./routes/translate.js";
import {
  handleUserProfile,
  handleUserPrizes,
  handleUserBenefits,
  handleUserOrders,
} from "./routes/user-profile.js";
import {
  handleAgentsList,
  handleAgentsUpdate,
  handleAgentToggle,
  handleKeywordsList,
  handleKeywordsSave,
  handleSkillsList,
  handleSkillsCreate,
  handleSkillsUpdate,
  handleSkillsDelete,
  handleCardTemplatesList,
  handleCardTemplatesCreate,
  handleCardTemplatesUpdate,
  handleCardTemplatesDelete,
  handlePolicyContentsList,
  handlePolicyContentsSave,
  handleKpiMetricsList,
  handleKpiMetricsCreate,
  handleKpiMetricsUpdate,
  handleKpiMetricsDelete,
  handleReportTemplatesList,
  handleReportTemplatesCreate,
  handleReportTemplatesUpdate,
  handleReportTemplatesDelete,
  handleAlertRulesList,
  handleAlertRulesCreate,
  handleAlertRulesUpdate,
  handleAlertRulesDelete,
  handleActionSuggestionsList,
  handleActionSuggestionsCreate,
  handleActionSuggestionsUpdate,
  handleActionSuggestionsDelete,
  handleIssueTypesList,
  handleIssueTypesCreate,
  handleIssueTypesUpdate,
  handleIssueTypesDelete,
  handleRepairActionsList,
  handleRepairActionsCreate,
  handleRepairActionsUpdate,
  handleRepairActionsDelete,
} from "./routes/agent-admin.js";
import {
  handleUserCouponList,
  handleCouponList,
  handleCouponAdd,
  handleCouponUpdate,
  handleCouponDelete,
} from "./routes/coupons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3100;
const DATA_DIR = path.join(__dirname, "..", "data");
const LINE_CONFIG_FILE = path.join(DATA_DIR, "line-config.json");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/webm"
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function handleUpload(req, res) {
  ensureUploadsDir();

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return fail(res, 400, "请求必须为 multipart/form-data");
  }

  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });
  let settled = false;

  bb.on("file", (_fieldname, fileStream, info) => {
    const { filename, mimeType } = info;

    if (!ALLOWED_MIME.has(mimeType)) {
      fileStream.resume();
      if (!settled) {
        settled = true;
        return fail(res, 400, `不支持的文件类型: ${mimeType}，仅支持图片和视频`);
      }
      return;
    }

    const ext = path.extname(filename || "").toLowerCase() || `.${mimeType.split("/")[1]}`;
    const saveName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
    const savePath = path.join(UPLOADS_DIR, saveName);
    const writeStream = fs.createWriteStream(savePath);
    let sizeExceeded = false;

    fileStream.on("limit", () => {
      sizeExceeded = true;
      writeStream.destroy();
      fs.unlink(savePath, () => {});
      if (!settled) {
        settled = true;
        fail(res, 400, `文件超过最大限制 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }
    });

    fileStream.pipe(writeStream);

    writeStream.on("finish", () => {
      if (sizeExceeded || settled) return;
      settled = true;
      ok(res, { url: `/uploads/${saveName}`, filename: saveName, mimeType }, "上传成功");
    });

    writeStream.on("error", (err) => {
      if (!settled) {
        settled = true;
        fail(res, 500, `文件写入失败: ${err.message}`);
      }
    });
  });

  bb.on("error", (err) => {
    if (!settled) {
      settled = true;
      fail(res, 400, `上传解析失败: ${err.message}`);
    }
  });

  req.pipe(bb);
}

function serveStaticUpload(req, res, pathname) {
  const filename = pathname.replace(/^\/uploads\//, "");
  if (!filename || filename.includes("..")) {
    return fail(res, 400, "非法路径");
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return fail(res, 404, "文件不存在");
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm"
  };
  const mime = mimeMap[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime, ...CORS_HEADERS });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(payload, null, 2));
}

function ok(res, data = {}, msg = "success") {
  return sendJson(res, 200, { code: 200, msg, data });
}

function fail(res, statusCode, msg, extra = {}) {
  return sendJson(res, statusCode, { code: statusCode, msg, ...extra });
}

function loadLineConfig() {
  ensureDataDir();
  if (!fs.existsSync(LINE_CONFIG_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(LINE_CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveLineConfig(nextConfig) {
  ensureDataDir();
  fs.writeFileSync(LINE_CONFIG_FILE, JSON.stringify(nextConfig, null, 2), "utf-8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  try {
    if (req.method === "POST" && url.pathname === "/api/upload") {
      return handleUpload(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
      return serveStaticUpload(req, res, url.pathname);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return ok(res, {
        ok: true,
        service: "cityone-growth-backend",
        stage: "p0-entry-foundation-plus-line-config"
      });
    }

    if (req.method === "GET" && url.pathname === "/api/entry/resolve") {
      return handleEntryResolve(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entry/live-preview") {
      return handleEntryLivePreview(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entry/config") {
      return handleEntryConfig(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entry/allowed-types") {
      return handleEntryAllowedTypes(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entry/feature-rules") {
      return handleEntryFeatureRules(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/oa/return-preview") {
      return handleOAReturnPreview(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/routes") {
      return handleRouteList(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/routes/logs") {
      return handleRouteLogs(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entries/templates") {
      return handleEntryTemplateList(req, res, url, sendJson);
    }

    if (req.method === "POST" && url.pathname === "/api/entries/templates") {
      return handleEntryTemplateCreate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/entries\/templates\/[^/]+\/update$/.test(url.pathname)) {
      return handleEntryTemplateUpdate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/entries\/templates\/[^/]+\/delete$/.test(url.pathname)) {
      return handleEntryTemplateDelete(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entries") {
      return handleEntryInstanceList(req, res, url, sendJson);
    }

    if (req.method === "POST" && url.pathname === "/api/entries") {
      return handleEntryInstanceCreate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/entries\/[^/]+\/update$/.test(url.pathname)) {
      return handleEntryInstanceUpdate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/entries\/[^/]+\/disable$/.test(url.pathname)) {
      return handleEntryInstanceDisable(req, res, url, sendJson);
    }

    if (req.method === "GET" && url.pathname === "/api/entries/qrs") {
      return handleQrAssetList(req, res, url, sendJson);
    }

    if (req.method === "POST" && url.pathname === "/api/routes") {
      return handleRouteCreate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/routes\/[^/]+\/update$/.test(url.pathname)) {
      return handleRouteUpdate(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && /^\/api\/routes\/[^/]+\/enable$/.test(url.pathname)) {
      return handleRouteEnable(req, res, url, sendJson);
    }

    if (req.method === "POST" && /^\/api\/routes\/[^/]+\/disable$/.test(url.pathname)) {
      return handleRouteDisable(req, res, url, sendJson);
    }

    if (req.method === "POST" && url.pathname === "/api/routes/test-match") {
      return handleRouteTestMatch(req, res, url, sendJson, readBody);
    }

    // ── 卡券（用户端公开）────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/user/coupons") {
      return handleUserCouponList(req, res, url, sendJson);
    }

    // ── 卡券管理 ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/coupon/list") {
      return handleCouponList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/coupon/add") {
      return handleCouponAdd(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/coupon/update") {
      return handleCouponUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/coupon/delete") {
      return handleCouponDelete(req, res, url, sendJson, readBody);
    }

    if (req.method === "GET" && url.pathname === "/api/growth/line/config") {
      const cfg = loadLineConfig();

      if (!cfg) {
        return ok(res, null, "未配置");
      }

      // 不回传敏感值明文，只返回是否已存在
      return ok(res, {
        channelId: cfg.channelId || "",
        officialAccountId: cfg.officialAccountId || "",
        liffId: cfg.liffId || "",
        requireFollow: !!cfg.requireFollow,
        hasChannelSecret: !!cfg.channelSecret,
        hasChannelAccessToken: !!cfg.channelAccessToken
      });
    }

    if (req.method === "POST" && url.pathname === "/api/growth/line/config/save") {
      const body = await readBody(req);

      if (!body.channelId || !String(body.channelId).trim()) {
        return fail(res, 400, "channelId 必填");
      }

      const current = loadLineConfig() || {};
      const nextConfig = {
        channelId: String(body.channelId || "").trim(),
        officialAccountId: String(body.officialAccountId || "").trim(),
        liffId: String(body.liffId || "").trim(),
        requireFollow: !!body.requireFollow,
        // 留空保持不变
        channelSecret:
          body.channelSecret && String(body.channelSecret).trim()
            ? String(body.channelSecret).trim()
            : (current.channelSecret || ""),
        channelAccessToken:
          body.channelAccessToken && String(body.channelAccessToken).trim()
            ? String(body.channelAccessToken).trim()
            : (current.channelAccessToken || ""),
        updatedAt: new Date().toISOString()
      };

      saveLineConfig(nextConfig);

      return ok(res, {
        channelId: nextConfig.channelId,
        officialAccountId: nextConfig.officialAccountId,
        liffId: nextConfig.liffId,
        requireFollow: nextConfig.requireFollow,
        hasChannelSecret: !!nextConfig.channelSecret,
        hasChannelAccessToken: !!nextConfig.channelAccessToken
      }, "保存成功");
    }

    // ── 落地页模板层 ─────────────────────────────────────────────────────────
    if (req.method === "GET" && /^\/api\/landing-templates\/[^/]+$/.test(url.pathname)) {
      return handleLandingTemplateGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/landing-templates") {
      return handleLandingTemplateCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/landing-templates\/[^/]+$/.test(url.pathname)) {
      return handleLandingTemplateUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/creative-landing-bindings") {
      return handleCreativeBindingList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/creative-landing-bindings") {
      return handleCreativeBindingCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/follow/success-dispatch") {
      return handleFollowSuccessDispatch(req, res, url, sendJson, readBody);
    }

    // ── 玩法程序 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/game-programs") {
      return handleGameProgramList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/game-programs") {
      return handleGameProgramCreate(req, res, url, sendJson, await readBody(req));
    }
    if (req.method === "PUT" && /^\/api\/game-programs\/[^/]+$/.test(url.pathname)) {
      return handleGameProgramUpdate(req, res, url, sendJson, await readBody(req));
    }
    if (req.method === "DELETE" && /^\/api\/game-programs\/[^/]+$/.test(url.pathname)) {
      return handleGameProgramDelete(req, res, url, sendJson);
    }

    // ── 活动模板层 ───────────────────────────────────────────────────────────
    if (req.method === "GET" && /^\/api\/activity-templates\/[^/]+$/.test(url.pathname)) {
      return handleActivityTemplateGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-templates") {
      return handleActivityTemplateCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/activity-templates\/[^/]+$/.test(url.pathname)) {
      return handleActivityTemplateUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/activities") {
      return handleActivityList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activities") {
      return handleActivityCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && /^\/api\/activities\/[^/]+$/.test(url.pathname)) {
      return handleActivityGet(req, res, url, sendJson);
    }
    if (req.method === "PUT" && /^\/api\/activities\/[^/]+$/.test(url.pathname)) {
      return handleActivityUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "DELETE" && /^\/api\/activities\/[^/]+$/.test(url.pathname)) {
      return handleActivityDelete(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/activity-product-bindings") {
      return handleActivityProductBindingList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-product-bindings") {
      return handleActivityProductBindingCreate(req, res, url, sendJson, readBody);
    }

    // ── 商品模板层 ───────────────────────────────────────────────────────────
    if (req.method === "GET" && /^\/api\/product-templates\/[^/]+$/.test(url.pathname)) {
      return handleProductTemplateGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/product-templates") {
      return handleProductTemplateCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/product-templates\/[^/]+$/.test(url.pathname)) {
      return handleProductTemplateUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && /^\/api\/digital-products\/[^/]+$/.test(url.pathname)) {
      return handleDigitalProductGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/digital-products") {
      return handleDigitalProductCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/digital-products\/[^/]+$/.test(url.pathname)) {
      return handleDigitalProductUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/products/claim") {
      return handleProductClaim(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/products/exchange") {
      return handleProductExchange(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/products/purchase") {
      return handleProductPurchase(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/products/use") {
      return handleProductUse(req, res, url, sendJson, readBody);
    }

    // ── 互动工具管理 ─────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/activity-prizes") {
      return handlePrizeList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-prizes") {
      return handlePrizeCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/activity-prizes\/[^/]+$/.test(url.pathname)) {
      return handlePrizeUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "DELETE" && /^\/api\/activity-prizes\/[^/]+$/.test(url.pathname)) {
      return handlePrizeDelete(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/activity-fortune-themes") {
      return handleFortuneThemeList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-fortune-themes") {
      return handleFortuneThemeCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/activity-signs") {
      return handleSignList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-signs") {
      return handleSignCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-chances/grant") {
      return handleGrantChance(req, res, url, sendJson, readBody);
    }

    // ── 三种互动工具执行 ─────────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/activity/wheel/start") {
      return handleWheelStart(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity/wheel/draw") {
      return handleWheelDraw(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity/scratch/start") {
      return handleScratchStart(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity/scratch/reveal") {
      return handleScratchReveal(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity/fortune/start") {
      return handleFortuneStart(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/activity/fortune/draw") {
      return handleFortuneDraw(req, res, url, sendJson, readBody);
    }

    // ── AI Agent 用户端 ──────────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/agent/session/init") {
      return handleAgentSessionInit(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/agent/session/latest") {
      return handleAgentSessionLatest(req, res, url, sendJson);
    }
    if (req.method === "GET" && /^\/api\/agent\/session\/[^/]+\/messages$/.test(url.pathname)) {
      return handleAgentGetMessages(req, res, url, sendJson);
    }
    if (req.method === "POST" && /^\/api\/agent\/session\/[^/]+\/message$/.test(url.pathname)) {
      return handleAgentSendMessage(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/agent\/session\/[^/]+\/confirm$/.test(url.pathname)) {
      return handleAgentConfirm(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/agent/capabilities") {
      return handleAgentCapabilities(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/agent/quick-prompts") {
      return handleAgentQuickPrompts(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/agent/llm/health") {
      return handleAgentLLMHealth(req, res, url, sendJson);
    }

    // ── AI Agent 管理端 ──────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/admin/agent/config") {
      return handleAdminAgentConfigGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/agent/config/update") {
      return handleAdminAgentConfigUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/agent/intents") {
      return handleAdminAgentIntentsGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/agent/intents/update") {
      return handleAdminAgentIntentsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/agent/tools") {
      return handleAdminAgentToolsGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/agent/tools/update") {
      return handleAdminAgentToolsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/agent/logs") {
      return handleAdminAgentLogsGet(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/agent/metrics") {
      return handleAdminAgentMetricsGet(req, res, url, sendJson);
    }

    // ── Agent 配置管理（新增数据表 CRUD）────────────────────────────────────

    // Agents 基础信息
    if (req.method === "GET" && url.pathname === "/api/admin/agents") {
      return handleAgentsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/agents\/[^/]+\/update$/.test(url.pathname)) {
      return handleAgentsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/agents\/[^/]+\/toggle$/.test(url.pathname)) {
      return handleAgentToggle(req, res, url, sendJson, readBody);
    }

    // 角色关键词
    if (req.method === "GET" && url.pathname === "/api/admin/agent-keywords") {
      return handleKeywordsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/agent-keywords/save") {
      return handleKeywordsSave(req, res, url, sendJson, readBody);
    }

    // Skills
    if (req.method === "GET" && url.pathname === "/api/admin/agent-skills") {
      return handleSkillsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/agent-skills") {
      return handleSkillsCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/agent-skills\/\d+\/update$/.test(url.pathname)) {
      return handleSkillsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/agent-skills\/\d+\/delete$/.test(url.pathname)) {
      return handleSkillsDelete(req, res, url, sendJson);
    }

    // 问问卡片模板
    if (req.method === "GET" && url.pathname === "/api/admin/wenwen/card-templates") {
      return handleCardTemplatesList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/wenwen/card-templates") {
      return handleCardTemplatesCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/wenwen\/card-templates\/\d+\/update$/.test(url.pathname)) {
      return handleCardTemplatesUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/wenwen\/card-templates\/\d+\/delete$/.test(url.pathname)) {
      return handleCardTemplatesDelete(req, res, url, sendJson);
    }

    // 协议内容
    if (req.method === "GET" && url.pathname === "/api/admin/wenwen/policy-contents") {
      return handlePolicyContentsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/wenwen/policy-contents/save") {
      return handlePolicyContentsSave(req, res, url, sendJson, readBody);
    }

    // 业务 KPI 指标
    if (req.method === "GET" && url.pathname === "/api/admin/biz/kpi-metrics") {
      return handleKpiMetricsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/biz/kpi-metrics") {
      return handleKpiMetricsCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/kpi-metrics\/\d+\/update$/.test(url.pathname)) {
      return handleKpiMetricsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/kpi-metrics\/\d+\/delete$/.test(url.pathname)) {
      return handleKpiMetricsDelete(req, res, url, sendJson);
    }

    // 报表模板
    if (req.method === "GET" && url.pathname === "/api/admin/biz/report-templates") {
      return handleReportTemplatesList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/biz/report-templates") {
      return handleReportTemplatesCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/report-templates\/\d+\/update$/.test(url.pathname)) {
      return handleReportTemplatesUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/report-templates\/\d+\/delete$/.test(url.pathname)) {
      return handleReportTemplatesDelete(req, res, url, sendJson);
    }

    // 预警规则
    if (req.method === "GET" && url.pathname === "/api/admin/biz/alert-rules") {
      return handleAlertRulesList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/biz/alert-rules") {
      return handleAlertRulesCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/alert-rules\/\d+\/update$/.test(url.pathname)) {
      return handleAlertRulesUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/alert-rules\/\d+\/delete$/.test(url.pathname)) {
      return handleAlertRulesDelete(req, res, url, sendJson);
    }

    // 动作建议模板
    if (req.method === "GET" && url.pathname === "/api/admin/biz/action-suggestions") {
      return handleActionSuggestionsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/biz/action-suggestions") {
      return handleActionSuggestionsCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/action-suggestions\/\d+\/update$/.test(url.pathname)) {
      return handleActionSuggestionsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/biz\/action-suggestions\/\d+\/delete$/.test(url.pathname)) {
      return handleActionSuggestionsDelete(req, res, url, sendJson);
    }

    // 运维故障类型字典
    if (req.method === "GET" && url.pathname === "/api/admin/ops/issue-types") {
      return handleIssueTypesList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/ops/issue-types") {
      return handleIssueTypesCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/ops\/issue-types\/\d+\/update$/.test(url.pathname)) {
      return handleIssueTypesUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/ops\/issue-types\/\d+\/delete$/.test(url.pathname)) {
      return handleIssueTypesDelete(req, res, url, sendJson);
    }

    // 运维修复动作字典
    if (req.method === "GET" && url.pathname === "/api/admin/ops/repair-actions") {
      return handleRepairActionsList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/ops/repair-actions") {
      return handleRepairActionsCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/ops\/repair-actions\/\d+\/update$/.test(url.pathname)) {
      return handleRepairActionsUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && /^\/api\/admin\/ops\/repair-actions\/\d+\/delete$/.test(url.pathname)) {
      return handleRepairActionsDelete(req, res, url, sendJson);
    }

    // ── 用户端积分接口 ────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/growth/user/points/summary") {
      return handleUserPointsSummary(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/growth/user/points/ledger") {
      return handleUserPointsLedger(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/growth/user/points/redeems") {
      return handleUserPointsRedeems(req, res, url, sendJson);
    }

    // ── 管理端积分接口 ────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/growth/admin/points/accounts") {
      return handleAdminPointsAccounts(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/growth/admin/points/share-relations") {
      return handleAdminShareRelations(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/growth/admin/points/consume-relations") {
      return handleAdminConsumeRelations(req, res, url, sendJson);
    }

    // ── 积分规则 & 手工调整 ───────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/growth/points/rules") {
      return handlePointsRules(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/growth/points/adjust") {
      return handlePointsAdjust(req, res, url, sendJson, readBody);
    }

    if (req.method === "POST" && url.pathname === "/api/translate") {
      return handleTranslate(req, res, url, sendJson, readBody);
    }

    // ── 阶段三：用户端综合资料接口 ───────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/user/profile") {
      return handleUserProfile(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/prizes") {
      return handleUserPrizes(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/benefits") {
      return handleUserBenefits(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/orders") {
      return handleUserOrders(req, res, url, sendJson);
    }

    return fail(res, 404, "Route not found", { error: "NOT_FOUND" });
  } catch (err) {
    return fail(res, 500, err?.message || "SERVER_ERROR");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CityOne growth backend listening on http://0.0.0.0:${PORT}`);
});
