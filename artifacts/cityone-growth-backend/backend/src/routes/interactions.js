import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueUserProduct } from "./products.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const PRIZES_FILE = path.join(DATA_DIR, "activity-prizes.json");
const FORTUNE_THEMES_FILE = path.join(DATA_DIR, "activity-fortune-themes.json");
const SIGNS_FILE = path.join(DATA_DIR, "activity-signs.json");
const CHANCES_FILE = path.join(DATA_DIR, "activity-user-chances.json");
const INTERACTIONS_FILE = path.join(DATA_DIR, "activity-interactions.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadJsonArray(filePath) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveJsonArray(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
function nextId(list, prefix, field) {
  const max = list.reduce((m, item) => {
    const matched = String(item[field] || "").match(new RegExp(`^${prefix}_(\\d+)$`));
    return matched ? Math.max(m, Number(matched[1])) : m;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
}

// ─── 新活动检测：若活动创建时间晚于用户次数记录更新时间，视为旧记录，重置次数 ──────────────────
// 场景：管理端删除旧活动再创建同名新活动，得到相同 ID → 旧次数记录应作废
function resetChanceIfNewActivity(activityId, chance) {
  try {
    const activities = loadJsonArray(ACTIVITIES_FILE);
    const activity = activities.find((a) => a.activity_id === activityId);
    if (!activity?.created_at || !chance?.updated_at) return false;
    const actCreatedAt = new Date(activity.created_at);
    const chanceUpdatedAt = new Date(chance.updated_at);
    // 活动创建时间 > 次数记录最后更新时间 → 此记录属于旧活动，需要重置
    if (actCreatedAt > chanceUpdatedAt) {
      const list = loadJsonArray(CHANCES_FILE);
      const idx = list.findIndex((c) => c.chance_id === chance.chance_id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          granted_count: 1,
          used_count: 0,
          remaining_count: 1,
          grant_source: "auto_first",
          updated_at: new Date().toISOString(),
        };
        saveJsonArray(CHANCES_FILE, list);
        return list[idx];
      }
    }
  } catch { /* ignore */ }
  return false;
}

// ─── 次数账户 ────────────────────────────────────────────────────────────────

function getOrCreateChance(activityId, lineUserId) {
  const list = loadJsonArray(CHANCES_FILE);
  let record = list.find((c) => c.activity_id === activityId && c.line_user_id === lineUserId);
  if (!record) {
    record = {
      chance_id: nextId(list, "ch", "chance_id"),
      activity_id: activityId,
      line_user_id: lineUserId,
      granted_count: 0,
      used_count: 0,
      remaining_count: 0,
      grant_source: "",
      updated_at: new Date().toISOString(),
    };
    list.push(record);
    saveJsonArray(CHANCES_FILE, list);
  }
  return record;
}

function consumeChance(activityId, lineUserId) {
  const list = loadJsonArray(CHANCES_FILE);
  const idx = list.findIndex((c) => c.activity_id === activityId && c.line_user_id === lineUserId);
  if (idx < 0 || list[idx].remaining_count <= 0) return false;
  list[idx] = {
    ...list[idx],
    used_count: list[idx].used_count + 1,
    remaining_count: list[idx].remaining_count - 1,
    updated_at: new Date().toISOString(),
  };
  saveJsonArray(CHANCES_FILE, list);
  return true;
}

export async function handleGrantChance(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    const count = Number(body.count || 1);
    const grantSource = String(body.grant_source || "system").trim();

    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    const list = loadJsonArray(CHANCES_FILE);
    const idx = list.findIndex((c) => c.activity_id === activityId && c.line_user_id === lineUserId);
    let record;

    if (idx < 0) {
      record = {
        chance_id: nextId(list, "ch", "chance_id"),
        activity_id: activityId,
        line_user_id: lineUserId,
        granted_count: count,
        used_count: 0,
        remaining_count: count,
        grant_source: grantSource,
        updated_at: new Date().toISOString(),
      };
      list.push(record);
    } else {
      list[idx] = {
        ...list[idx],
        granted_count: list[idx].granted_count + count,
        remaining_count: list[idx].remaining_count + count,
        grant_source: grantSource,
        updated_at: new Date().toISOString(),
      };
      record = list[idx];
    }
    saveJsonArray(CHANCES_FILE, list);
    return sendOk(res, sendJson, "次数已赠送", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "GRANT_FAILED", err.message || "赠送失败");
  }
}

// ─── 奖池管理 ────────────────────────────────────────────────────────────────

/**
 * 奖池查询
 * 支持两种方式：
 *   ?gameProgramId=gp_xxx  → 按游戏玩法查（首选）
 *   ?activityId=act_xxx    → 按活动查（兼容旧逻辑）
 * 优先级：gameProgramId > activityId
 */
export function handlePrizeList(req, res, url, sendJson) {
  const gameProgramId = url.searchParams.get("gameProgramId");
  const activityId    = url.searchParams.get("activityId");
  const list = loadJsonArray(PRIZES_FILE);

  let result = list;
  if (gameProgramId) {
    result = list.filter((p) => p.game_program_id === gameProgramId);
  } else if (activityId) {
    // 先尝试通过 game_program_id 关联查找（activityId → game_program_id → prizes）
    const activities = loadJsonArray(ACTIVITIES_FILE);
    const activity   = activities.find((a) => a.activity_id === activityId);
    if (activity?.game_program_id) {
      result = list.filter((p) => p.game_program_id === activity.game_program_id);
    } else {
      result = list.filter((p) => p.activity_id === activityId);
    }
  }
  return sendOk(res, sendJson, "prizes loaded", result);
}

export async function handlePrizeCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const gameProgramId = String(body.game_program_id || "").trim();
    const activityId    = String(body.activity_id    || "").trim();
    const prizeName     = String(body.prize_name     || "").trim();

    // game_program_id 和 activity_id 至少有一个
    if (!gameProgramId && !activityId)
      return sendError(res, sendJson, 400, "ID_REQUIRED", "game_program_id 或 activity_id 必填其一");
    if (!prizeName)
      return sendError(res, sendJson, 400, "PRIZE_NAME_REQUIRED", "prize_name 必填");

    const VALID_TYPES = ["coupon", "digital_product", "points", "qualification", "thanks"];
    const prizeType = String(body.prize_type || "thanks").trim();
    if (!VALID_TYPES.includes(prizeType))
      return sendError(res, sendJson, 400, "TYPE_INVALID", `prize_type 必须是: ${VALID_TYPES.join(" | ")}`);

    const list = loadJsonArray(PRIZES_FILE);
    const now = new Date().toISOString();
    const item = {
      prize_id:           nextId(list, "pz", "prize_id"),
      game_program_id:    gameProgramId || undefined,   // 优先绑定游戏玩法
      activity_id:        activityId    || undefined,   // 兼容旧逻辑
      prize_name:         prizeName,
      prize_type:         prizeType,
      reward_product_id:  body.reward_product_id || "",
      probability_weight: Number(body.probability_weight || 10),
      stock_qty:          Number(body.stock_qty ?? -1),
      display_text:       body.display_text || prizeName,
      display_color:      body.display_color || "#FF6B35",
      sort_no:            Number(body.sort_no || 0),
      status:             "enabled",
      created_at:         now,
      updated_at:         now,
    };
    list.push(item);
    saveJsonArray(PRIZES_FILE, list);
    return sendOk(res, sendJson, "prize created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export async function handlePrizeUpdate(req, res, url, sendJson, readBody) {
  try {
    const prizeId = url.pathname.split("/").pop();
    if (!prizeId) return sendError(res, sendJson, 400, "PRIZE_ID_REQUIRED", "prize_id 必填");
    const body = await readBody(req);
    const list = loadJsonArray(PRIZES_FILE);
    const idx = list.findIndex((p) => p.prize_id === prizeId);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "奖项不存在");
    list[idx] = {
      ...list[idx],
      prize_name: body.prize_name ?? list[idx].prize_name,
      prize_type: body.prize_type ?? list[idx].prize_type,
      reward_product_id: body.reward_product_id ?? list[idx].reward_product_id,
      probability_weight: body.probability_weight !== undefined ? Number(body.probability_weight) : list[idx].probability_weight,
      stock_qty: body.stock_qty !== undefined ? Number(body.stock_qty) : list[idx].stock_qty,
      display_text: body.display_text ?? list[idx].display_text,
      display_color: body.display_color ?? list[idx].display_color,
      sort_no: body.sort_no !== undefined ? Number(body.sort_no) : list[idx].sort_no,
      status: body.status ?? list[idx].status,
      updated_at: new Date().toISOString(),
    };
    saveJsonArray(PRIZES_FILE, list);
    return sendOk(res, sendJson, "prize updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message || "更新失败");
  }
}

export async function handlePrizeDelete(req, res, url, sendJson) {
  try {
    const prizeId = url.pathname.split("/").pop();
    if (!prizeId) return sendError(res, sendJson, 400, "PRIZE_ID_REQUIRED", "prize_id 必填");
    const list = loadJsonArray(PRIZES_FILE);
    const idx = list.findIndex((p) => p.prize_id === prizeId);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "奖项不存在");
    list.splice(idx, 1);
    saveJsonArray(PRIZES_FILE, list);
    return sendOk(res, sendJson, "prize deleted", { prize_id: prizeId });
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message || "删除失败");
  }
}

