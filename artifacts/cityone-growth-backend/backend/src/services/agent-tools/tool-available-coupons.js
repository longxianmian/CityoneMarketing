/**
 * tool-available-coupons.js
 * 查询平台当前正在进行的优惠活动 / 可领取优惠券
 * 数据来源：coupons.json（福利中心"推荐"标签展示的内容）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");
const COUPONS_FILE = path.join(DATA_DIR, "coupons.json");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function pickName(nameField, language = "zh") {
  if (!nameField) return "";
  if (typeof nameField === "string") return nameField;
  return nameField[language] || nameField.zh || nameField.en || "";
}

export async function execute(slots = {}, identity = {}) {
  const language = identity.language || "zh";
  const now = new Date();

  const allCoupons = loadJson(COUPONS_FILE);

  // status=1 表示启用；过滤掉已过期的活动
  const active = allCoupons.filter((c) => {
    if (c.status !== 1) return false;
    if (c.valid_to && new Date(c.valid_to) < now) return false;
    // 还没开始的也排除
    if (c.valid_from && new Date(c.valid_from) > now) return false;
    return true;
  });

  const items = active.slice(0, 6).map((c) => {
    const remaining = c.total_count > 0 ? c.total_count - (c.claimed_count || 0) : null;
    return {
      id:           c.id,
      name:         pickName(c.name, language),
      coupon_type:  c.coupon_type,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      remaining:    remaining,
      cover_image:  c.cover_image || "",
      valid_to:     c.valid_to || "",
    };
  });

  return {
    success: true,
    tool_code: "tool-available-coupons",
    tool_result: {
      coupons:       items,
      count:         items.length,
      total_active:  active.length,
    },
    display_payload: {
      type:  "available_coupon_list",
      title: { zh: "当前优惠活动", th: "โปรโมชันปัจจุบัน", en: "Current Promotions" }[language] || "当前优惠活动",
    },
  };
}
