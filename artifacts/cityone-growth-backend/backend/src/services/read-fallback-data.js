import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_FALLBACK_DIR = path.join(BACKEND_ROOT, "data");

function createFallbackError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function normalizeFallbackList(parsed, filePath) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.list)) return parsed.list;
  if (Array.isArray(parsed?.data)) return parsed.data;
  throw createFallbackError(
    "FALLBACK_DATA_INVALID",
    `Fallback file ${filePath} must contain an array, { list }, or { data }`
  );
}

export function resolveReadFallbackDir(env = process.env) {
  const configured = String(env.CITYONE_READ_FALLBACK_DIR || "").trim();
  return configured || DEFAULT_FALLBACK_DIR;
}

export function isDatabaseConnectionError(error) {
  const message = String(error?.message || "");
  return /pg_hba\.conf|terminating connection|ECONNREFUSED|ETIMEDOUT|Connection terminated|database .* unavailable|connect .* failed/i.test(
    message
  );
}

export function readFallbackList(fileName, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const filePath = path.join(options.baseDir || resolveReadFallbackDir(options.env), fileName);

  if (!fsImpl.existsSync(filePath)) {
    throw createFallbackError("FALLBACK_FILE_NOT_FOUND", `Fallback file not found: ${filePath}`, { filePath });
  }

  let parsed;
  try {
    parsed = JSON.parse(fsImpl.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw createFallbackError(
      "FALLBACK_FILE_UNREADABLE",
      `Failed to read fallback file ${filePath}: ${error?.message || error}`,
      { filePath, cause: error }
    );
  }

  return {
    filePath,
    list: normalizeFallbackList(parsed, filePath),
  };
}

export function warnReadFallback(routeName, error, count, options = {}) {
  const logger = options.logger || console;
  const filePath = options.filePath || "";
  logger.warn(
    `[ContentFallback] ${routeName} served ${count} fallback rows from ${filePath} because DB is unavailable: ${error?.message || error}`
  );
}