// ─── 签池管理 ────────────────────────────────────────────────────────────────

export function handleFortuneThemeList(req, res, url, sendJson) {
  const activityId = url.searchParams.get("activityId");
  const list = loadJsonArray(FORTUNE_THEMES_FILE);
  const result = activityId ? list.filter((t) => t.activity_id === activityId) : list;
  return sendOk(res, sendJson, "fortune themes loaded", result);
}

export async function handleFortuneThemeCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const themeName = String(body.theme_name || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!themeName) return sendError(res, sendJson, 400, "THEME_NAME_REQUIRED", "theme_name 必填");

    const list = loadJsonArray(FORTUNE_THEMES_FILE);
    const item = {
      theme_id: nextId(list, "ft", "theme_id"),
      activity_id: activityId,
      theme_name: themeName,
      theme_icon: body.theme_icon || "",
      sort_no: Number(body.sort_no || 0),
      status: "enabled",
    };
    list.push(item);
    saveJsonArray(FORTUNE_THEMES_FILE, list);
    return sendOk(res, sendJson, "fortune theme created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

export function handleSignList(req, res, url, sendJson) {
  const activityId = url.searchParams.get("activityId");
  const themeId = url.searchParams.get("themeId");
  const list = loadJsonArray(SIGNS_FILE);
  let result = list;
  if (activityId) result = result.filter((s) => s.activity_id === activityId);
  if (themeId) result = result.filter((s) => s.theme_id === themeId);
  return sendOk(res, sendJson, "signs loaded", result);
}

export async function handleSignCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const themeId = String(body.theme_id || "").trim();
    const signTitle = String(body.sign_title || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!themeId) return sendError(res, sendJson, 400, "THEME_ID_REQUIRED", "theme_id 必填");
    if (!signTitle) return sendError(res, sendJson, 400, "SIGN_TITLE_REQUIRED", "sign_title 必填");

    const list = loadJsonArray(SIGNS_FILE);
    const now = new Date().toISOString();
    const item = {
      sign_id: nextId(list, "sg", "sign_id"),
      activity_id: activityId,
      theme_id: themeId,
      sign_title: signTitle,
      short_text: body.short_text || "",
      full_text: body.full_text || "",
      mood_tag: body.mood_tag || "",
      reward_product_id: body.reward_product_id || "",
      probability_weight: Number(body.probability_weight || 10),
      share_text: body.share_text || "",
      sort_no: Number(body.sort_no || 0),
      status: "enabled",
      created_at: now,
      updated_at: now,
    };
    list.push(item);
    saveJsonArray(SIGNS_FILE, list);
    return sendOk(res, sendJson, "sign created", item);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message || "创建失败");
  }
}

