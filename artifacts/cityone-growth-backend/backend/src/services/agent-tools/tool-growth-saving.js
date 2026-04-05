/**
 * tool-growth-saving.js
 *
 * 增长省钱引导工具：当用户表达"想更划算/想优惠/想免费"意图时，
 * 返回适合分享给好友的活动、卡券、商品内容卡片。
 * 目标：引导用户通过分享赚积分 → 兑换优惠券/免费体验券。
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

const POINTS_BADGE = { zh: "分享得积分", th: "แชร์ได้คะแนน", en: "Earn Points" };
const SHARE_BTN   = { zh: "立即分享 →",  th: "แชร์เลย →",      en: "Share Now →" };
const WELFARE_BTN = { zh: "前往福利中心", th: "ไปศูนย์สิทธิ์",   en: "Browse Benefits" };

export async function execute(slots = {}, identity = {}) {
  const lang = identity.language || "zh";
  const activities   = loadJson(path.join(DATA_DIR, "activities.json"));
  const products     = loadJson(path.join(DATA_DIR, "digital-products.json"));

  // ── 可分享活动（最多 3 个）────────────────────────────────────────────
  const shareableActivities = activities
    .filter((a) => a.share_enabled && a.share_status === "enabled")
    .slice(0, 3)
    .map((a) => ({
      card_type: "invite",
      title: a.share_title || a.activity_title || a.activity_name,
      desc: a.share_desc || "把这个好活动分享给好友，双方都能得到奖励",
      badge: POINTS_BADGE[lang] || POINTS_BADGE.zh,
      meta: "📢 " + (a.activity_name || "限时活动"),
      action_text: SHARE_BTN[lang] || SHARE_BTN.zh,
      action_type: "navigate",
      action_url: "/welfare",
    }));

  // ── 可分享卡券商品（最多 2 个，补足到 3 张）────────────────────────────
  const couponProducts = products
    .filter((p) => p.status === "enabled" && p.product_type === "coupon")
    .slice(0, Math.max(0, 3 - shareableActivities.length))
    .map((p) => ({
      card_type: "coupon",
      title: p.product_name || "优惠券",
      desc: p.short_benefit_text || "分享给好友，好友领取后你获得积分",
      badge: POINTS_BADGE[lang] || POINTS_BADGE.zh,
      meta: "🎟️ 优惠券",
      action_text: SHARE_BTN[lang] || SHARE_BTN.zh,
      action_type: "navigate",
      action_url: "/my-coupons",
    }));

  const shareCards = [...shareableActivities, ...couponProducts];

  // 兜底：若数据为空，给一张通用引导卡
  if (shareCards.length === 0) {
    shareCards.push({
      card_type: "invite",
      title: { zh: "🎁 分享好友活动", th: "🎁 แชร์กิจกรรมให้เพื่อน", en: "🎁 Share with Friends" }[lang],
      desc: { zh: "浏览福利中心，挑一个好友会喜欢的内容分享，你赚积分他们也受益", th: "เลือกเนื้อหาในศูนย์สิทธิ์ แชร์ให้เพื่อน คุณได้คะแนนเพื่อนก็ได้ประโยชน์", en: "Browse the welfare center, share something your friends will love — you earn points, they benefit too" }[lang],
      badge: POINTS_BADGE[lang] || POINTS_BADGE.zh,
      action_text: WELFARE_BTN[lang] || WELFARE_BTN.zh,
      action_type: "navigate",
      action_url: "/welfare",
    });
  }

  return {
    success: true,
    tool_code: "tool-growth-saving",
    tool_result: {
      share_cards: shareCards,
      count: shareCards.length,
    },
    display_payload: { type: "growth_saving_cards" },
  };
}
