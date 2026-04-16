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
      zh: "你好！我是小城，随时为你服务。你可以问我附近站点、优惠券、积分、邀请好友等问题。",
      th: "สวัสดีครับ! ฉันคือ小城 ช่วยคุณหาสถานี คูปอง แต้ม หรือชวนเพื่อนได้เลย",
      en: "Hello! I'm 小城. Ask me about nearby stations, coupons, points, or inviting friends!"
    }[language] || "你好！我是小城，有什么可以帮你的吗？";
    return buildTextReply(greetText, suggestions, "greeting");
  }

  // 未识别意图
  if (!intentCode || intentCode === "unknown") {
    const fallbackText = {
      zh: "嗯～这个问题有点超出我的服务范围了 😄 不过关于充电宝借还、卡券和积分这些，我很在行，要不试试：",
      th: "อืม คำถามนี้อยู่นอกขอบเขตที่ฉันช่วยได้ 😄 แต่เรื่องพาวเวอร์แบงก์ คูปอง และแต้ม ฉันถนัดมากเลย ลองดูสิ:",
      en: "Hmm, that one's a bit out of my area 😄 But I'm great with power banks, coupons, and points — want to try:"
    }[language] || "嗯～这个我可能帮不上，不过你可以试试：";
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
      const combined = data.combined_items || [];
      const benefitCount = data.benefit_count || 0;
      const activityCount = data.activity_count || 0;
      const totalCount = combined.length;

      const text = totalCount > 0
        ? { zh: `为你找到 ${activityCount > 0 ? `${activityCount} 个活动` : ""}${activityCount > 0 && benefitCount > 0 ? " + " : ""}${benefitCount > 0 ? `${benefitCount} 个可领福利` : ""}：`, th: `พบ ${totalCount} รายการสำหรับคุณ:`, en: `Found ${totalCount} items for you:` }[language]
        : { zh: "当前没有可领取的福利或进行中的活动。", th: "ไม่มีสิทธิ์หรือกิจกรรมในขณะนี้", en: "No benefits or activities available now." }[language];

      const actionLabel = { zh: { activity: "去参与", benefit: "领取" }, th: { activity: "เข้าร่วม", benefit: "รับ" }, en: { activity: "Join", benefit: "Claim" } }[language] || { activity: "Join", benefit: "Claim" };

      const cards = combined.slice(0, 4).map((item) => ({
        card_type: item.item_type === "activity" ? "activity" : "benefit",
        title: item.title,
        desc: item.subtitle || "",
        cover_image: item.cover_image || "",
        route: item.route || "",
        action_text: item.item_type === "activity" ? actionLabel.activity : actionLabel.benefit,
        action_type: item.item_type === "activity" ? "open_activity" : "claim_product",
        action_data: item.item_type === "activity" ? { activity_id: item.id } : { product_id: item.id }
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

    case "growth_saving_intent": {
      const shareCards = data.share_cards || [];
      const text = {
        zh: "想更划算一点的话，你也可以试试通过分享优惠给好友来赚积分。朋友能先看到这些优惠内容，你这边则可以把积分攒起来，之后兑换优惠券、免费体验券等福利。下面我先帮你整理了几个比较适合分享的内容。",
        th: "ถ้าอยากคุ้มกว่านี้ ลองแชร์โปรโมชันให้เพื่อนเพื่อสะสมคะแนนดูนะ เพื่อนจะได้เห็นโปรโมชันก่อน ส่วนคุณได้คะแนนสะสมไว้แลกคูปองหรือบัตรทดลองใช้ฟรี ด้านล่างนี้ฉันรวบรวมเนื้อหาที่เหมาะสำหรับแชร์ไว้ให้แล้ว",
        en: "If you want a better deal, try sharing offers with friends to earn points. Your friends get to see the offers first, while you accumulate points to redeem for coupons or free trials. Here are some great content pieces to share.",
      }[language] || "想更划算一点的话，你也可以试试通过分享优惠给好友来赚积分。朋友能先看到这些优惠内容，你这边则可以把积分攒起来，之后兑换优惠券、免费体验券等福利。下面我先帮你整理了几个比较适合分享的内容。";
      const cards = shareCards.map((c) => ({
        card_type: c.card_type || "invite",
        title: c.title,
        desc: c.desc,
        badge: c.badge,
        meta: c.meta,
        action_text: c.action_text,
        action_type: c.action_type || "navigate",
        action_url: c.action_url || "/welfare",
      }));
      return { reply_type: "tool_result", text, cards, suggestions };
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
      zh: "除了参与活动外，你也可以把活动、卡券或商品详情页链接分享给好友。好友通过你的链接关注 LINE OA 后，你就能获得积分奖励；后续也可以继续把积分拿去兑换券和礼品。",
      th: "นอกจากเข้าร่วมกิจกรรมแล้ว คุณยังสามารถแชร์ลิงก์หน้ารายละเอียดกิจกรรม คูปอง หรือสินค้าให้เพื่อนได้ เมื่อเพื่อนกดจากลิงก์ของคุณแล้วติดตาม LINE OA คุณจะได้รับคะแนนสะสม",
      en: "Besides joining activities, you can also share activity, coupon, or product detail links with friends. Once they follow the LINE OA through your link, you earn points."
    },
    points_redeem_help: {
      zh: "积分既可以通过参与活动获得，也可以通过分享活动、卡券或商品详情页给好友来赚取。好友通过你的分享链接关注 LINE OA 后，你就会获得积分；积分可在福利中心兑换优惠券、礼品等。",
      th: "คะแนนสามารถได้จากการเข้าร่วมกิจกรรม และยังได้จากการแชร์ลิงก์หน้ารายละเอียดกิจกรรม คูปอง หรือสินค้าให้เพื่อน เมื่อเพื่อนติดตาม LINE OA ผ่านลิงก์ของคุณ คุณจะได้คะแนน และนำคะแนนไปแลกคูปองหรือของรางวัลได้",
      en: "You can earn points by joining activities, and also by sharing activity, coupon, or product detail links with friends. When they follow the LINE OA through your link, you receive points, which can be redeemed for coupons or gifts."
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