// ─── 后端加权随机抽奖 ────────────────────────────────────────────────────────

function weightedRandom(items, weightField = "probability_weight") {
  // stock_qty 未定义视为不限量（-1），签池签文没有 stock_qty 字段
  const active = items.filter((i) => {
    if (i.status !== "enabled") return false;
    const sq = i.stock_qty;
    return sq === undefined || sq === null || sq === -1 || sq > 0;
  });
  if (!active.length) return null;
  const total = active.reduce((s, i) => s + Number(i[weightField] || 0), 0);
  if (total <= 0) return active[Math.floor(Math.random() * active.length)];
  let rnd = Math.random() * total;
  for (const item of active) {
    rnd -= Number(item[weightField] || 0);
    if (rnd <= 0) return item;
  }
  return active[active.length - 1];
}

function deductPrizeStock(prizeId) {
  const list = loadJsonArray(PRIZES_FILE);
  const idx = list.findIndex((p) => p.prize_id === prizeId);
  if (idx >= 0 && list[idx].stock_qty > 0) {
    list[idx] = { ...list[idx], stock_qty: list[idx].stock_qty - 1 };
    saveJsonArray(PRIZES_FILE, list);
  }
}

function writeInteraction({ activityId, activityType, lineUserId, userId, stationId, entryId, utmSource, utmCampaign, actionType, actionResultId, resultType, relatedProductId }) {
  const list = loadJsonArray(INTERACTIONS_FILE);
  const record = {
    interaction_id: nextId(list, "ia", "interaction_id"),
    activity_id: activityId,
    activity_type: activityType,
    line_user_id: lineUserId || "",
    user_id: userId || "",
    station_id: stationId || "",
    entry_id: entryId || "",
    utm_source: utmSource || "",
    utm_campaign: utmCampaign || "",
    action_type: actionType,
    action_result_id: actionResultId || "",
    result_type: resultType,
    related_product_id: relatedProductId || "",
    created_at: new Date().toISOString(),
  };
  list.push(record);
  saveJsonArray(INTERACTIONS_FILE, list);
  return record;
}

