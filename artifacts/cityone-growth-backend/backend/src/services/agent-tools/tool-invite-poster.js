/**
 * tool-invite-poster.js
 * 生成个人邀请链接和分享文案
 * P0：返回文案 + 链接，后续可扩展为图片海报
 */

export async function execute(slots = {}, identity = {}) {
  const lineUserId = identity.line_user_id || "";
  const userId = identity.user_id || "";

  if (!lineUserId && !userId) {
    return {
      success: false,
      tool_code: "tool-invite-poster",
      error_message: "请先关注公众号后才能生成专属邀请链接。"
    };
  }

  // 生成邀请码（基于 line_user_id 尾部 8 位）
  const rawId = lineUserId || userId || "";
  const inviteCode = rawId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "CITYONE";
  const inviteLink = `https://city.one/invite/${inviteCode}`;

  const shareTitle = {
    zh: "用 CityOne 借充电宝，首借免费！",
    th: "ยืมแบตเตอรี่สำรองด้วย CityOne ยืมครั้งแรกฟรี!",
    en: "Borrow a powerbank with CityOne - First borrow FREE!"
  };

  const shareText = {
    zh: `🎁 我在 CityOne 借了充电宝超方便！用我的专属链接注册，你的首借完全免费！\n邀请链接：${inviteLink}`,
    th: `🎁 ฉันใช้ CityOne ยืมแบตเตอรี่ สะดวกมาก! ลงทะเบียนผ่านลิงก์ของฉัน ยืมครั้งแรกฟรี!\nลิงก์เชิญ: ${inviteLink}`,
    en: `🎁 I've been using CityOne for powerbank rental - so convenient! Register with my link and your first borrow is FREE!\nInvite link: ${inviteLink}`
  };

  const lang = slots.language || "zh";

  return {
    success: true,
    tool_code: "tool-invite-poster",
    tool_result: {
      invite_code: inviteCode,
      invite_link: inviteLink,
      share_title: shareTitle[lang] || shareTitle.zh,
      share_text: shareText[lang] || shareText.zh
    },
    display_payload: {
      type: "invite_card",
      title: shareTitle[lang] || shareTitle.zh
    }
  };
}
