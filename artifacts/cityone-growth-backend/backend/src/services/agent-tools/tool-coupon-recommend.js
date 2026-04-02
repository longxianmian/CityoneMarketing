/**
 * tool-coupon-recommend.js
 * 结合站点/身份/活动，推荐最优券
 */

import { execute as listCoupons } from "./tool-coupon-list.js";

export async function execute(slots = {}, identity = {}) {
  const listResult = await listCoupons(slots, identity);

  if (!listResult.success || !listResult.tool_result?.coupons?.length) {
    return {
      success: true,
      tool_code: "tool-coupon-recommend",
      tool_result: { recommend: null, reason: "暂无可用券" },
      display_payload: { type: "coupon_recommend", title: "推荐最优券" }
    };
  }

  const coupons = listResult.tool_result.coupons;

  // 推荐策略：优先推荐有效期最短（即将到期优先使用）的券
  const sorted = [...coupons].sort((a, b) => {
    if (!a.expired_at) return 1;
    if (!b.expired_at) return -1;
    return new Date(a.expired_at) - new Date(b.expired_at);
  });

  const best = sorted[0];

  let reason = "当前最优券";
  if (best.expired_at) {
    const days = Math.ceil((new Date(best.expired_at) - new Date()) / (1000 * 60 * 60 * 24));
    reason = days <= 3 ? `即将在 ${days} 天后到期，建议优先使用` : "当前可用，优先推荐";
  }

  return {
    success: true,
    tool_code: "tool-coupon-recommend",
    tool_result: { recommend: best, reason },
    display_payload: { type: "coupon_card", title: "推荐使用：" + (best.product_name || best.user_product_id) }
  };
}
