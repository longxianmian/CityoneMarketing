import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import busboy from "busboy";
import crypto from "node:crypto";
import { testConnection } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
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
  handleLandingTemplateList,
  handleLandingTemplateGet,
  handleLandingTemplateCreate,
  handleLandingTemplateUpdate,
  handleLandingTemplateDelete,
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
  handleGetMallItems,
  handleGetMallItemById,
  handleCreateMallItem,
  handleUpdateMallItem,
  handleDeleteMallItem,
  handleGetMallOrders,
  handleMallRedeem,
  handleGetMallRedeems,
} from "./routes/mall-items.js";
import {
  handleGetBanners,
  handleCreateBanner,
  handleUpdateBanner,
  handleDeleteBanner,
} from "./routes/banners.js";
import {
  handleActivityTemplateList,
  handleActivityTemplateGet,
  handleActivityTemplateCreate,
  handleActivityTemplateUpdate,
  handleActivityList,
  handleActivityGet,
  handleActivityCreate,
  handleActivityUpdate,
  handleActivityDelete,
  handleActivityProductBindingList,
  handleActivityProductBindingCreate,
  handleActivityParticipate,
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
  handleGetUserChances,
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
  handleDashboardStats,
  handleGrowthReport,
} from "./routes/dashboard.js";
import {
  requireAuth,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminMe,
  handleChangePassword,
  handleListAdmins,
  handleCreateAdmin,
  handleUpdateAdmin,
  handleDeleteAdmin,
} from "./routes/auth.js";
import {
  handleListMembers,
  handleGetMemberConfig,
  handleUpdateMemberConfig,
  handleSetMember,
  handleCheckChargingDiscount,
} from "./routes/members.js";
import {
  handleRoleTemplates,
  handleSuperListAccounts,
  handleSuperCreateAccount,
  handleSuperUpdateAccount,
  handleSuperDeleteAccount,
  handleSuperResetPassword,
  handleAdminListMyAccounts,
  handleAdminCreateMyAccount,
  handleAdminUpdateMyAccount,
  handleAdminDeleteMyAccount,
  handleAdminResetMyPassword,
} from "./routes/accounts.js";
import {
  handleGetCityDistricts,
  handleGetStations,
  handleGetNearbyStations,
  handleGetStation,
  handleCreateStation,
  handleUpdateStation,
  handleDeleteStation,
  handleGetStationChain,
} from "./routes/stations.js";
import {
  handleUserProfile,
  handleCheckFollow,
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
  handleDeviceBorrowEventWebhook,
  handleStationSyncWebhook,
} from "./routes/a-system.js";
import {
  handleUserCouponList,
  handleCouponClaim,
  handleCouponList,
  handleCouponAdd,
  handleCouponUpdate,
  handleCouponDelete,
} from "./routes/coupons.js";
import {
  handleMessageList,
  handleMessageSave,
  handleMessageDelete,
  handleMessageTest,
} from "./routes/messages.js";
import {
  handleMediaUpload,
  handleMediaViewUrl,
  handleMediaDelete,
} from "./routes/media.js";

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
  const stat = fs.statSync(filePath);
  const etag = `"${stat.size}-${stat.mtimeMs.toString(36)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ...CORS_HEADERS });
    return res.end();
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm"
  };
  const mime = mimeMap[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Cache-Control": "public, max-age=2592000, immutable",
    "ETag": etag,
    "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
    ...CORS_HEADERS
  });
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

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(payload, null, 2));
}

function makeCachedSendJson(maxAge = 30) {
  return function sendJsonCached(res, statusCode, payload) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    };
    if (statusCode === 200) {
      headers["Cache-Control"] = `public, max-age=${maxAge}, stale-while-revalidate=60`;
    }
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(payload, null, 2));
  };
}
const sendJsonCached30 = makeCachedSendJson(30);

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

  // JWT 鉴权：解析 Authorization 头，挂载 req._admin（可为 null）
  req._admin = requireAuth(req);

  try {
    // ── 管理端认证 ────────────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      return await handleAdminLogin(req, await readBody(req), res, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      return handleAdminLogout(req, res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/me") {
      return await handleAdminMe(req, res, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/change-password") {
      return await handleChangePassword(req, await readBody(req), res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/admins") {
      return await handleListAdmins(req, res, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/admins") {
      return await handleCreateAdmin(req, await readBody(req), res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/admins\/\d+\/update$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleUpdateAdmin(req, await readBody(req), id, res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/admins\/\d+\/delete$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleDeleteAdmin(req, id, res, sendJson);
    }

    // ── 超管中心：全量账号管理（super_admin only）─────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/admin/accounts") {
      return await handleSuperListAccounts(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/accounts") {
      return await handleSuperCreateAccount(req, await readBody(req), res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/accounts\/\d+\/update$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleSuperUpdateAccount(req, await readBody(req), id, res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/accounts\/\d+\/delete$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleSuperDeleteAccount(req, id, res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/accounts\/\d+\/reset-password$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleSuperResetPassword(req, await readBody(req), id, res, sendJson);
    }

    // ── 系统管理员：操作员管理 ─────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/admin/my-accounts") {
      return await handleAdminListMyAccounts(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/my-accounts") {
      return await handleAdminCreateMyAccount(req, await readBody(req), res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/my-accounts\/\d+\/update$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleAdminUpdateMyAccount(req, await readBody(req), id, res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/my-accounts\/\d+\/delete$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleAdminDeleteMyAccount(req, id, res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/my-accounts\/\d+\/reset-password$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return await handleAdminResetMyPassword(req, await readBody(req), id, res, sendJson);
    }

    // ── 角色模板 ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/admin/role-templates") {
      return await handleRoleTemplates(req, res, sendJson);
    }

    // ── 客户管理（三层人群：粉丝 / 用户 / 会员） ──────────────────────────
    if (req.method === "GET" && (url.pathname === "/api/admin/customers" || url.pathname === "/api/admin/members")) {
      return await handleListMembers(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/admin/member-config") {
      return await handleGetMemberConfig(req, res, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/member-config/update") {
      return await handleUpdateMemberConfig(req, await readBody(req), res, sendJson);
    }
    if (req.method === "POST" && /^\/api\/admin\/(customers|members)\/[^/]+\/set-member$/.test(url.pathname)) {
      const userId = url.pathname.split("/")[4];
      return await handleSetMember(req, await readBody(req), userId, res, sendJson);
    }

    // ── 充电折扣旁路查询接口（阶段四对接 A 系统） ──────────────────────────
    if (req.method === "GET" && url.pathname === "/api/charging-discount/check") {
      return await handleCheckChargingDiscount(req, res, url, sendJson);
    }

    // ── 媒体资产（OSS） ────────────────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      return handleMediaUpload(req, res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/media/view-url") {
      return handleMediaViewUrl(req, res, sendJson, url);
    }
    if (req.method === "DELETE" && /^\/api\/media\/[^/]+$/.test(url.pathname)) {
      const assetId = url.pathname.split("/").pop();
      return handleMediaDelete(req, res, sendJson, assetId);
    }

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
      return handleUserCouponList(req, res, url, sendJsonCached30);
    }
    if (req.method === "POST" && url.pathname === "/api/user/coupons/claim") {
      return handleCouponClaim(req, res, url, sendJson, readBody);
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
    if (req.method === "GET" && url.pathname === "/api/landing-templates") {
      return handleLandingTemplateList(req, res, url, sendJson);
    }
    if (req.method === "GET" && /^\/api\/landing-templates\/[^/]+$/.test(url.pathname)) {
      return handleLandingTemplateGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/landing-templates") {
      return handleLandingTemplateCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/landing-templates\/[^/]+$/.test(url.pathname)) {
      return handleLandingTemplateUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "DELETE" && /^\/api\/landing-templates\/[^/]+$/.test(url.pathname)) {
      return handleLandingTemplateDelete(req, res, url, sendJson);
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

    // ── 广告 Banner ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/banners") {
      return handleGetBanners(req, res, sendJson, url);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/banners") {
      return handleCreateBanner(req, res, sendJson, await readBody(req));
    }
    if (req.method === "PUT" && /^\/api\/growth\/banners\/[^/]+$/.test(url.pathname)) {
      const bannerId = url.pathname.split("/").pop();
      return handleUpdateBanner(req, res, sendJson, await readBody(req), bannerId);
    }
    if (req.method === "DELETE" && /^\/api\/growth\/banners\/[^/]+$/.test(url.pathname)) {
      const bannerId = url.pathname.split("/").pop();
      return handleDeleteBanner(req, res, sendJson, bannerId);
    }

    // ── 商城商品 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && /^\/api\/growth\/mall\/items\/[^/]+$/.test(url.pathname)) {
      const itemId = url.pathname.split("/").pop();
      return handleGetMallItemById(req, res, sendJsonCached30, itemId);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/mall/items") {
      return handleGetMallItems(req, res, sendJsonCached30, url);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/mall/items") {
      return handleCreateMallItem(req, res, sendJson, await readBody(req));
    }
    if (req.method === "PUT" && /^\/api\/growth\/mall\/items\/[^/]+$/.test(url.pathname)) {
      const itemId = url.pathname.split("/").pop();
      return handleUpdateMallItem(req, res, sendJson, await readBody(req), itemId);
    }
    if (req.method === "DELETE" && /^\/api\/growth\/mall\/items\/[^/]+$/.test(url.pathname)) {
      const itemId = url.pathname.split("/").pop();
      return handleDeleteMallItem(req, res, sendJson, itemId);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/mall/orders") {
      return handleGetMallOrders(req, res, sendJson, url);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/mall/redeem") {
      return handleMallRedeem(req, res, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/mall/redeems") {
      return handleGetMallRedeems(req, res, sendJson, url);
    }

    // ── 仪表板 ───────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/dashboard/stats") {
      return handleDashboardStats(req, res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/growth-report") {
      return handleGrowthReport(req, res, sendJson);
    }

    // ── 站点管理 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/stations/city-districts") {
      return handleGetCityDistricts(req, res, sendJsonCached30);
    }
    if (req.method === "GET" && url.pathname === "/api/stations/nearby") {
      return await handleGetNearbyStations(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/stations") {
      return await handleGetStations(req, res, url, sendJson);
    }
    if (req.method === "GET" && /^\/api\/stations\/[^/]+\/chain$/.test(url.pathname)) {
      return await handleGetStationChain(req, res, url, sendJson);
    }
    if (req.method === "GET" && /^\/api\/stations\/[^/]+$/.test(url.pathname)) {
      return await handleGetStation(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/stations") {
      return await handleCreateStation(req, res, sendJson, await readBody(req));
    }
    if (req.method === "PUT" && /^\/api\/stations\/[^/]+$/.test(url.pathname)) {
      return await handleUpdateStation(req, res, url, sendJson, await readBody(req));
    }
    if (req.method === "DELETE" && /^\/api\/stations\/[^/]+$/.test(url.pathname)) {
      return await handleDeleteStation(req, res, url, sendJson);
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
    if (req.method === "GET" && url.pathname === "/api/activity-templates") {
      return handleActivityTemplateList(req, res, url, sendJson);
    }
    if (req.method === "GET" && /^\/api\/activity-templates\/[^/]+$/.test(url.pathname)) {
      return handleActivityTemplateGet(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/activity-templates") {
      return handleActivityTemplateCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "PUT" && /^\/api\/activity-templates\/[^/]+$/.test(url.pathname)) {
      return handleActivityTemplateUpdate(req, res, url, sendJson, readBody);
    }

    // ── 消息管理 ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/message/list") {
      return handleMessageList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/message/save") {
      return handleMessageSave(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/message/delete") {
      return handleMessageDelete(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/message/test") {
      return handleMessageTest(req, res, url, sendJson);
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
    if (req.method === "POST" && /^\/api\/activities\/[^/]+\/participate$/.test(url.pathname)) {
      return handleActivityParticipate(req, res, url, sendJson, readBody);
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
    // 管理端：查询次数列表 GET /api/activities/:id/user-chances
    if (req.method === "GET" && /^\/api\/activities\/[^/]+\/user-chances$/.test(url.pathname)) {
      return handleGetUserChances(req, res, url, sendJson);
    }
    // 管理端次数发放：POST /api/activities/:id/user-chances/grant
    // 前端传 { userId, amount, remark }，转换为标准 handleGrantChance 格式
    const chanceGrantMatch = url.pathname.match(/^\/api\/activities\/([^/]+)\/user-chances\/grant$/);
    if (req.method === "POST" && chanceGrantMatch) {
      const activityId = decodeURIComponent(chanceGrantMatch[1]);
      const origBody = readBody;
      return handleGrantChance(req, res, url, sendJson, async (r) => {
        const rawBody = await origBody(r);
        return {
          activity_id: activityId,
          line_user_id: rawBody.userId || rawBody.line_user_id || "",
          count: Number(rawBody.amount || rawBody.count || 1),
          grant_source: rawBody.remark || rawBody.grant_source || "admin",
        };
      });
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
    if (req.method === "GET" && url.pathname === "/api/growth/user/points/summary") {
      return handleUserPointsSummary(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/user/points/ledger") {
      return handleUserPointsLedger(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/user/points/redeems") {
      return handleUserPointsRedeems(req, res, url, sendJson);
    }

    // ── 管理端积分接口 ────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/admin/points/accounts") {
      return handleAdminPointsAccounts(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/admin/points/share-relations") {
      return handleAdminShareRelations(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/admin/points/consume-relations") {
      return handleAdminConsumeRelations(req, res, url, sendJson);
    }

    // ── 积分规则 & 手工调整 ───────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/points/rules") {
      return handlePointsRules(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/points/adjust") {
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
    if (req.method === "GET" && url.pathname === "/api/user/check-follow") {
      return handleCheckFollow(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/orders") {
      return handleUserOrders(req, res, url, sendJson);
    }

    // ─── A 系统旁路连接接口（占位，返回 501 直至联调启用）────────────────────
    if (req.method === "POST" && url.pathname === "/api/a-system/webhook/device-borrow-event") {
      return handleDeviceBorrowEventWebhook(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/a-system/webhook/station-sync") {
      return handleStationSyncWebhook(req, res, url, sendJson, readBody);
    }

    return fail(res, 404, "Route not found", { error: "NOT_FOUND" });
  } catch (err) {
    return fail(res, 500, err?.message || "SERVER_ERROR");
  }
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`CityOne growth backend listening on http://0.0.0.0:${PORT}`);
  try {
    const dbInfo = await testConnection();
    console.log(`[DB] Connected to "${dbInfo.db}" at ${new Date(dbInfo.now).toISOString()}`);
    await runMigrations();
  } catch (err) {
    console.error("[DB] Startup error:", err.message);
    console.error("[DB] Backend will continue but DB-backed routes may fail until DB is available.");
  }
});
