/**
 * tool-coupon-list.js
 * 查当前用户可用卡券（对接 user-products.json）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");
const USER_PRODUCTS_FILE = path.join(DATA_DIR, "user-products.json");
const DIGITAL_PRODUCTS_FILE = path.join(DATA_DIR, "digital-products.json");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function execute(slots = {}, identity = {}) {
  const lineUserId = identity.line_user_id || "";
  const userId = identity.user_id || "";

  if (!lineUserId && !userId) {
    return {
      success: false,
      tool_code: "tool-coupon-list",
      error_message: "无法识别用户身份，请先关注公众号。"
    };
  }

  const userProducts = loadJson(USER_PRODUCTS_FILE);
  const products = loadJson(DIGITAL_PRODUCTS_FILE);

  const now = new Date();
  const usable = userProducts.filter((up) => {
    if (lineUserId && up.line_user_id !== lineUserId) return false;
    if (!lineUserId && userId && up.user_id !== userId) return false;
    if (!["claimed", "unused"].includes(up.product_status)) return false;
    if (up.expired_at && new Date(up.expired_at) < now) return false;
    return true;
  });

  const enriched = usable.map((up) => {
    const product = products.find((p) => p.product_id === up.product_id) || {};
    return {
      ...up,
      product_name: product.product_name || up.product_id,
      short_benefit_text: product.short_benefit_text || "",
      product_type: product.product_type || ""
    };
  });

  return {
    success: true,
    tool_code: "tool-coupon-list",
    tool_result: {
      coupons: enriched,
      count: enriched.length
    },
    display_payload: {
      type: "coupon_list",
      title: "我的可用券"
    }
  };
}
