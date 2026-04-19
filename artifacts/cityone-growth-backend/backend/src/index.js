// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，identify / profile / check-follow / continue 入口不得偏离统一主链。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testConnection, warmupPool } from "./db/pool.js";
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
  handlePromoList,
  handlePromoStats,
  handlePromoCreate,
  handlePromoUpdate,
  handlePromoDelete,
} from "./routes/station-promo.js";
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
  handleGetAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
  handleSetDefaultAddress,
} from "./routes/address.js";
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
  handleGrantChance,
  handleGetUserChances,
  handleWheelStart,
  handleWheelDraw,
  handleScratchStart,
  handleScratchReveal
} from "./routes/interactions.js";
import {
  handleUserPointsSummary,
  handleUserPointsLedger,
  handleUserPointsRedeems,
  handleAdminPointsAccounts,
  handleAdminShareRelations,
  handleAdminConsumeRelations,
  handlePointsRules,
  handlePointsRuleCreate,
  handlePointsRuleDelete,
  handlePointsAdjust,
  handlePointsRuleUpdate,
  handlePointsRuleToggle,
  handleAdminAttribution,
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
  handleAdminAgentIntentsCreate,
  handleAdminAgentIntentsUpdate,
  handleAdminAgentToolsGet,
  handleAdminAgentToolsUpdate,
  handleAdminAgentLogsGet,
  handleAdminAgentMetricsGet,
  handleAgentLLMHealth
} from "./routes/agent.js";
import { handleTranslate, handleTranslateBatch, handleTranslateItem } from "./routes/translate.js";
import {
  handleDashboardStats,
  handleGrowthReport,
} from "./routes/dashboard.js";
import {
  handleAttributionOverview,
  handleAttributionByObject,
  handleAttributionByChannel,
  handleAttributionBySource,
} from "./routes/attribution.js";
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
  handleGetStationBenefits,
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
  handleSyncProfile,
  handleLineWebhook,
  handleSetFan,
  handleUserIdentify,
} from "./routes/user-profile.js";
import {
  handlePendingIntentIssue,
  handlePendingIntentConsume,
} from "./routes/pending-intents.js";
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
  handleSeedIntentVectors,
  handleReEmbedIntent,
  handleRecallTest,
  handleIntentLabelsList,
} from "./routes/agent-admin.js";
import {
  handleDeviceBorrowEventWebhook,
  handleStationSyncWebhook,
} from "./routes/a-system.js";
import {
  handleUserCouponList,
  handleCouponClaim,
  handleCouponExchangeMallItem,
  handleCouponList,
  handleCouponAdd,
  handleCouponUpdate,
  handleCouponDelete,
  handleCouponStats,
  handleVerifyLookup,
  handleVerifyUse,
  handleVerifyList,
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
import {
  handleGetInviteConfig,
  handleSaveInviteConfig,
  handleGetInviteStats,
  handleGetInviteRelations,
} from "./routes/invite.js";

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

function handleUpload(req, res) {
  return fail(res, 410, "旧版本地上传入口已停用，请改用 /api/media/upload（OSS）");
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-A-System-Sign"
};

// 安全响应头（防 XSS、点击劫持、MIME 嗅探）
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// ─── 简单内存限频器（登录接口防暴力破解）────────────────────────────────────
const _rateBuckets = new Map(); // key → { count, resetAt }
function checkRateLimit(key, maxPerMinute = 10) {
  const now = Date.now();
  let bucket = _rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + 60_000 };
    _rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= maxPerMinute;
}
// 每小时清理过期 bucket
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rateBuckets) { if (now > v.resetAt) _rateBuckets.delete(k); }
}, 3_600_000).unref();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS,
    ...SECURITY_HEADERS,
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
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      if (!checkRateLimit(`login:${ip}`, 10)) {
        return fail(res, 429, "请求过于频繁，请 1 分钟后再试", { error: "TOO_MANY_REQUESTS" });
      }
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

    // ── 客户管理（visitor / fan / customer / member） ───────────────────
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

    // ── 站点推广码（桌贴/海报/店员）──────────────────────────────────────────
    if (req.method === "GET"  && url.pathname === "/api/growth/station-promo/list")
      return handlePromoList(req, res, url, sendJson);
    if (req.method === "GET"  && url.pathname === "/api/growth/station-promo/stats")
      return handlePromoStats(req, res, url, sendJson);
    if (req.method === "POST" && url.pathname === "/api/growth/station-promo/create")
      return handlePromoCreate(req, res, url, sendJson, readBody);
    if (req.method === "POST" && url.pathname === "/api/growth/station-promo/update")
      return handlePromoUpdate(req, res, url, sendJson, readBody);
    if (req.method === "POST" && url.pathname === "/api/growth/station-promo/delete")
      return handlePromoDelete(req, res, url, sendJson, readBody);

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
    if (req.method === "POST" && url.pathname === "/api/user/coupons/exchange-mall-item") {
      return handleCouponExchangeMallItem(req, res, url, sendJson, readBody);
    }

    // ── 卡券管理 ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/coupon/list") {
      return handleCouponList(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/coupon/stats") {
      return handleCouponStats(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/coupon/verify/lookup") {
      return handleVerifyLookup(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/coupon/verify/list") {
      return handleVerifyList(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/coupon/verify/use") {
      return handleVerifyUse(req, res, url, sendJson, readBody);
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

    // ─── 前端事件埋点接收（dev / prod 通用，带容量保护）────────────────────
    // 前端 clientLogger 把关键事件 POST 过来，append 到 data/client-events.jsonl。
    // 我（agent）grep 这个文件就能精确还原用户在 iframe 里每一步发生了什么。
    //
    // prod 防污染策略：
    //   1. 文件 > 5MB 时切换写入到 .1 备份再清空主文件（最多保留 1 份历史）
    //   2. 通过环境变量 DISABLE_CLIENT_LOG=1 可彻底关闭（紧急止血用）
    if (req.method === "POST" && url.pathname === "/api/growth/client-log") {
      if (process.env.DISABLE_CLIENT_LOG === "1") {
        return ok(res, { received: false, reason: "disabled" });
      }
      try {
        const body = await readBody(req);
        const events = Array.isArray(body?.events) ? body.events : [body];
        const dataDir = path.join(__dirname, "..", "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const logFile = path.join(dataDir, "client-events.jsonl");

        // 容量上限保护：超过 5MB 滚动一次，避免 prod 长时间累积撑爆磁盘
        try {
          const st = fs.existsSync(logFile) ? fs.statSync(logFile) : null;
          if (st && st.size > 5 * 1024 * 1024) {
            const rotated = logFile + ".1";
            try { fs.unlinkSync(rotated); } catch { /* not exist */ }
            fs.renameSync(logFile, rotated);
          }
        } catch { /* 滚动失败不影响 append */ }

        const lines = events.map((e) => {
          const enriched = {
            server_ts: new Date().toISOString(),
            ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim(),
            ua: req.headers["user-agent"] || "",
            ...e,
          };
          return JSON.stringify(enriched);
        }).join("\n") + "\n";
        fs.appendFileSync(logFile, lines);
      } catch (err) {
        // 日志接收失败不影响业务，吞掉
      }
      return ok(res, { received: true });
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
        isReadyForFollowGate: !!cfg.channelId && !!cfg.officialAccountId && !!cfg.liffId,
        hasChannelSecret: !!cfg.channelSecret,
        hasChannelAccessToken: !!cfg.channelAccessToken
      });
    }

    if (req.method === "POST" && url.pathname === "/api/growth/line/config/save") {
      const body = await readBody(req);
      const requireFollow = !!body.requireFollow;
      const officialAccountId = String(body.officialAccountId || "").trim();
      const liffId = String(body.liffId || "").trim();

      if (!body.channelId || !String(body.channelId).trim()) {
        return fail(res, 400, "channelId 必填");
      }
      if (requireFollow && !officialAccountId) {
        return fail(res, 400, "开启关注门控时必须填写真实 LINE 官方账号 ID");
      }
      if (requireFollow && !liffId) {
        return fail(res, 400, "开启关注门控时必须填写真实 LINE LIFF ID");
      }

      const current = loadLineConfig() || {};
      const nextConfig = {
        channelId: String(body.channelId || "").trim(),
        officialAccountId,
        liffId,
        requireFollow,
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
        isReadyForFollowGate: !!nextConfig.channelId && !!nextConfig.officialAccountId && !!nextConfig.liffId,
        hasChannelSecret: !!nextConfig.channelSecret,
        hasChannelAccessToken: !!nextConfig.channelAccessToken
      }, "保存成功");
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

    // ── 收货地址 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/user/addresses") {
      return handleGetAddresses(req, res, sendJson, url);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/user/addresses") {
      const body = await readBody(req);
      return handleCreateAddress(req, res, sendJson, body);
    }
    if (req.method === "PUT" && /^\/api\/growth\/user\/addresses\/[^/]+$/.test(url.pathname)) {
      const addrId = url.pathname.split("/").pop();
      const body = await readBody(req);
      return handleUpdateAddress(req, res, sendJson, body, addrId);
    }
    if (req.method === "DELETE" && /^\/api\/growth\/user\/addresses\/[^/]+$/.test(url.pathname)) {
      const addrId = url.pathname.split("/").pop();
      return handleDeleteAddress(req, res, sendJson, url, addrId);
    }
    if (req.method === "POST" && /^\/api\/growth\/user\/addresses\/[^/]+\/default$/.test(url.pathname)) {
      const addrId = url.pathname.split("/").at(-2);
      const body = await readBody(req);
      return handleSetDefaultAddress(req, res, sendJson, body, addrId);
    }

    // ── 仪表板 ───────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/dashboard/stats") {
      return handleDashboardStats(req, res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/growth-report") {
      return handleGrowthReport(req, res, url, sendJson);
    }

    // ── 归因中心 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/attribution/overview") {
      return handleAttributionOverview(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/attribution/by-object") {
      return handleAttributionByObject(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/attribution/by-channel") {
      return handleAttributionByChannel(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/attribution/by-source") {
      return handleAttributionBySource(req, res, url, sendJson);
    }

    // ── 站点管理 ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/stations/city-districts") {
      return handleGetCityDistricts(req, res, sendJsonCached30);
    }
    if (req.method === "GET" && url.pathname === "/api/stations/nearby") {
      return await handleGetNearbyStations(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/stations/benefits") {
      return await handleGetStationBenefits(req, res, url, sendJson);
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
    if (req.method === "POST" && url.pathname === "/api/admin/agent/intents/create") {
      return handleAdminAgentIntentsCreate(req, res, url, sendJson, readBody);
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

    // ── 向量意图管理（语义召回）──────────────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/api/agent-admin/seed-intent-vectors") {
      return handleSeedIntentVectors(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/agent-admin/re-embed-intent") {
      return handleReEmbedIntent(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/agent-admin/recall-test") {
      return handleRecallTest(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/agent-admin/intent-labels") {
      return handleIntentLabelsList(req, res, url, sendJson);
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
    if (req.method === "POST" && url.pathname === "/api/growth/points/rules/create") {
      return handlePointsRuleCreate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/points/rules/delete") {
      return handlePointsRuleDelete(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/points/rules/update") {
      return handlePointsRuleUpdate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/points/rules/toggle") {
      return handlePointsRuleToggle(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/points/adjust") {
      return handlePointsAdjust(req, res, url, sendJson, readBody);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/admin/points/attribution") {
      return handleAdminAttribution(req, res, url, sendJson);
    }

    // ── 邀请裂变配置 ─────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/api/growth/invite/config") {
      return handleGetInviteConfig(req, res, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/growth/invite/config/save") {
      return handleSaveInviteConfig(req, res, sendJson, await readBody(req));
    }
    if (req.method === "GET" && url.pathname === "/api/growth/invite/stats") {
      return handleGetInviteStats(req, res, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/growth/invite/relations") {
      return handleGetInviteRelations(req, res, sendJson, url);
    }

    if (req.method === "POST" && url.pathname === "/api/translate") {
      return handleTranslate(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/translate-batch") {
      return handleTranslateBatch(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/translate-item") {
      return handleTranslateItem(req, res, url, sendJson, readBody);
    }

    // ── 阶段三：用户端综合资料接口 ───────────────────────────────────────────
    if (req.method === "GET" && (url.pathname === "/api/user/profile" || url.pathname === "/api/user/profile/me")) {
      return await handleUserProfile(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/prizes") {
      return handleUserPrizes(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/benefits") {
      return await handleUserBenefits(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/check-follow") {
      return handleCheckFollow(req, res, url, sendJson);
    }
    if (req.method === "GET" && url.pathname === "/api/user/orders") {
      return handleUserOrders(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/user/sync-profile") {
      const body = await readBody(req);
      return handleSyncProfile(req, res, body, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      const body = await readBody(req);
      return handleLineWebhook(req, res, body, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/user/set-fan") {
      const body = await readBody(req);
      return handleSetFan(req, res, body, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/user/identify") {
      const body = await readBody(req);
      return handleUserIdentify(req, res, body, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/user/pending-intents") {
      return handlePendingIntentIssue(req, res, url, sendJson, readBody);
    }
    if (req.method === "POST" && url.pathname === "/api/user/pending-intents/consume") {
      return handlePendingIntentConsume(req, res, url, sendJson, readBody);
    }

    // ─── A 系统旁路连接接口（占位，返回 501 直至联调启用）────────────────────
    if (req.method === "POST" && url.pathname === "/api/a-system/webhook/device-borrow-event") {
      return handleDeviceBorrowEventWebhook(req, res, url, sendJson);
    }
    if (req.method === "POST" && url.pathname === "/api/a-system/webhook/station-sync") {
      return handleStationSyncWebhook(req, res, url, sendJson);
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
    await warmupPool(3);
  } catch (err) {
    console.error("[DB] Startup error:", err.message);
    console.error("[DB] Backend will continue but DB-backed routes may fail until DB is available.");
  }
});

// ─── 全局进程异常保护（防止意外崩溃）───────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err.message, err.stack);
  // 不退出进程，保持服务在线
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});
