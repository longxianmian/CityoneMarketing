/**
 * tool-platform-search.js
 *
 * 【平台知识层 - Platform Knowledge Layer】
 *
 * 设计原则（参考阿里店小蜜 / OpenAI GPT Actions 架构）：
 *   - 平台公开内容（优惠券、活动、商城、政策）用一个统一工具扫描
 *   - 运行时读取 data/ 目录，运营新增内容无需改代码
 *   - 接受 query 参数做关键词相关性筛选
 *   - 与用户身份无关，无状态，可缓存
 *
 * 覆盖原 tool-available-coupons + tool-claim-benefits（两个工具合并为一）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

function loadJson(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return [];
  try {
    const p = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function pickText(v, lang = "zh") {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.zh || v.en || "";
}

function isActive(item) {
  const now = new Date();
  if (item.status === 0 || item.status === "disabled" || item.status === "draft") return false;
  if (item.status === "active" || item.status === 1 || item.status === "enabled") {
    if (item.end_time   && new Date(item.end_time)   < now) return false;
    if (item.valid_to   && new Date(item.valid_to)   < now) return false;
    if (item.valid_from && new Date(item.valid_from) > now) return false;
    return true;
  }
  // on_shelf check for mall items
  if (item.on_shelf === true) return true;
  return false;
}

export async function execute(slots = {}, identity = {}) {
  const lang  = identity.language || "zh";
  const query = (slots.query || "").toLowerCase();

  /* ── 数据源注册表（新增数据文件只需在此添加一行）────────────────────── */
  const SOURCES = [
    {
      file:    "coupons.json",
      type:    "coupon",
      mapItem: (c) => ({
        item_type:  "coupon",
        id:         c.id,
        name:       pickText(c.name, lang),
        desc:       c.discount_type === "free_time"
          ? `FREE ${c.discount_value} min`
          : c.discount_type === "percent"
          ? `${100 - c.discount_value}% OFF`
          : `฿${c.discount_value} OFF`,
        cover:      c.cover_image || "",
        stock:      c.total_count > 0 ? c.total_count - (c.claimed_count || 0) : null,
        valid_to:   c.valid_to || "",
        route:      `/coupon/${c.id}`,
        _search:    pickText(c.name, "zh") + " " + pickText(c.name, "th") + " coupon 优惠券",
      }),
    },
    {
      file:    "activities.json",
      type:    "activity",
      mapItem: (a) => ({
        item_type:  "activity",
        id:         a.activity_id,
        name:       pickText(a.activity_name || a.activity_title, lang),
        desc:       pickText(a.activity_subtitle || a.highlights, lang),
        cover:      a.cover_image || "",
        goal:       a.goal || "",
        end_time:   a.end_time || "",
        route:      `/activity/${a.activity_id}`,
        _search:    pickText(a.activity_name || a.activity_title, "zh") + " 活动 กิจกรรม",
      }),
    },
    {
      file:    "mall-items.json",
      type:    "mall_item",
      mapItem: (m) => ({
        item_type:      "mall_item",
        id:             m.id,
        name:           pickText(m.name, lang),
        desc:           pickText(m.description, lang),
        cover:          m.cover_image || "",
        points_required: m.points_required || 0,
        stock:          m.stock,
        route:          `/mall/${m.id}`,
        _search:        pickText(m.name, "zh") + " 积分商城 兑换 แลกของรางวัล",
      }),
    },
  ];

  const results = [];

  for (const src of SOURCES) {
    const raw = loadJson(src.file).filter(isActive);
    const mapped = raw.map(src.mapItem);
    // 关键词筛选（query为空时返回全部）
    const filtered = query
      ? mapped.filter((item) => item._search.toLowerCase().includes(query))
      : mapped;
    filtered.forEach((item) => {
      const { _search, ...rest } = item;  // 移除内部搜索字段
      results.push(rest);
    });
  }

  return {
    success: true,
    tool_code: "tool-platform-search",
    tool_result: {
      items:          results.slice(0, 8),
      total:          results.length,
      coupon_count:   results.filter((i) => i.item_type === "coupon").length,
      activity_count: results.filter((i) => i.item_type === "activity").length,
      mall_count:     results.filter((i) => i.item_type === "mall_item").length,
    },
    display_payload: {
      type:  "platform_content_list",
      title: { zh: "平台优惠与活动", th: "โปรโมชันและกิจกรรม", en: "Promotions & Activities" }[lang] || "平台优惠与活动",
    },
  };
}
