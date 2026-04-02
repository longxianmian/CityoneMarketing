import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3100;
const DATA_DIR = path.join(__dirname, "..", "data");
const LINE_CONFIG_FILE = path.join(DATA_DIR, "line-config.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
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

  try {
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

    return fail(res, 404, "Route not found", { error: "NOT_FOUND" });
  } catch (err) {
    return fail(res, 500, err?.message || "SERVER_ERROR");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CityOne growth backend listening on http://0.0.0.0:${PORT}`);
});