// ─── 大转盘 ──────────────────────────────────────────────────────────────────

export async function handleWheelStart(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    const activities = loadJsonArray(ACTIVITIES_FILE);
    const activity = activities.find((a) => a.activity_id === activityId);
    const initialChances = Number(activity?.initial_chances || 1);

    let chance = getOrCreateChance(activityId, lineUserId);
    // 首次进入自动赠送 initial_chances 次机会（默认 1）
    if (chance.granted_count === 0) {
      const list = loadJsonArray(CHANCES_FILE);
      const idx = list.findIndex((c) => c.chance_id === chance.chance_id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], granted_count: initialChances, remaining_count: initialChances, grant_source: "auto_first", updated_at: new Date().toISOString() };
        saveJsonArray(CHANCES_FILE, list);
        chance = list[idx];
      }
    } else {
      // 检测：若次数记录比活动创建时间更早，说明这是新活动复用了旧 ID → 重置
      const reset = resetChanceIfNewActivity(activityId, chance);
      if (reset) chance = reset;
    }

    const prizes = loadJsonArray(PRIZES_FILE).filter(
      (p) => p.activity_id === activityId && p.status === "enabled"
    );

    return sendOk(res, sendJson, "大转盘已就绪", {
      activity_id: activityId,
      line_user_id: lineUserId,
      remaining_chances: chance.remaining_count,
      prize_count: prizes.length,
      can_draw: chance.remaining_count > 0,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "START_FAILED", err.message || "启动失败");
  }
}

export async function handleWheelDraw(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    if (!consumeChance(activityId, lineUserId))
      return sendError(res, sendJson, 400, "NO_CHANCES_LEFT", "抽奖次数不足");

    const prizes = loadJsonArray(PRIZES_FILE).filter(
      (p) => p.activity_id === activityId && p.status === "enabled"
    );
    if (!prizes.length) return sendError(res, sendJson, 400, "NO_PRIZES", "该活动尚未配置奖池");

    const won = weightedRandom(prizes);
    if (!won) return sendError(res, sendJson, 400, "NO_STOCK", "奖池库存不足");

    if (won.stock_qty > 0) deductPrizeStock(won.prize_id);

    let issuedProduct = null;
    if (won.prize_type !== "thanks" && won.reward_product_id) {
      const result = issueUserProduct({
        lineUserId,
        userId: body.user_id || "",
        productId: won.reward_product_id,
        sourceType: "activity",
        sourceId: activityId,
      });
      if (result.ok) issuedProduct = result.userProduct;
    }

    const interaction = writeInteraction({
      activityId,
      activityType: "lucky_wheel",
      lineUserId,
      userId: body.user_id,
      stationId: body.station_id,
      entryId: body.entry_id,
      utmSource: body.utm_source,
      utmCampaign: body.utm_campaign,
      actionType: "wheel_spin",
      actionResultId: won.prize_id,
      resultType: won.prize_type === "thanks" ? "thanks" : "prize",
      relatedProductId: won.reward_product_id,
    });

    return sendOk(res, sendJson, "抽奖完成", {
      prize: won,
      is_thanks: won.prize_type === "thanks",
      issued_product: issuedProduct,
      interaction_id: interaction.interaction_id,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DRAW_FAILED", err.message || "抽奖失败");
  }
}

// ─── 刮刮卡 ──────────────────────────────────────────────────────────────────

export async function handleScratchStart(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    const activities = loadJsonArray(ACTIVITIES_FILE);
    const activity = activities.find((a) => a.activity_id === activityId);
    const initialChances = Number(activity?.initial_chances || 1);

    let chance = getOrCreateChance(activityId, lineUserId);
    if (chance.granted_count === 0) {
      const list = loadJsonArray(CHANCES_FILE);
      const idx = list.findIndex((c) => c.chance_id === chance.chance_id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], granted_count: initialChances, remaining_count: initialChances, grant_source: "auto_first", updated_at: new Date().toISOString() };
        saveJsonArray(CHANCES_FILE, list);
        chance = list[idx];
      }
    } else {
      const reset = resetChanceIfNewActivity(activityId, chance);
      if (reset) chance = reset;
    }

    return sendOk(res, sendJson, "刮刮卡已就绪", {
      activity_id: activityId,
      line_user_id: lineUserId,
      remaining_chances: chance.remaining_count,
      can_scratch: chance.remaining_count > 0,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "START_FAILED", err.message || "启动失败");
  }
}

