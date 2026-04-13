/**
 * tool-available-coupons.js
 * 查询福利中心当前正在进行的优惠活动（与福利中心推荐 tab 完全同源）
 *
 * 数据来源（运行时读取，新增内容自动生效）：
 *   - coupons.json     → 平台优惠券活动
 *   - activities.json  → 营销活动
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

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
  const language = identity.language || "zh";
  const now = new Date();
  const nowMs = now.getTime();

  /* ── 1. 平台优惠券（coupons.json） ───────────────────────────── */
  const allCoupons = loadJson(path.join(DATA_DIR, "coupons.json"));
  const activeCoupons = allCoupons.filter((c) => {
    if (c.status !== 1) return false;
    if (c.valid_from && new Date(c.valid_from) > now) return false;
    if (c.valid_to   && new Date(c.valid_to)   < now) return false;
    return true;
  });

  const couponItems = activeCoupons.slice(0, 4).map((c) => {
    const remaining = c.total_count > 0 ? c.total_count - (c.claimed_count || 0) : null;
    const discountLabel =
      c.discount_type === "free_time"  ? `FREE ${c.discount_value} min` :
      c.discount_type === "free_order" ? "FREE"                         :
      c.discount_type === "percent"    ? `${100 - c.discount_value}% OFF` :
      `฿${c.discount_value} OFF`;
    return {
      item_type:     "coupon",
      id:            c.id,
      name:          pickText(c.name, language),
      discount_label: discountLabel,
      remaining,
      cover_image:   c.cover_image || "",
      valid_to:      c.valid_to || "",
      route:         `/coupon/${c.id}`,
    };
  });

  /* ── 2. 营销活动（activities.json，status=active 且未过期） ────── */
  const allActivities = loadJson(path.join(DATA_DIR, "activities.json"));
  const activeActivities = allActivities.filter((a) => {
    if (a.status !== "active") return false;
    if (a.end_time && new Date(a.end_time).getTime() < nowMs) return false;
    return true;
  });

  const activityItems = activeActivities.slice(0, 4).map((a) => ({
    item_type:   "activity",
    id:          a.activity_id,
    name:        pickText(a.activity_name || a.activity_title, language),
    subtitle:    pickText(a.activity_subtitle || a.highlights, language),
    cover_image: a.cover_image || "",
    route:       `/activity/${a.activity_id}`,
  }));

  /* ── 3. 合并结果（活动优先） ──────────────────────────────────── */
  const combined = [...activityItems, ...couponItems];

  return {
    success: true,
    tool_code: "tool-available-coupons",
    tool_result: {
      coupons:          couponItems,
      activities:       activityItems,
      combined:         combined,
      coupon_count:     activeCoupons.length,
      activity_count:   activeActivities.length,
      total_count:      activeCoupons.length + activeActivities.length,
    },
    display_payload: {
      type:  "available_coupon_list",
      title: { zh: "当前优惠活动", th: "โปรโมชันปัจจุบัน", en: "Current Promotions" }[language] || "当前优惠活动",
    },
  };
}
