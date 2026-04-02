/**
 * agent-reply-service.js
 *
 * 把工具结果 + 意图信息 → 结构化前端消息。
 * 统一格式：{ reply_type, text, cards, suggestions }
 */

import { loadAgentConfig } from "./agent-config-service.js";

export function buildReply({ intentCode, toolResult, identityTier, language = "zh", policyResult }) {
  const config = loadAgentConfig();
  const suggestions = getContextualSuggestions(intentCode, language, config);

  // 被阻断的情况
  if (policyResult && policyResult.result !== "allowed" && policyResult.result !== "need_confirm") {
    const blockMsg = policyResult.block_message || "该操作暂时无法执行。";
    return buildTextReply(blockMsg, suggestions, "policy_blocked");
  }

  // 需要确认
  if (policyResult?.result === "need_confirm") {
    return {
      reply_type: "confirm_required",
      text: buildConfirmText(intentCode, language),
      confirm_action: intentCode,
      cards: [],
      suggestions
    };
  }

  // 问候意图
  if (intentCode === "greeting") {
    const greetText = {
      zh: "你好！我是 CityOne AI 助理，随时为你服务。你可以问我附近站点、优惠券、积分、邀请好友等问题。",
      th: "สวัสดีครับ! ฉันคือ CityOne AI ช่วยคุณหาสถานี คูปอง แต้ม หรือชวนเพื่อนได้เลย",
      en: "Hello! I'm CityOne AI Assistant. Ask me about nearby stations, coupons, points, or inviting friends!"
    }[language] || "你好！我是 CityOne AI 助理，有什么可以帮你的吗？";
    return buildTextReply(greetText, suggestions, "greeting");
  }

  // 未识别意图
  if (!intentCode || intentCode === "unknown") {
    const fallbackText = {
      zh: "抱歉，我没有理解你的问题。你可以试试：",
      th: "ขออภัย ฉันไม่เข้าใจ ลองดูตัวเลือกเหล่านี้:",
      en: "Sorry, I didn't understand. Here are some things you can try:"
    }[language] || "抱歉，我没有理解你的问题。";
    return buildTextReply(fallbackText, suggestions, "intent_unknown");
  }

  // 按工具结果构建回复
  if (!toolResult) {
    return buildInfoReply(intentCode, language, suggestions);
  }

  if (!toolResult.success) {
    const errText = toolResult.error_message || "查询失败，请稍后再试。";
    return buildTextReply(errText, suggestions, "tool_error");
  }

  return buildToolResultReply(intentCode, toolResult, language, suggestions);
}

