import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const ENTRY_TEMPLATES_FILE = path.join(DATA_DIR, "entry-templates.json");
const ENTRY_INSTANCES_FILE = path.join(DATA_DIR, "entry-instances.json");

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, {
    code: 200,
    msg,
    data,
  });
}

function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, {
    code: statusCode,
    msg,
    error: errorCode,
  });
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function defaultTemplates() {
  return [
    {
      template_id: "tpl_001",
      template_name: "桌贴固定码模板",
      entry_type: "table_card",
      default_feature_name: "shake",
      status: "enabled",
    },
    {
      template_id: "tpl_002",
      template_name: "设备固定码模板",
      entry_type: "device_qr",
      default_feature_name: "battery_sos",
      status: "enabled",
    },
  ];
}

function defaultEntries() {
  return [
    {
      entry_id: "entry_001",
      site_id: "site_001",
      site_name: "site_001 示例站点",
      entry_type: "table_card",
      entry_code: "T001",
      current_feature_name: "shake",
      status: "enabled",
    },
    {
      entry_id: "entry_002",
      site_id: "site_001",
      site_name: "site_001 示例站点",
      entry_type: "device_qr",
      entry_code: "D001",
      current_feature_name: "battery_sos",
      status: "enabled",
    },
  ];
}

function loadJsonArray(filePath, fallbackFactory) {
  ensureDataDir();

  if (!fs.existsSync(filePath)) {
    const defaults = fallbackFactory();
    fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallbackFactory();
  } catch (error) {
    return fallbackFactory();
  }
}

function saveJsonArray(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function loadTemplates() {
  return loadJsonArray(ENTRY_TEMPLATES_FILE, defaultTemplates);
}

function saveTemplates(data) {
  saveJsonArray(ENTRY_TEMPLATES_FILE, data);
}

function loadEntries() {
  return loadJsonArray(ENTRY_INSTANCES_FILE, defaultEntries);
}

function saveEntries(data) {
  saveJsonArray(ENTRY_INSTANCES_FILE, data);
}

function nextId(list, prefix, fieldName) {
  const maxNo = list.reduce((max, item) => {
    const raw = String(item[fieldName] || "");
    const m = raw.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (!m) return max;
    return Math.max(max, Number(m[1]));
  }, 0);

  return `${prefix}_${String(maxNo + 1).padStart(3, "0")}`;
}

function templateIdFromPath(pathname) {
  const matched = pathname.match(/^\/api\/entries\/templates\/([^/]+)(?:\/(update|delete))?$/);
  return matched?.[1] || "";
}

function entryIdFromPath(pathname) {
  const matched = pathname.match(/^\/api\/entries\/([^/]+)(?:\/(update|disable))?$/);
  return matched?.[1] || "";
}

export function handleEntryTemplateList(req, res, url, sendJson) {
  const data = loadTemplates();
  return sendOk(res, sendJson, "entry templates loaded", data);
}

export async function handleEntryTemplateCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);

    const templateName = String(body.template_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const defaultFeatureName = String(body.default_feature_name || "").trim();

    if (!templateName) {
      return sendError(res, sendJson, 400, "TEMPLATE_NAME_REQUIRED", "template_name 必填");
    }

    if (!entryType) {
      return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    }

    if (!defaultFeatureName) {
      return sendError(res, sendJson, 400, "DEFAULT_FEATURE_REQUIRED", "default_feature_name 必填");
    }

    const list = loadTemplates();

    const duplicatedTemplate = list.find(
      (item) =>
        String(item.template_name || "").trim().toLowerCase() === templateName.toLowerCase() &&
        String(item.entry_type || "").trim() === entryType
    );

    if (duplicatedTemplate) {
      return sendError(
        res,
        sendJson,
        400,
        "ENTRY_TEMPLATE_DUPLICATED",
        "同一入口类型下已存在同名模板"
      );
    }

    const nextItem = {
      template_id: nextId(list, "tpl", "template_id"),
      template_name: templateName,
      entry_type: entryType,
      default_feature_name: defaultFeatureName,
      status: "enabled",
    };

    list.push(nextItem);
    saveTemplates(list);

    return sendOk(res, sendJson, "entry template created", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_TEMPLATE_CREATE_FAILED",
      error.message || "入口模板创建失败"
    );
  }
}