export async function handleScratchReveal(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    if (!consumeChance(activityId, lineUserId))
      return sendError(res, sendJson, 400, "NO_CHANCES_LEFT", "刮奖次数不足");

    // 奖池路由：优先按游戏玩法（game_program_id）查找奖品，兼容旧的按活动查找
    const allPrizes  = loadJsonArray(PRIZES_FILE);
    const activities = loadJsonArray(ACTIVITIES_FILE);
    const activity   = activities.find((a) => a.activity_id === activityId);
    const gpId       = activity?.game_program_id;

    const prizes = gpId
      ? allPrizes.filter((p) => p.game_program_id === gpId   && p.status === "enabled")
      : allPrizes.filter((p) => p.activity_id    === activityId && p.status === "enabled");
    if (!prizes.length) return sendError(res, sendJson, 400, "NO_PRIZES", "该活动尚未配置奖池");

    const won = weightedRandom(prizes);
    if (!won) return sendError(res, sendJson, 400, "NO_STOCK", "奖池库存不足");
    if (won.stock_qty > 0) deductPrizeStock(won.prize_id);

    let issuedProduct = null;
    if (won.prize_type !== "thanks" && won.reward_product_id) {
      const result = issueUserProduct({
        lineUserId,
        userId: body.user_id || "",
        productId: won.reward_product_id,
        sourceType: "activity",
        sourceId: activityId,
      });
      if (result.ok) issuedProduct = result.userProduct;
    }

    const interaction = writeInteraction({
      activityId,
      activityType: "scratch_card",
      lineUserId,
      userId: body.user_id,
      stationId: body.station_id,
      entryId: body.entry_id,
      utmSource: body.utm_source,
      utmCampaign: body.utm_campaign,
      actionType: "scratch_open",
      actionResultId: won.prize_id,
      resultType: won.prize_type === "thanks" ? "thanks" : "prize",
      relatedProductId: won.reward_product_id,
    });

    return sendOk(res, sendJson, "刮奖完成", {
      prize: won,
      is_thanks: won.prize_type === "thanks",
      issued_product: issuedProduct,
      interaction_id: interaction.interaction_id,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "REVEAL_FAILED", err.message || "刮奖失败");
  }
}

// ─── 泰式祈福抽签 ────────────────────────────────────────────────────────────

export async function handleFortuneStart(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");

    let chance = getOrCreateChance(activityId, lineUserId);
    if (chance.granted_count === 0) {
      const list = loadJsonArray(CHANCES_FILE);
      const idx = list.findIndex((c) => c.chance_id === chance.chance_id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], granted_count: 1, remaining_count: 1, grant_source: "auto_first", updated_at: new Date().toISOString() };
        saveJsonArray(CHANCES_FILE, list);
        chance = list[idx];
      }
    } else {
      const reset = resetChanceIfNewActivity(activityId, chance);
      if (reset) chance = reset;
    }

    const themes = loadJsonArray(FORTUNE_THEMES_FILE).filter(
      (t) => t.activity_id === activityId && t.status === "enabled"
    );

    return sendOk(res, sendJson, "祈福抽签已就绪", {
      activity_id: activityId,
      line_user_id: lineUserId,
      remaining_chances: chance.remaining_count,
      can_draw: chance.remaining_count > 0,
      themes: themes.map((t) => ({
        theme_id: t.theme_id,
        theme_name: t.theme_name,
        theme_icon: t.theme_icon,
        sort_no: t.sort_no,
      })),
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "START_FAILED", err.message || "启动失败");
  }
}

