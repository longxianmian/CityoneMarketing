import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  isDatabaseConnectionError,
  readFallbackList,
  resolveReadFallbackDir,
} from "../src/services/read-fallback-data.js";

test("resolveReadFallbackDir prefers CITYONE_READ_FALLBACK_DIR over default", () => {
  const resolved = resolveReadFallbackDir({ CITYONE_READ_FALLBACK_DIR: "/tmp/cityone-fallback" });
  assert.equal(resolved, "/tmp/cityone-fallback");
});

test("readFallbackList loads array payloads from configured directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-fallback-"));
  fs.writeFileSync(path.join(tempDir, "banners.json"), JSON.stringify([{ id: "bn_001" }]), "utf8");

  const result = readFallbackList("banners.json", { baseDir: tempDir });
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].id, "bn_001");
  assert.match(result.filePath, /banners\.json$/);
});

test("readFallbackList throws a typed error when fallback file is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cityone-fallback-missing-"));
  assert.throws(
    () => readFallbackList("missing.json", { baseDir: tempDir }),
    (error) => error?.code === "FALLBACK_FILE_NOT_FOUND"
  );
});

test("isDatabaseConnectionError only matches connection-style failures", () => {
  assert.equal(isDatabaseConnectionError(new Error("connect ECONNREFUSED 127.0.0.1:5432")), true);
  assert.equal(isDatabaseConnectionError(new Error("syntax error at or near SELECT")), false);
});