export async function handleEntryTemplateUpdate(req, res, url, sendJson, readBody) {
  try {
    const templateId = String(templateIdFromPath(url.pathname) || "").trim();
    if (!templateId) {
      return sendError(res, sendJson, 400, "TEMPLATE_ID_REQUIRED", "template_id 必填");
    }

    const body = await readBody(req);
    const templateName = String(body.template_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const defaultFeatureName = String(body.default_feature_name || "").trim();

    if (!templateName) {
      return sendError(res, sendJson, 400, "TEMPLATE_NAME_REQUIRED", "template_name 必填");
    }

    if (!entryType) {
      return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    }

    if (!defaultFeatureName) {
      return sendError(res, sendJson, 400, "DEFAULT_FEATURE_REQUIRED", "default_feature_name 必填");
    }

    const list = loadTemplates();
    const idx = list.findIndex((item) => item.template_id === templateId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ENTRY_TEMPLATE_NOT_FOUND", "未找到对应入口模板");
    }

    const duplicatedTemplate = list.find(
      (item) =>
        item.template_id !== templateId &&
        String(item.template_name || "").trim().toLowerCase() === templateName.toLowerCase() &&
        String(item.entry_type || "").trim() === entryType
    );

    if (duplicatedTemplate) {
      return sendError(
        res,
        sendJson,
        400,
        "ENTRY_TEMPLATE_DUPLICATED",
        "同一入口类型下已存在同名模板"
      );
    }

    const nextItem = {
      ...list[idx],
      template_name: templateName,
      entry_type: entryType,
      default_feature_name: defaultFeatureName,
    };

    list[idx] = nextItem;
    saveTemplates(list);

    return sendOk(res, sendJson, "entry template updated", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_TEMPLATE_UPDATE_FAILED",
      error.message || "入口模板更新失败"
    );
  }
}

export async function handleEntryTemplateDelete(req, res, url, sendJson) {
  try {
    const templateId = String(templateIdFromPath(url.pathname) || "").trim();
    if (!templateId) {
      return sendError(res, sendJson, 400, "TEMPLATE_ID_REQUIRED", "template_id 必填");
    }

    const list = loadTemplates();
    const idx = list.findIndex((item) => item.template_id === templateId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ENTRY_TEMPLATE_NOT_FOUND", "未找到对应入口模板");
    }

    const removed = list.splice(idx, 1)[0];
    saveTemplates(list);

    return sendOk(res, sendJson, "entry template deleted", removed);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_TEMPLATE_DELETE_FAILED",
      error.message || "入口模板删除失败"
    );
  }
}

export function handleEntryInstanceList(req, res, url, sendJson) {
  const data = loadEntries();
  return sendOk(res, sendJson, "entry instances loaded", data);
}

export async function handleEntryInstanceCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);

    const siteId = String(body.site_id || "").trim();
    const siteName = String(body.site_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryCode = String(body.entry_code || "").trim();

    if (!siteId) {
      return sendError(res, sendJson, 400, "SITE_ID_REQUIRED", "site_id 必填");
    }

    if (!siteName) {
      return sendError(res, sendJson, 400, "SITE_NAME_REQUIRED", "site_name 必填");
    }

    if (!entryType) {
      return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    }

    if (!entryCode) {
      return sendError(res, sendJson, 400, "ENTRY_CODE_REQUIRED", "entry_code 必填");
    }

    const list = loadEntries();

    const duplicatedEntry = list.find(
      (item) =>
        String(item.entry_type || "").trim() === entryType &&
        String(item.entry_code || "").trim().toLowerCase() === entryCode.toLowerCase()
    );

    if (duplicatedEntry) {
      return sendError(
        res,
        sendJson,
        400,
        "ENTRY_INSTANCE_DUPLICATED",
        "同一入口类型下入口编码已存在，不能重复创建"
      );
    }

    const currentFeatureName = entryType === "device_qr" ? "battery_sos" : "shake";

    const nextItem = {
      entry_id: nextId(list, "entry", "entry_id"),
      site_id: siteId,
      site_name: siteName,
      entry_type: entryType,
      entry_code: entryCode,
      current_feature_name: currentFeatureName,
      status: "enabled",
    };

    list.push(nextItem);
    saveEntries(list);

    return sendOk(res, sendJson, "entry instance created", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_INSTANCE_CREATE_FAILED",
      error.message || "入口实例创建失败"
    );
  }
}

