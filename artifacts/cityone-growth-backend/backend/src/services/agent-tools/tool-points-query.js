/**
 * tool-points-query.js
 * 查积分余额
 * P0：mock 数据
 */

export async function execute(slots = {}, identity = {}) {
  const lineUserId = identity.line_user_id || "";

  if (!lineUserId) {
    return {
      success: false,
      tool_code: "tool-points-query",
      error_message: "无法识别用户身份。"
    };
  }

  // P0 mock
  return {
    success: true,
    tool_code: "tool-points-query",
    tool_result: {
      points: 320,
      level: "bronze",
      expire_soon: 50,
      expire_date: "2026-06-30",
      data_source: "mock"
    },
    display_payload: { type: "points_card", title: "我的积分" }
  };
}
