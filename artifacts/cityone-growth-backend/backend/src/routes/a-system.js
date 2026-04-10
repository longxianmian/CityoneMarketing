/**
 * a-system.js
 *
 * A 系统旁路连接接口 — 增长系统侧完整实现（开发环境联调就绪）
 *
 * 接口：
 *  POST /api/a-system/webhook/device-borrow-event  — 借机事件 → 触发参与/发积分
 *  POST /api/a-system/webhook/station-sync          — 站点数据同步（upsert/disable）
 *
 * 开发模式（A_SYSTEM_WEBHOOK_ENABLED != "true"）：
 *  - 无 X-A-System-Sign Header → 跳过签名校验，直接处理
 *  - 有签名 → 仍然校验，不通过则返回 401
 *
 * 生产模式（A_SYSTEM_WEBHOOK_ENABLED=true + A_SYSTEM_WEBHOOK_SECRET 已配置）：
 *  - 签名必须存在且有效，否则返回 401
 */

import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";
import {
  verifyASystemSignature,
  isASystemSignatureRequired,
  stableStringify,
} from "../middleware/a-system-signature.js";

// ─── 内部工具 ────────────────────────────────────────────────────────────────

/**
 * 直接从 req 读取原始 body 字符串（不做 JSON.parse）
 * 用于签名校验：必须在流被消费前调用
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * 签名校验通用入口
 * 开发模式：无 Header → 放行；有 Header → 校验
 * 生产模式：无 Header → 拒绝；有 Header → 校验
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkSignature(req, rawBody) {
  const signHeader = req.headers["x-a-system-sign"] || "";
  const required   = isASystemSignatureRequired();
  const secret     = process.env.A_SYSTEM_WEBHOOK_SECRET || "";

  // 生产模式：无签名直接拒绝
  if (required && !signHeader) {
    return { ok: false, reason: "生产模式下必须携带 X-A-System-Sign Header" };
  }

  // 开发模式：无签名跳过
  if (!required && !signHeader) {
    console.log("[A-system] 开发模式：跳过签名校验");
    return { ok: true };
  }

  // 有签名：必须有 secret
  if (!secret) {
    return { ok: false, reason: "A_SYSTEM_WEBHOOK_SECRET 未配置，无法校验签名" };
  }

  const result = verifyASystemSignature({ rawBody, signHeader, secret });
  if (!result.valid) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

/**
 * 写入 webhook 事件记录（先 INSERT，冲突则 UPDATE）
 */
async function upsertWebhookEvent({ eventId, eventType, payloadJson, status,
  stationCode, entryCode, activityId, userId, pointsAwarded, errorMessage }) {
  await query(
    `INSERT INTO a_system_webhook_events
       (event_id, event_type, payload_json, process_status,
        station_code, entry_code, activity_id, user_id, points_awarded, error_message,
        received_at, processed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
     ON CONFLICT (event_id) DO UPDATE SET
       process_status = EXCLUDED.process_status,
       station_code   = EXCLUDED.station_code,
       entry_code     = EXCLUDED.entry_code,
       activity_id    = EXCLUDED.activity_id,
       user_id        = EXCLUDED.user_id,
       points_awarded = EXCLUDED.points_awarded,
       error_message  = EXCLUDED.error_message,
       processed_at   = NOW()`,
    [
      eventId, eventType, JSON.stringify(payloadJson), status,
      stationCode || "", entryCode || "", activityId || "",
      userId || "", pointsAwarded || 0, errorMessage || "",
    ]
  );
}

// ─── 借机事件处理 ────────────────────────────────────────────────────────────

/**
 * POST /api/a-system/webhook/device-borrow-event
 *
 * 完整处理链路：
 *  1. 读取 rawBody → 签名校验
 *  2. event_id 幂等去重（a_system_webhook_events UNIQUE event_id）
 *  3. 通过 a_system_station_id / device_code / a_system_device_id 反查 stations
 *  4. 通过 station_code 反查 entry_instances（取第一条启用入口）
 *  5. 通过 entry.default_activity_code 或 landing.default_activity_code 找活动
 *  6. 复用 activity_participations + points_ledger 写入逻辑（含站点归因快照）
 *  7. 写入 a_system_webhook_events
 */