export async function handleEntryInstanceUpdate(req, res, url, sendJson, readBody) {
  try {
    const entryId = String(entryIdFromPath(url.pathname) || "").trim();
    if (!entryId) {
      return sendError(res, sendJson, 400, "ENTRY_ID_REQUIRED", "entry_id 必填");
    }

    const body = await readBody(req);
    const siteId = String(body.site_id || "").trim();
    const siteName = String(body.site_name || "").trim();
    const entryType = String(body.entry_type || "").trim();
    const entryCode = String(body.entry_code || "").trim();
    const currentFeatureName = String(body.current_feature_name || "").trim();

    if (!siteId) {
      return sendError(res, sendJson, 400, "SITE_ID_REQUIRED", "site_id 必填");
    }

    if (!siteName) {
      return sendError(res, sendJson, 400, "SITE_NAME_REQUIRED", "site_name 必填");
    }

    if (!entryType) {
      return sendError(res, sendJson, 400, "ENTRY_TYPE_REQUIRED", "entry_type 必填");
    }

    if (!entryCode) {
      return sendError(res, sendJson, 400, "ENTRY_CODE_REQUIRED", "entry_code 必填");
    }

    const list = loadEntries();
    const idx = list.findIndex((item) => item.entry_id === entryId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ENTRY_INSTANCE_NOT_FOUND", "未找到对应入口实例");
    }

    const duplicatedEntry = list.find(
      (item) =>
        item.entry_id !== entryId &&
        String(item.entry_type || "").trim() === entryType &&
        String(item.entry_code || "").trim().toLowerCase() === entryCode.toLowerCase()
    );

    if (duplicatedEntry) {
      return sendError(
        res,
        sendJson,
        400,
        "ENTRY_INSTANCE_DUPLICATED",
        "同一入口类型下入口编码已存在，不能重复保存"
      );
    }

    const nextItem = {
      ...list[idx],
      site_id: siteId,
      site_name: siteName,
      entry_type: entryType,
      entry_code: entryCode,
      current_feature_name:
        currentFeatureName || (entryType === "device_qr" ? "battery_sos" : "shake"),
    };

    list[idx] = nextItem;
    saveEntries(list);

    return sendOk(res, sendJson, "entry instance updated", nextItem);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_INSTANCE_UPDATE_FAILED",
      error.message || "入口实例更新失败"
    );
  }
}

export async function handleEntryInstanceDisable(req, res, url, sendJson) {
  try {
    const entryId = String(entryIdFromPath(url.pathname) || "").trim();
    if (!entryId) {
      return sendError(res, sendJson, 400, "ENTRY_ID_REQUIRED", "entry_id 必填");
    }

    const list = loadEntries();
    const idx = list.findIndex((item) => item.entry_id === entryId);

    if (idx < 0) {
      return sendError(res, sendJson, 404, "ENTRY_INSTANCE_NOT_FOUND", "未找到对应入口实例");
    }

    list[idx] = {
      ...list[idx],
      status: "disabled",
    };

    saveEntries(list);

    return sendOk(res, sendJson, "entry instance disabled", list[idx]);
  } catch (error) {
    return sendError(
      res,
      sendJson,
      500,
      "ENTRY_INSTANCE_DISABLE_FAILED",
      error.message || "入口实例停用失败"
    );
  }
}

export function handleQrAssetList(req, res, url, sendJson) {
  const entries = loadEntries();

  const data = entries.map((item, index) => ({
    qr_id: `qr_${String(index + 1).padStart(3, "0")}`,
    entry_id: item.entry_id,
    site_id: item.site_id,
    site_name: item.site_name,
    entry_type: item.entry_type,
    entry_code: item.entry_code,
    qr_scene: item.entry_type === "device_qr" ? "设备固定码" : "站点固定码",
    short_link: `https://city.one/e/${item.entry_code}`,
    current_route_rule_id: item.entry_type === "device_qr" ? "route_002" : "route_001",
    current_feature_name: item.current_feature_name,
    status: item.status,
    print_batch_no: `batch_${item.entry_code}`,
    last_scan_at: "2026-04-01 10:05:00",
    total_scan_count: 100 + index * 25,
  }));

  return sendOk(res, sendJson, "qr assets loaded", data);
}
