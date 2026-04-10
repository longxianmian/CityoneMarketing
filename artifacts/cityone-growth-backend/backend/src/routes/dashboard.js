import { query } from "../db/pool.js";

function mlStr(v) {
  if (!v) return "";
  if (typeof v === "string") { try { const p = JSON.parse(v); return p?.zh || p?.en || p?.th || v; } catch { return v; } }
  if (typeof v === "object") return v.zh || v.en || v.th || "";
  return String(v);
}

// ── 仪表板汇总指标 (全部读 PostgreSQL) ───────────────────────────────────────
export async function handleDashboardStats(req, res, sendJson) {
  try {
    // ① 基础计数
    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*) FROM activity_participations)                              AS participations,
        (SELECT COUNT(*) FROM points_accounts)                                     AS users,
        (SELECT COUNT(*) FROM user_coupons)                                        AS coupons_issued,
        (SELECT COUNT(*) FROM consume_relations)                                   AS attributed_orders,
        (SELECT COUNT(*) FROM share_relations WHERE follow_status = 'followed')    AS invite_users,
        (SELECT COUNT(DISTINCT line_user_id) FROM activity_participations)         AS unique_participants
    `);
    const c = counts[0];

    const visitCount       = Number(c.participations);
    const newUsers         = Number(c.users);
    const couponIssued     = Number(c.coupons_issued);
    const attributedOrders = Number(c.attributed_orders);
    const inviteUsers      = Number(c.invite_users);
    const uniqueP          = Number(c.unique_participants);
    const conversionRate   = newUsers > 0 ? Number(((uniqueP / newUsers) * 100).toFixed(1)) : 0;

    // ② 渠道贡献（按 source_channel_id）
    const { rows: chanRows } = await query(`
      SELECT
        COALESCE(NULLIF(TRIM(source_channel_id),''), 'LINE OA') AS channel,
        COUNT(*)                           AS visits,
        COUNT(DISTINCT line_user_id)       AS users
      FROM activity_participations
      GROUP BY 1
      ORDER BY visits DESC
      LIMIT 20
    `);
    const totalVisits = visitCount || 1;
    const channelData = chanRows.map(r => ({
      channel: r.channel,
      visits:  Number(r.visits),
      users:   Number(r.users),
      orders:  0,
      rate:    Number(((r.visits / totalVisits) * 100).toFixed(1)),
    }));
    if (channelData.length === 0 && visitCount === 0) {
      channelData.push({ channel: "LINE OA", visits: 0, users: 0, orders: 0, rate: 100 });
    }

    // ③ 活动表现概览（join activities + activity_participations）
    const { rows: actRows } = await query(`
      SELECT
        a.activity_id    AS id,
        a.activity_name,
        a.status,
        COALESCE(p.participants,0) AS participants,
        COALESCE(p.interactions, 0) AS interactions
      FROM activities a
      LEFT JOIN (
        SELECT activity_id,
               COUNT(*)                   AS interactions,
               COUNT(DISTINCT line_user_id) AS participants
        FROM activity_participations
        GROUP BY activity_id
      ) p ON p.activity_id = a.activity_id
      ORDER BY a.created_at DESC
      LIMIT 20
    `);
    const STATUS_MAP = { active: "进行中", draft: "草稿", ended: "已结束", inactive: "已停用" };
    const activityData = actRows.map(a => ({
      id:           a.id,
      name:         mlStr(a.activity_name),
      status:       STATUS_MAP[a.status] || a.status,
      participants: Number(a.participants),
      interactions: Number(a.interactions),
      rewards:      "--",
      orders:       0,
    }));

    sendJson(res, 200, {
      code: 200, msg: "success",
      data: {
        stats: { visitCount, newUsers, couponIssued, attributedOrders, inviteUsers, conversionRate },
        channelData,
        activityData,
      },
    });
  } catch (err) {
    sendJson(res, 500, { code: 500, error: "DB_ERROR", msg: err.message });
  }
}

// ── 增长报告数据（推广/运营/OA/联合活动 四维度）──────────────────────────────
export async function handleGrowthReport(req, res, url, sendJson) {
  try {
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo   = url.searchParams.get("dateTo")   || "";
    const dept     = url.searchParams.get("dept")      || "";
    const unitFilter = url.searchParams.get("unitType") || "";

    // ① 取全部活动（含参与聚合）
    const { rows: activities } = await query(`
      SELECT
        a.activity_id AS id,
        a.activity_name,
        a.status,
        a.goal,
        a.department,
        a.partner_dept,
        COALESCE(p.interactions, 0)  AS interactions,
        COALESCE(p.participants, 0)  AS participants,
        COALESCE(p.participants, 0)  AS reads
      FROM activities a
      LEFT JOIN (
        SELECT activity_id,
               COUNT(*)                     AS interactions,
               COUNT(DISTINCT line_user_id) AS participants
        FROM activity_participations
        ${dateFrom ? `WHERE joined_at >= $1` : ""}
        ${dateFrom && dateTo ? `AND joined_at <= $2` : dateTo ? `WHERE joined_at <= $1` : ""}
        GROUP BY activity_id
      ) p ON p.activity_id = a.activity_id
      ${dept ? `WHERE a.department = $${dateFrom && dateTo ? 3 : dateFrom || dateTo ? 2 : 1}` : ""}
      ORDER BY a.created_at DESC
    `, (() => { const p=[]; if(dateFrom) p.push(dateFrom); if(dateTo) p.push(dateTo); if(dept) p.push(dept); return p; })());

    // ② 取全部卡券（含领取聚合）
    const { rows: coupons } = await query(`
      SELECT
        c.id,
        c.name         AS activity_name,
        CASE WHEN c.status = 1 THEN 'active' ELSE 'inactive' END AS status,
        '--'           AS goal,
        '--'           AS department,
        '--'           AS partner_dept,
        COALESCE(uc.issued, 0) AS interactions,
        COALESCE(uc.issued, 0) AS participants,
        COALESCE(uc.issued, 0) AS reads
      FROM coupons c
      LEFT JOIN (
        SELECT coupon_id, COUNT(*) AS issued
        FROM user_coupons
        GROUP BY coupon_id
      ) uc ON uc.coupon_id = c.id
      ORDER BY c.created_at DESC
    `);

    // ③ 关注数（按 campaign_id = activity_id 归因）
    const { rows: follows } = await query(`
      SELECT campaign_id, COUNT(*) AS follows
      FROM share_relations
      WHERE follow_status = 'followed'
      GROUP BY campaign_id
    `);
    const followMap = {};
    for (const f of follows) followMap[f.campaign_id] = Number(f.follows);

    const buildRow = (item, type) => {
      const reads   = Number(item.reads);
      const clicks  = Number(item.interactions);
      const follows = followMap[item.id] || 0;
      const users   = Number(item.participants);
      const members = Math.round(users * 0.35); // 占位：接入A系统后替换真实会员数
      const clickRate  = reads  > 0 ? +((clicks / reads) * 100).toFixed(2) : 0;
      const followRate = clicks > 0 ? +((follows / clicks) * 100).toFixed(2) : 0;
      const userRate   = follows > 0 ? +((users / follows) * 100).toFixed(2) : 0;
      const memberRate = users > 0 ? +((members / users) * 100).toFixed(2) : 0;
      const totalMemberRate = follows > 0 ? +((members / follows) * 100).toFixed(2) : 0;
      return {
        id: item.id, unitType: type,
        unitName:    mlStr(item.activity_name),
        department:  item.department  || "--",
        ownerDept:   item.department  || "--",
        partnerDept: item.partner_dept || "--",
        goal: item.goal || "--",
        reads, clicks, follows, clickRate, followRate,
        users, members, userRate, memberRate, totalMemberRate,
      };
    };

    const PROMO  = new Set(["拉新","促关注","引流","曝光"]);
    const ONSITE = new Set(["转用户","转会员","复购"]);
    const OA     = new Set(["召回","OA唤醒"]);

    const allActRows    = activities.map(a => buildRow(a, "活动"));
    const allCpnRows    = coupons.map(c => buildRow(c, "卡券"));
    const promotionData = [
      ...allActRows.filter(r => PROMO.has(r.goal)),
      ...allCpnRows.filter(r => PROMO.has(r.goal)),
      ...allActRows.filter(r => !PROMO.has(r.goal) && !ONSITE.has(r.goal) && !OA.has(r.goal)),
    ];
    const onsiteData = [
      ...allActRows.filter(r => ONSITE.has(r.goal)),
      ...allCpnRows.filter(r => ONSITE.has(r.goal)),
    ];
    const oaData    = allActRows.filter(r => OA.has(r.goal));
    const jointData = allActRows.filter(r => r.partnerDept && r.partnerDept !== "--" && r.partnerDept !== "");

    sendJson(res, 200, {
      code: 200, msg: "success",
      data: { promotionData, onsiteData, oaData, jointData },
    });
  } catch (err) {
    sendJson(res, 500, { code: 500, error: "DB_ERROR", msg: err.message });
  }
}
