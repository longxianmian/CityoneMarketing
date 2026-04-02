/**
 * tool-claim-benefits.js
 * 查询用户还可以领取的福利
 * 对接 digital-products + activities + user-products
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");
const DIGITAL_PRODUCTS_FILE = path.join(DATA_DIR, "digital-products.json");
const USER_PRODUCTS_FILE = path.join(DATA_DIR, "user-products.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");

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

  const products = loadJson(DIGITAL_PRODUCTS_FILE);
  const userProducts = loadJson(USER_PRODUCTS_FILE);
  const activities = loadJson(ACTIVITIES_FILE);

  // 找出 activity_reward 类型的商品
  const rewardProducts = products.filter(
    (p) => p.status === "enabled" && p.source_mode === "activity_reward"
  );

  // 找出用户已经领过的
  const ownedProductIds = new Set(
    userProducts
      .filter((up) => {
        if (lineUserId && up.line_user_id !== lineUserId) return false;
        if (!lineUserId && userId && up.user_id !== userId) return false;
        return !["cancelled", "refunded"].includes(up.product_status);
      })
      .map((up) => up.product_id)
  );

  // 可领取 = 未领过且未超库存
  const claimable = rewardProducts.filter((p) => {
    if (ownedProductIds.has(p.product_id)) return false;
    if (p.stock_enabled && p.stock_qty <= 0) return false;
    return true;
  });

  // 关联活动名称
  const activityMap = {};
  for (const act of activities) {
    activityMap[act.activity_id] = act.activity_name;
  }

  return {
    success: true,
    tool_code: "tool-claim-benefits",
    tool_result: {
      claimable_benefits: claimable.slice(0, 6).map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        short_benefit_text: p.short_benefit_text,
        product_type: p.product_type,
        stock_qty: p.stock_enabled ? p.stock_qty : -1
      })),
      count: claimable.length
    },
    display_payload: { type: "benefit_list", title: "可领取福利" }
  };
}
