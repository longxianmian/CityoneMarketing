/**
 * a-system.js
 *
 * A 系统旁路连接接口 — 增长系统侧代码落点（预留阶段）
 *
 * 当前状态：
 *  - 接口路由已固定，路径不再变更
 *  - 所有 handler 返回 501 NOT_IMPLEMENTED
 *  - 真实签名校验 / 幂等处理 / 奖励触发 待后续与 A 系统联调后启用
 *
 * 接口列表：
 *  POST /api/a-system/webhook/device-borrow-event
 *  POST /api/a-system/webhook/station-sync
 *
 * 鉴权方案（预定义，暂未启用）：
 *  - A 系统 → 增长系统：X-A-System-Sign: t=<timestamp>,v1=<HMAC-SHA256-hex>
 *  - 共享密钥环境变量：A_SYSTEM_WEBHOOK_SECRET
 */

/**
 * POST /api/a-system/webhook/device-borrow-event
 *
 * 用途：用户在 A 系统借机后，A 系统主动推送借机事件到增长系统
 * 增长系统据此触发：发积分 / 参与活动 / 解锁权益
 *
 * 预留字段（待 A 系统联调启用）：
 *  event_id           幂等键，A 系统全局唯一
 *  a_system_station_id A 系统站点 ID
 *  a_system_device_id  A 系统设备 ID
 *  device_code         设备编码（可选，用于反查增长系统站点）
 *  a_system_user_id   A 系统用户 ID
 *  line_user_id       LINE userId（用于增长系统识别用户）
 *  order_id           A 系统订单号
 */
export async function handleDeviceBorrowEventWebhook(req, res, url, sendJson, readBody) {
  const body = await readBody(req);

  // 占位日志（联调时可替换为真实处理）
  console.log("[A-system Webhook] device-borrow-event received (NOT IMPLEMENTED)", {
    event_id: body.event_id || "(none)",
    a_system_station_id: body.a_system_station_id || "(none)",
    line_user_id: body.line_user_id || "(none)",
  });

  return sendJson(res, 501, {
    code: 501,
    error: "NOT_IMPLEMENTED",
    msg: "A系统借机事件 Webhook 尚未启用，待与 A 系统联调后激活",
    data: {
      received_event_id: body.event_id || null,
      status: "not_processed",
    },
  });
}

/**
 * POST /api/a-system/webhook/station-sync
 *
 * 用途：A 系统站点信息更新时（新增/设备更换/下线），同步到增长系统
 *
 * 预留字段（待 A 系统联调启用）：
 *  sync_type           upsert | disable
 *  a_system_station_id A 系统站点 ID
 *  a_system_device_id  A 系统设备 ID
 *  device_code         设备编码
 *  station_name        { zh, th, en }
 *  city_code / district / address / latitude / longitude
 *  capacity / status
 */
export async function handleStationSyncWebhook(req, res, url, sendJson, readBody) {
  const body = await readBody(req);

  console.log("[A-system Webhook] station-sync received (NOT IMPLEMENTED)", {
    sync_type: body.sync_type || "(none)",
    a_system_station_id: body.a_system_station_id || "(none)",
  });

  return sendJson(res, 501, {
    code: 501,
    error: "NOT_IMPLEMENTED",
    msg: "A系统站点同步 Webhook 尚未启用，待与 A 系统联调后激活",
    data: {
      received_a_system_station_id: body.a_system_station_id || null,
      sync_type: body.sync_type || null,
      status: "not_processed",
    },
  });
}