function buildToolResultReply(intentCode, toolResult, language, suggestions) {
  const data = toolResult.tool_result || {};
  const displayPayload = toolResult.display_payload || {};

  switch (intentCode) {
    case "nearby_sites_query": {
      const sites = data.sites || [];
      const text = sites.length
        ? { zh: `我找到了 ${sites.length} 个附近可用站点：`, th: `พบสถานี ${sites.length} แห่งใกล้เคียง:`, en: `Found ${sites.length} nearby stations:` }[language]
        : { zh: "附近暂时没有找到可用站点，请稍后重试。", th: "ไม่พบสถานีใกล้เคียง", en: "No nearby stations found." }[language];
      const cards = sites.slice(0, 5).map((s) => ({
        card_type: "site",
        title: s.site_name || s.site_id,
        desc: s.address || "",
        tag: s.available_devices > 0 ? `可用 ${s.available_devices} 台` : "暂无可用设备",
        action_text: { zh: "查看站点", th: "ดูสถานี", en: "View Station" }[language],
        action_type: "open_site",
        action_data: { site_id: s.site_id }
      }));
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "coupon_list_query": {
      const coupons = data.coupons || [];
      const text = coupons.length
        ? { zh: `你有 ${coupons.length} 张可用优惠券：`, th: `คุณมี ${coupons.length} คูปองที่ใช้ได้:`, en: `You have ${coupons.length} available coupons:` }[language]
        : { zh: "你目前没有可用的优惠券。", th: "คุณไม่มีคูปองที่ใช้ได้", en: "You have no available coupons." }[language];
      const cards = coupons.slice(0, 5).map((c) => ({
        card_type: "coupon",
        title: c.product_name || c.user_product_id,
        desc: c.short_benefit_text || "",
        tag: c.expired_at ? `有效至 ${c.expired_at.slice(0, 10)}` : "永久有效",
        action_text: { zh: "去使用", th: "ใช้งาน", en: "Use Now" }[language],
        action_type: "open_coupon",
        action_data: { user_product_id: c.user_product_id }
      }));
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "coupon_recommend": {
      const rec = data.recommend;
      if (!rec) return buildTextReply({ zh: "当前没有特别推荐的券。", th: "ไม่มีคูปองแนะนำ", en: "No coupon recommendations now." }[language], suggestions, "tool_result");
      const text = { zh: `我帮你找到了当前最划算的券：`, th: `ฉันพบคูปองที่คุ้มที่สุด:`, en: `Here's the best coupon for you:` }[language];
      const cards = [{
        card_type: "coupon",
        title: rec.product_name || rec.user_product_id,
        desc: data.reason || rec.short_benefit_text || "",
        tag: "推荐",
        action_text: { zh: "立即使用", th: "ใช้เลย", en: "Use Now" }[language],
        action_type: "open_coupon",
        action_data: { user_product_id: rec.user_product_id }
      }];
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "benefit_claim_query": {
      const benefits = data.claimable_benefits || [];
      const text = benefits.length
        ? { zh: `你还可以领取 ${benefits.length} 个福利：`, th: `คุณสามารถรับสิทธิ์ได้ ${benefits.length} รายการ:`, en: `You can claim ${benefits.length} benefits:` }[language]
        : { zh: "当前没有可领取的新福利。", th: "ไม่มีสิทธิ์ที่รับได้", en: "No new benefits available." }[language];
      const cards = benefits.slice(0, 4).map((b) => ({
        card_type: "benefit",
        title: b.product_name || b.product_id,
        desc: b.short_benefit_text || "",
        action_text: { zh: "领取", th: "รับ", en: "Claim" }[language],
        action_type: "claim_product",
        action_data: { product_id: b.product_id }
      }));
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "invite_poster_generate": {
      const text = { zh: "你的专属邀请信息已生成：", th: "ข้อมูลเชิญของคุณถูกสร้างแล้ว:", en: "Your invite info is ready:" }[language];
      const cards = [{
        card_type: "invite",
        title: data.share_title || { zh: "邀请好友享优惠", th: "เชิญเพื่อนรับส่วนลด", en: "Invite friends for discount" }[language],
        desc: data.share_text || "",
        invite_link: data.invite_link || "",
        action_text: { zh: "复制邀请链接", th: "คัดลอกลิงก์", en: "Copy Invite Link" }[language],
        action_type: "copy_link",
        action_data: { link: data.invite_link }
      }];
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "recent_orders_query": {
      const orders = data.orders || [];
      const text = orders.length
        ? { zh: `你最近有 ${orders.length} 条借电记录：`, th: `คุณมี ${orders.length} รายการยืมล่าสุด:`, en: `You have ${orders.length} recent orders:` }[language]
        : { zh: "暂时没有找到借电记录。", th: "ไม่พบประวัติการยืม", en: "No recent orders found." }[language];
      const cards = orders.slice(0, 5).map((o) => ({
        card_type: "order",
        title: o.order_name || o.order_id,
        desc: o.site_name || "",
        tag: o.status || "",
        action_text: { zh: "查看详情", th: "ดูรายละเอียด", en: "View Details" }[language],
        action_type: "open_order",
        action_data: { order_id: o.order_id }
      }));
      return { reply_type: "tool_result", text, cards, suggestions };
    }

    case "points_balance_query": {
      const text = data.points !== undefined
        ? { zh: `你当前的积分余额为 ${data.points} 分。`, th: `คะแนนของคุณคือ ${data.points} คะแนน`, en: `Your current points balance is ${data.points}.` }[language]
        : { zh: "暂时无法查询积分，请稍后再试。", th: "ไม่สามารถตรวจสอบคะแนนได้", en: "Cannot check points now." }[language];
      return buildTextReply(text, suggestions, "tool_result");
    }

    default:
      return buildTextReply(
        toolResult.reply_text || { zh: "操作完成。", en: "Done.", th: "เสร็จสิ้น" }[language],
        suggestions,
        "tool_result"
      );
  }
}

function buildInfoReply(intentCode, language, suggestions) {
  const INFO_TEXTS = {
    borrow_help: {
      zh: "借电步骤：1. 扫描设备二维码 2. 关注公众号（首次）3. 支付押金（首次）4. 点击借出即可。有问题随时问我！",
      th: "วิธียืม: 1. สแกน QR code ที่อุปกรณ์ 2. กด Follow OA (ครั้งแรก) 3. ชำระมัดจำ (ครั้งแรก) 4. กดยืม",
      en: "Borrow steps: 1. Scan QR on device 2. Follow OA (first time) 3. Pay deposit (first time) 4. Tap borrow."
    },
    return_help: {
      zh: "还电步骤：1. 前往任意可归还站点 2. 将充电宝插入空槽 3. 等待确认归还成功提示即可。",
      th: "วิธีคืน: 1. ไปที่สถานีใดก็ได้ 2. เสียบแบตเตอรี่สำรองเข้าช่องว่าง 3. รอการยืนยัน",
      en: "Return steps: 1. Go to any station 2. Insert powerbank into empty slot 3. Wait for confirmation."
    },
    invite_help: {
      zh: "邀请好友步骤：点击「生成邀请链接」获取你的专属链接，分享给朋友即可。好友完成首借后，你和好友都能获得奖励！",
      th: "วิธีเชิญเพื่อน: กด 'สร้างลิงก์เชิญ' รับลิงก์ส่วนตัว แชร์ให้เพื่อน เมื่อเพื่อนยืมครั้งแรก ทั้งคู่ได้รับรางวัล",
      en: "Invite steps: Tap 'Generate invite link', share it with friends. Both of you earn rewards when they complete first borrow!"
    },
    points_redeem_help: {
      zh: "积分兑换说明：进入福利中心 → 积分兑换，选择心仪商品，确认兑换即可。积分可兑换券、礼品等。",
      th: "วิธีแลกคะแนน: ไปที่ศูนย์สิทธิ์ → แลกคะแนน เลือกสินค้าที่ต้องการ ยืนยันการแลก",
      en: "Points redemption: Go to Welfare Center → Redeem Points, choose item, confirm. Redeem coupons, gifts, etc."
    }
  };

  const text = INFO_TEXTS[intentCode]?.[language] || INFO_TEXTS[intentCode]?.zh || "暂无相关说明，请联系客服。";
  return buildTextReply(text, suggestions, "info_reply");
}

function buildConfirmText(intentCode, language) {
  const CONFIRM_TEXTS = {
    after_sale_apply: {
      zh: "你确定要发起售后申请吗？提交后将由客服人员跟进处理。",
      th: "คุณต้องการส่งคำร้องบริการหลังการขายหรือไม่?",
      en: "Are you sure you want to submit an after-sale request? Our team will follow up."
    }
  };
  return CONFIRM_TEXTS[intentCode]?.[language] || CONFIRM_TEXTS[intentCode]?.zh || "请确认是否继续执行该操作？";
}

function buildTextReply(text, suggestions, replyType = "text") {
  return { reply_type: replyType, text, cards: [], suggestions };
}

function getContextualSuggestions(intentCode, language, config) {
  const prompts = config.quick_prompts?.[language] || config.quick_prompts?.zh || [];
  // 过滤掉当前意图，避免重复
  return prompts.slice(0, 3);
}
