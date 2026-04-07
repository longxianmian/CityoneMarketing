/**
 * tool-claim-benefits.js
 * 查询用户还可以领取的福利，同时返回进行中的活动（带封面图）
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

function pickText(val, language = "zh") {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val[language] || val.zh || val.en || "";
}

export async function execute(slots = {}, identity = {}) {
  const lineUserId = identity.line_user_id || "";
  const userId = identity.user_id || "";
  const language = identity.language || "zh";

  const products = loadJson(DIGITAL_PRODUCTS_FILE);
  const userProducts = loadJson(USER_PRODUCTS_FILE);
  const activities = loadJson(ACTIVITIES_FILE);

  // ── 1. 可领取的福利产品 ─────────────────────────────────────────────────────
  const rewardProducts = products.filter(
    (p) => p.status === "enabled" && p.source_mode === "activity_reward"
  );

  const ownedProductIds = new Set(
    userProducts
      .filter((up) => {
        if (lineUserId && up.line_user_id !== lineUserId) return false;
        if (!lineUserId && userId && up.user_id !== userId) return false;
        return !["cancelled", "refunded"].includes(up.product_status);
      })
      .map((up) => up.product_id)
  );

  const claimable = rewardProducts.filter((p) => {
    if (ownedProductIds.has(p.product_id)) return false;
    if (p.stock_enabled && p.stock_qty <= 0) return false;
    return true;
  });

  const benefitItems = claimable.slice(0, 4).map((p) => ({
    item_type: "benefit",
    id: p.product_id,
    title: p.product_name,
    subtitle: p.short_benefit_text || "",
    cover_image: p.cover_image || "",
    product_type: p.product_type,
    stock_qty: p.stock_enabled ? p.stock_qty : -1,
    route: `/welfare`
  }));

  // ── 2. 进行中的活动（带封面图优先） ─────────────────────────────────────────
  const now = Date.now();
  const activeActivities = activities.filter((a) => {
    if (a.status !== "active") return false;
    if (a.end_time) {
      const end = new Date(a.end_time).getTime();
      if (!isNaN(end) && end < now) return false;
    }
    return true;
  });

  // 封面图优先排序（有图的排前面）
  activeActivities.sort((a, b) => (b.cover_image ? 1 : 0) - (a.cover_image ? 1 : 0));

  const activityItems = activeActivities.slice(0, 4).map((a) => ({
    item_type: "activity",
    id: a.activity_id,
    title: pickText(a.activity_name, language),
    subtitle: pickText(a.activity_subtitle, language) || pickText(a.highlights, language) || "",
    cover_image: a.cover_image || "",
    activity_type: a.activity_type,
    route: `/activity/${a.activity_id}`
  }));

  // ── 3. 合并：活动卡优先（有封面），然后是可领福利 ───────────────────────────
  const combined = [...activityItems, ...benefitItems].slice(0, 6);

  return {
    success: true,
    tool_code: "tool-claim-benefits",
    tool_result: {
      claimable_benefits: benefitItems,
      active_activities: activityItems,
      combined_items: combined,
      benefit_count: claimable.length,
      activity_count: activeActivities.length
    },
    display_payload: { type: "benefit_activity_list", title: "福利 & 活动" }
  };
}