export async function handleDeviceBorrowEventWebhook(req, res, url, sendJson) {
  const rawBody = await readRawBody(req);

  // ── 签名校验 ──────────────────────────────────────────────────────
  const sigCheck = checkSignature(req, rawBody);
  if (!sigCheck.ok) {
    return sendJson(res, 401, { code: 401, error: "SIGNATURE_INVALID", msg: sigCheck.reason });
  }

  // ── 解析 body ─────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return sendJson(res, 400, { code: 400, error: "INVALID_JSON", msg: "请求体不是合法 JSON" });
  }

  const {
    event_id,
    a_system_station_id = "",
    a_system_device_id  = "",
    device_code         = "",
    a_system_user_id    = "",
    line_user_id        = "",
    order_id            = "",
    borrow_at,
  } = body;

  if (!event_id) {
    return sendJson(res, 400, { code: 400, error: "MISSING_EVENT_ID", msg: "event_id 为必填幂等键" });
  }

  const userId = line_user_id || a_system_user_id;
  if (!userId) {
    return sendJson(res, 400, { code: 400, error: "MISSING_USER_ID", msg: "line_user_id 或 a_system_user_id 至少填一个" });
  }

  console.log(`[A-system] device-borrow-event event_id=${event_id} user=${userId}`);

  // ── 幂等检查：event_id 已处理 ──────────────────────────────────────
  const { rows: existRows } = await query(
    "SELECT event_id, process_status FROM a_system_webhook_events WHERE event_id=$1",
    [event_id]
  );
  if (existRows.length > 0 && existRows[0].process_status === "success") {
    return sendJson(res, 200, {
      code: 200,
      msg: "already_processed",
      data: {
        event_id,
        already_processed: true,
        process_status: "success",
      },
    });
  }

  // ── 插入事件记录（pending 状态）────────────────────────────────────
  await upsertWebhookEvent({
    eventId: event_id, eventType: "device_borrow",
    payloadJson: body, status: "processing",
    userId,
  });

  // ── 反查站点 ──────────────────────────────────────────────────────
  let station = null;
  if (a_system_station_id) {
    const { rows } = await query(
      "SELECT * FROM stations WHERE a_system_station_id=$1 AND a_system_station_id <> '' LIMIT 1",
      [a_system_station_id]
    );
    station = rows[0] || null;
  }
  if (!station && device_code) {
    const { rows } = await query(
      "SELECT * FROM stations WHERE device_code=$1 AND device_code <> '' LIMIT 1",
      [device_code]
    );
    station = rows[0] || null;
  }
  if (!station && a_system_device_id) {
    const { rows } = await query(
      "SELECT * FROM stations WHERE a_system_device_id=$1 AND a_system_device_id <> '' LIMIT 1",
      [a_system_device_id]
    );
    station = rows[0] || null;
  }

  if (!station) {
    const errMsg = `无法通过 a_system_station_id="${a_system_station_id}" device_code="${device_code}" a_system_device_id="${a_system_device_id}" 找到站点`;
    console.warn(`[A-system] ${errMsg}`);
    await upsertWebhookEvent({
      eventId: event_id, eventType: "device_borrow",
      payloadJson: body, status: "failed",
      userId, errorMessage: errMsg,
    });
    return sendJson(res, 422, { code: 422, error: "STATION_NOT_FOUND", msg: errMsg });
  }

  const stationCode = station.station_code;

  // ── 反查入口（取该站点第一条启用入口）───────────────────────────────
  const { rows: entryRows } = await query(
    `SELECT entry_code, landing_code, default_activity_code, device_code, a_system_device_id
     FROM entry_instances
     WHERE station_code=$1 AND status='enabled'
     ORDER BY sort_order ASC, id ASC LIMIT 1`,
    [stationCode]
  );
  const entry = entryRows[0] || null;
  const srcEntryCode = entry?.entry_code || "";

  // ── 反查活动 ──────────────────────────────────────────────────────
  // 优先从入口找，其次从站点默认活动找，最后查landing
  let activityId = "";
  let activityRow = null;

  if (entry?.default_activity_code) {
    const { rows } = await query(
      "SELECT * FROM activities WHERE activity_id=$1 AND status='active' LIMIT 1",
      [entry.default_activity_code]
    );
    if (rows[0]) { activityId = rows[0].activity_id; activityRow = rows[0]; }
  }

  if (!activityId && station.default_activity_id) {
    const { rows } = await query(
      "SELECT * FROM activities WHERE activity_id=$1 AND status='active' LIMIT 1",
      [station.default_activity_id]
    );
    if (rows[0]) { activityId = rows[0].activity_id; activityRow = rows[0]; }
  }

  if (!activityId && entry?.landing_code) {
    const { rows: lRows } = await query(
      "SELECT default_activity_code FROM landing_templates WHERE landing_code=$1 LIMIT 1",
      [entry.landing_code]
    );
    if (lRows[0]?.default_activity_code) {
      const { rows } = await query(
        "SELECT * FROM activities WHERE activity_id=$1 AND status='active' LIMIT 1",
        [lRows[0].default_activity_code]
      );
      if (rows[0]) { activityId = rows[0].activity_id; activityRow = rows[0]; }
    }
  }

  if (!activityId || !activityRow) {
    const errMsg = `站点 ${stationCode} 无可用活动（entry=${srcEntryCode}）`;
    console.warn(`[A-system] ${errMsg}`);
    await upsertWebhookEvent({
      eventId: event_id, eventType: "device_borrow",
      payloadJson: body, status: "failed",
      stationCode, entryCode: srcEntryCode, userId,
      errorMessage: errMsg,
    });
    return sendJson(res, 422, { code: 422, error: "NO_ACTIVE_ACTIVITY", msg: errMsg });
  }

  // ── 参与活动 + 发积分（复用同一事务逻辑）────────────────────────────
  const rewardPoints  = Number(activityRow.reward_points) || 0;
  const actName       = activityRow.activity_name;
  const actNameStr    = typeof actName === "object"
    ? (actName?.zh || actName?.en || activityId)
    : (actName || activityId);
  const now           = new Date();

  // 站点归因快照
  const srcStationCode      = stationCode;
  const srcASystemStationId = station.a_system_station_id || "";
  const srcDeviceCode       = device_code || station.device_code || "";
  const srcLandingId        = entry?.landing_code || activityRow.landing_code || "";
  const srcChannelId        = "a_system_device_borrow";

  const participationId = `part_asys_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  let alreadyJoined  = false;
  let pointsAwarded  = 0;

  try {
    await withTransaction(async (client) => {
      // 参与记录（幂等：ON CONFLICT activity_id+user_id DO NOTHING）
      const { rows: partRows } = await client.query(
        `INSERT INTO activity_participations
           (id, activity_id, user_id, line_user_id, points_awarded,
            source_entry_id, source_landing_id, source_banner_id, source_channel_id,
            source_station_code, source_a_system_station_id, source_device_code,
            joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (activity_id, user_id) DO NOTHING
         RETURNING *`,
        [
          participationId, activityId, userId, line_user_id || userId, rewardPoints,
          srcEntryCode, srcLandingId, "", srcChannelId,
          srcStationCode, srcASystemStationId, srcDeviceCode,
          now,
        ]
      );

      if (partRows.length === 0) {
        alreadyJoined = true;
        return;
      }

      pointsAwarded = rewardPoints;

      // 积分流水
      if (rewardPoints > 0) {
        const ledgerId = `ledger_asys_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await client.query(
          `INSERT INTO points_ledger
             (id, user_id, line_user_id, type, points, ref_type, ref_id, reason, operator_id,
              source_entry_id, source_activity_id, source_landing_id, source_banner_id, source_channel_id,
              source_station_code, source_a_system_station_id, source_device_code,
              created_at)
           VALUES ($1,$2,$3,'credit',$4,'activity_reward',$5,$6,'a_system',
                   $7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            ledgerId, userId, line_user_id || userId,
            rewardPoints, activityId,
            `A系统借机奖励：${actNameStr}`,
            srcEntryCode, activityId, srcLandingId, "", srcChannelId,
            srcStationCode, srcASystemStationId, srcDeviceCode,
            now,
          ]
        );

        // 更新积分账户
        await client.query(
          `INSERT INTO points_accounts (user_id, line_user_id, total_points, available_points, updated_at)
           VALUES ($1,$2,$3,$3,$4)
           ON CONFLICT (user_id) DO UPDATE SET
             total_points     = points_accounts.total_points     + EXCLUDED.total_points,
             available_points = points_accounts.available_points + EXCLUDED.available_points,
             updated_at       = EXCLUDED.updated_at`,
          [userId, line_user_id || userId, rewardPoints, now]
        );
      }
    });
  } catch (txErr) {
    const errMsg = `事务失败：${txErr.message}`;
    console.error("[A-system] 事务错误:", txErr);
    await upsertWebhookEvent({
      eventId: event_id, eventType: "device_borrow",
      payloadJson: body, status: "failed",
      stationCode, entryCode: srcEntryCode, activityId,
      userId, errorMessage: errMsg,
    });
    return sendJson(res, 500, { code: 500, error: "TRANSACTION_FAILED", msg: errMsg });
  }

  // ── 更新事件记录为成功 ──────────────────────────────────────────────
  await upsertWebhookEvent({
    eventId: event_id, eventType: "device_borrow",
    payloadJson: body,
    status: alreadyJoined ? "duplicate" : "success",
    stationCode, entryCode: srcEntryCode, activityId,
    userId, pointsAwarded,
  });

  return sendJson(res, 200, {
    code: 200,
    msg: alreadyJoined ? "already_joined" : "success",
    data: {
      event_id,
      already_processed: false,
      already_joined:    alreadyJoined,
      station_code:      stationCode,
      entry_code:        srcEntryCode,
      activity_id:       activityId,
      points_awarded:    pointsAwarded,
      reward_triggered:  !alreadyJoined && rewardPoints > 0,
    },
  });
}

// ─── 站点同步 ────────────────────────────────────────────────────────────────

/**
 * POST /api/a-system/webhook/station-sync
 *
 * 用途：A 系统站点信息更新时，同步到增长系统 stations 表
 * sync_type:
 *  - upsert  → 以 a_system_station_id 为 key，更新已有或插入新站点
 *  - disable → 将站点状态改为 inactive
 */
export async function handleStationSyncWebhook(req, res, url, sendJson) {
  const rawBody = await readRawBody(req);

  const sigCheck = checkSignature(req, rawBody);
  if (!sigCheck.ok) {
    return sendJson(res, 401, { code: 401, error: "SIGNATURE_INVALID", msg: sigCheck.reason });
  }

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return sendJson(res, 400, { code: 400, error: "INVALID_JSON", msg: "请求体不是合法 JSON" });
  }

  const {
    sync_type           = "upsert",
    a_system_station_id = "",
    a_system_device_id  = "",
    device_code         = "",
    station_name,
    city_code           = "",
    district            = "",
    address             = "",
    latitude,
    longitude,
    capacity,
    status              = "active",
  } = body;

  if (!a_system_station_id) {
    return sendJson(res, 400, { code: 400, error: "MISSING_A_SYSTEM_STATION_ID", msg: "a_system_station_id 为必填" });
  }

  const eventId = body.event_id || `station_sync_${a_system_station_id}_${Date.now()}`;

  console.log(`[A-system] station-sync sync_type=${sync_type} a_system_station_id=${a_system_station_id}`);

  if (sync_type === "disable") {
    // 仅将该站点状态改为 inactive
    const { rows } = await query(
      "UPDATE stations SET status='inactive', updated_at=NOW() WHERE a_system_station_id=$1 AND a_system_station_id <> '' RETURNING station_code",
      [a_system_station_id]
    );
    const action = rows.length > 0 ? "disabled" : "not_found";
    await upsertWebhookEvent({
      eventId, eventType: "station_sync",
      payloadJson: body, status: rows.length > 0 ? "success" : "failed",
      stationCode: rows[0]?.station_code || "", errorMessage: action === "not_found" ? "未找到对应站点" : "",
    });
    return sendJson(res, 200, {
      code: 200, msg: "station sync completed",
      data: { action, a_system_station_id, station_code: rows[0]?.station_code || null },
    });
  }

  // upsert：先查是否已存在
  const { rows: existing } = await query(
    "SELECT station_code FROM stations WHERE a_system_station_id=$1 AND a_system_station_id <> '' LIMIT 1",
    [a_system_station_id]
  );

  let resultCode;
  let action;

  if (existing.length > 0) {
    // 更新已有站点
    resultCode = existing[0].station_code;
    const updateFields = [];
    const updateParams = [];
    let pi = 1;

    if (station_name) {
      updateFields.push(`station_name=$${pi++}`);
      updateParams.push(JSON.stringify(station_name));
    }
    if (city_code)  { updateFields.push(`city_code=$${pi++}`);  updateParams.push(city_code); }
    if (district)   { updateFields.push(`district=$${pi++}`);    updateParams.push(district); }
    if (address)    { updateFields.push(`address=$${pi++}`);     updateParams.push(address); }
    if (latitude != null)  { updateFields.push(`latitude=$${pi++}`);   updateParams.push(Number(latitude)); }
    if (longitude != null) { updateFields.push(`longitude=$${pi++}`);  updateParams.push(Number(longitude)); }
    if (capacity != null)  { updateFields.push(`capacity=$${pi++}`);   updateParams.push(Number(capacity)); }
    if (device_code)        { updateFields.push(`device_code=$${pi++}`);        updateParams.push(device_code); }
    if (a_system_device_id) { updateFields.push(`a_system_device_id=$${pi++}`); updateParams.push(a_system_device_id); }

    updateFields.push(`status=$${pi++}`);
    updateParams.push(status);

    if (updateFields.length > 0) {
      updateParams.push(existing[0].station_code);
      await query(
        `UPDATE stations SET ${updateFields.join(", ")}, updated_at=NOW() WHERE station_code=$${pi}`,
        updateParams
      );
    }
    action = "updated";
  } else {
    // 新插入站点：生成 station_code
    const { rows: cntRows } = await query("SELECT COUNT(*) as cnt FROM stations");
    const cnt = Number(cntRows[0]?.cnt || 0);
    resultCode = `st_asys_${String(cnt + 1).padStart(3, "0")}`;

    const nameJson = station_name
      ? JSON.stringify(station_name)
      : JSON.stringify({ zh: a_system_station_id, th: a_system_station_id, en: a_system_station_id });

    await query(
      `INSERT INTO stations
         (station_code, station_name, station_type, status,
          city_code, district, address, latitude, longitude, capacity,
          a_system_station_id, device_code, a_system_device_id,
          source, created_at, updated_at)
       VALUES ($1,$2,'standard',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'a_system',NOW(),NOW())`,
      [
        resultCode, nameJson, status,
        city_code, district, address,
        latitude != null ? Number(latitude) : null,
        longitude != null ? Number(longitude) : null,
        capacity != null ? Number(capacity) : null,
        a_system_station_id, device_code || "", a_system_device_id || "",
      ]
    );
    action = "created";
  }

  await upsertWebhookEvent({
    eventId, eventType: "station_sync",
    payloadJson: body, status: "success",
    stationCode: resultCode,
  });

  return sendJson(res, 200, {
    code: 200, msg: "station sync completed",
    data: { action, a_system_station_id, station_code: resultCode },
  });
}
