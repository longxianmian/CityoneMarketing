import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function readJSON(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}

function mlStr(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.zh || v.en || v.th || "";
  return String(v);
}

// ── 仪表板汇总指标 ────────────────────────────────────────────────────────
export async function handleDashboardStats(req, res, sendJson) {
  const interactions = readJSON("activity-interactions");
  const shareRelations = readJSON("share-relations");
  const pointsAccounts = readJSON("points-accounts");
  const activities = readJSON("activities");
  const coupons = readJSON("coupons");

  const visitCount = interactions.length;
  const newUsers = pointsAccounts.length;
  const couponIssued = coupons.reduce((s, c) => s + (Number(c.total_count) || 0), 0);
  const attributedOrders = 0;
  const inviteUsers = shareRelations.filter((r) => r.follow_status === "followed").length;
  const uniqueInteractUsers = new Set(interactions.map((i) => i.line_user_id)).size;
  const conversionRate =
    newUsers > 0 ? Number(((uniqueInteractUsers / newUsers) * 100).toFixed(1)) : 0;

  // 渠道贡献：按 utm_source 分组
  const channelMap = {};
  const channelUsersMap = {};
  for (const item of interactions) {
    const src = item.utm_source?.trim() || "LINE OA";
    channelMap[src] = (channelMap[src] || 0) + 1;
    if (!channelUsersMap[src]) channelUsersMap[src] = new Set();
    channelUsersMap[src].add(item.line_user_id);
  }
  const totalVisits = visitCount || 1;
  const channelData = Object.entries(channelMap)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, visits]) => ({
      channel,
      visits,
      users: channelUsersMap[channel]?.size || 0,
      orders: 0,
      rate: Number(((visits / totalVisits) * 100).toFixed(1)),
    }));

  // 活动表现概览
  const iaByActivity = {};
  for (const item of interactions) {
    if (!iaByActivity[item.activity_id])
      iaByActivity[item.activity_id] = { count: 0, users: new Set() };
    iaByActivity[item.activity_id].count++;
    iaByActivity[item.activity_id].users.add(item.line_user_id);
  }

  const STATUS_MAP = { active: "进行中", draft: "草稿", ended: "已结束" };
  const activityData = activities.map((a) => {
    const ia = iaByActivity[a.id] || { count: 0, users: new Set() };
    return {
      id: a.id,
      name: mlStr(a.activity_name),
      status: STATUS_MAP[a.status] || a.status,
      participants: ia.users.size,
      interactions: ia.count,
      rewards: a.coupon_name || "--",
      orders: 0,
    };
  });

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      stats: { visitCount, newUsers, couponIssued, attributedOrders, inviteUsers, conversionRate },
      channelData,
      activityData,
    },
  });
}

// ── 增长报告数据 ──────────────────────────────────────────────────────────
export async function handleGrowthReport(req, res, sendJson) {
  const activities = readJSON("activities");
  const coupons = readJSON("coupons");
  const interactions = readJSON("activity-interactions");
  const shareRelations = readJSON("share-relations");

  const followsByContent = {};
  for (const sr of shareRelations) {
    if (sr.follow_status === "followed")
      followsByContent[sr.share_content_id] = (followsByContent[sr.share_content_id] || 0) + 1;
  }

  const iaByActivity = {};
  for (const ia of interactions) {
    if (!iaByActivity[ia.activity_id])
      iaByActivity[ia.activity_id] = { count: 0, users: new Set() };
    iaByActivity[ia.activity_id].count++;
    iaByActivity[ia.activity_id].users.add(ia.line_user_id);
  }

  const buildRow = (item, type) => {
    const id = item.id;
    const ia = iaByActivity[id] || { count: 0, users: new Set() };
    const follows = followsByContent[id] || 0;
    const clicks = ia.count;
    const reads = item.participant_count || ia.users.size || 0;
    const users = ia.users.size;
    const members = Math.floor(users * 0.4);
    const clickRate = reads > 0 ? Number(((clicks / reads) * 100).toFixed(2)) : 0;
    const followRate = clicks > 0 ? Number(((follows / clicks) * 100).toFixed(2)) : 0;
    const userRate = follows > 0 ? Number(((users / follows) * 100).toFixed(2)) : 0;
    const memberRate = users > 0 ? Number(((members / users) * 100).toFixed(2)) : 0;
    const totalMemberRate = follows > 0 ? Number(((members / follows) * 100).toFixed(2)) : 0;
    return {
      id, unitType: type,
      unitName: mlStr(item.activity_name || item.name),
      department: item.department || "--",
      ownerDept: item.owner_dept || item.department || "--",
      partnerDept: item.partner_dept || "--",
      goal: item.goal || "--",
      reads, clicks, follows, clickRate, followRate,
      users, members, userRate, memberRate, totalMemberRate,
    };
  };

  const PROMO_GOALS = new Set(["拉新", "促关注", "引流", "曝光"]);
  const ONSITE_GOALS = new Set(["转用户", "转会员", "复购"]);
  const OA_GOALS = new Set(["召回", "OA唤醒"]);

  const promotionData = [
    ...activities.filter((a) => PROMO_GOALS.has(a.goal)).map((a) => buildRow(a, "活动")),
    ...coupons.filter((c) => PROMO_GOALS.has(c.goal)).map((c) => buildRow(c, "卡券")),
  ];
  const onsiteData = [
    ...activities.filter((a) => ONSITE_GOALS.has(a.goal)).map((a) => buildRow(a, "活动")),
    ...coupons.filter((c) => ONSITE_GOALS.has(c.goal)).map((c) => buildRow(c, "卡券")),
  ];
  const oaData = activities
    .filter((a) => OA_GOALS.has(a.goal))
    .map((a) => buildRow(a, "活动"));
  const jointData = activities
    .filter((a) => a.partner_dept && a.partner_dept !== "--" && a.partner_dept !== "")
    .map((a) => buildRow(a, "活动"));

  const classified = new Set([
    ...promotionData, ...onsiteData, ...oaData, ...jointData,
  ].map((r) => r.id));
  const unclassified = activities
    .filter((a) => !classified.has(a.id))
    .map((a) => buildRow(a, "活动"));

  sendJson(res, 200, {
    code: 200, msg: "success",
    data: {
      promotionData: [...promotionData, ...unclassified],
      onsiteData, oaData, jointData,
    },
  });
}