export async function handleFortuneDraw(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    const activityId = String(body.activity_id || "").trim();
    const lineUserId = String(body.line_user_id || "").trim();
    const themeId = String(body.theme_id || "").trim();
    if (!activityId) return sendError(res, sendJson, 400, "ACTIVITY_ID_REQUIRED", "activity_id 必填");
    if (!lineUserId) return sendError(res, sendJson, 400, "LINE_USER_ID_REQUIRED", "line_user_id 必填");
    if (!themeId) return sendError(res, sendJson, 400, "THEME_ID_REQUIRED", "theme_id 必填");

    if (!consumeChance(activityId, lineUserId))
      return sendError(res, sendJson, 400, "NO_CHANCES_LEFT", "抽签次数不足");

    const signs = loadJsonArray(SIGNS_FILE).filter(
      (s) => s.activity_id === activityId && s.theme_id === themeId && s.status === "enabled"
    );
    if (!signs.length) return sendError(res, sendJson, 400, "NO_SIGNS", "该主题下尚未配置签文");

    const drawn = weightedRandom(signs);
    if (!drawn) return sendError(res, sendJson, 400, "DRAW_EMPTY", "签池为空");

    let issuedProduct = null;
    if (drawn.reward_product_id) {
      const result = issueUserProduct({
        lineUserId,
        userId: body.user_id || "",
        productId: drawn.reward_product_id,
        sourceType: "activity",
        sourceId: activityId,
      });
      if (result.ok) issuedProduct = result.userProduct;
    }

    const interaction = writeInteraction({
      activityId,
      activityType: "thai_fortune_draw",
      lineUserId,
      userId: body.user_id,
      stationId: body.station_id,
      entryId: body.entry_id,
      utmSource: body.utm_source,
      utmCampaign: body.utm_campaign,
      actionType: "sign_draw",
      actionResultId: drawn.sign_id,
      resultType: "sign",
      relatedProductId: drawn.reward_product_id,
    });

    return sendOk(res, sendJson, "抽签完成", {
      sign: {
        sign_id: drawn.sign_id,
        sign_title: drawn.sign_title,
        short_text: drawn.short_text,
        full_text: drawn.full_text,
        mood_tag: drawn.mood_tag,
        share_text: drawn.share_text,
      },
      issued_product: issuedProduct,
      interaction_id: interaction.interaction_id,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "DRAW_FAILED", err.message || "抽签失败");
  }
}

// ── 管理端：查询某活动的用户次数列表 ─────────────────────────────────────────
// GET /api/activities/:id/user-chances?page=1&pageSize=20&keyword=xxx
export async function handleGetUserChances(req, res, url, sendJson) {
  try {
    const activityId = url.pathname.match(/^\/api\/activities\/([^/]+)\/user-chances/)?.[1];
    if (!activityId) return sendError(res, sendJson, 400, "ID_REQUIRED", "activity_id 必填");

    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
    const keyword = (url.searchParams.get("keyword") || "").toLowerCase().trim();

    const all = loadJsonArray(CHANCES_FILE).filter((c) => c.activity_id === activityId);

    const filtered = keyword
      ? all.filter((c) => c.line_user_id?.toLowerCase().includes(keyword))
      : all;

    const total = filtered.length;
    const totalGranted = filtered.reduce((s, c) => s + (c.granted_count || 0), 0);
    const totalUsed = filtered.reduce((s, c) => s + (c.used_count || 0), 0);
    const totalRemain = filtered.reduce((s, c) => s + (c.remaining_count || 0), 0);

    const list = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((c) => ({
        userId: c.line_user_id,
        nickName: c.nick_name || "",
        avatarUrl: c.avatar_url || "",
        grantedChances: c.granted_count || 0,
        usedChances: c.used_count || 0,
        remainChances: c.remaining_count || 0,
        grantSource: c.grant_source || "",
        firstPlayAt: c.created_at || "",
        lastPlayAt: c.updated_at || "",
      }));

    return sendOk(res, sendJson, "ok", {
      list,
      total,
      page,
      pageSize,
      totalGranted,
      totalUsed,
      totalRemain,
      userCount: all.length,
    });
  } catch (err) {
    return sendError(res, sendJson, 500, "FETCH_FAILED", err.message || "查询失败");
  }
}
