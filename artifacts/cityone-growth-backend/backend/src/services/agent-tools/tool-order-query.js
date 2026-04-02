/**
 * tool-order-query.js
 * 查询最近借电订单
 * P0：mock 数据，后续接 A 系统真实订单接口
 */

const MOCK_ORDERS = [
  {
    order_id: "ord_20260401_001",
    order_name: "借电 - Central World",
    site_name: "Central World 1F",
    status: "returned",
    amount: 0,
    currency: "THB",
    borrow_time: "2026-04-01T14:30:00+07:00",
    return_time: "2026-04-01T16:15:00+07:00",
    duration_minutes: 105
  },
  {
    order_id: "ord_20260328_002",
    order_name: "借电 - Siam Paragon",
    site_name: "Siam Paragon B1",
    status: "returned",
    amount: 15,
    currency: "THB",
    borrow_time: "2026-03-28T09:00:00+07:00",
    return_time: "2026-03-28T13:00:00+07:00",
    duration_minutes: 240
  },
  {
    order_id: "ord_20260320_003",
    order_name: "借电 - MBK Center",
    site_name: "MBK Center 2F",
    status: "returned",
    amount: 0,
    currency: "THB",
    borrow_time: "2026-03-20T11:00:00+07:00",
    return_time: "2026-03-20T11:50:00+07:00",
    duration_minutes: 50
  }
];

export async function execute(slots = {}, identity = {}) {
  const lineUserId = identity.line_user_id || "";
  const userId = identity.user_id || "";

  if (!lineUserId && !userId) {
    return {
      success: false,
      tool_code: "tool-order-query",
      error_message: "无法识别用户身份，请先关注公众号。"
    };
  }

  // P0 先返回 mock 数据，后续替换为 A 系统真实接口
  return {
    success: true,
    tool_code: "tool-order-query",
    tool_result: {
      orders: MOCK_ORDERS,
      count: MOCK_ORDERS.length,
      data_source: "mock"
    },
    display_payload: {
      type: "order_list",
      title: "最近借电记录"
    }
  };
}
