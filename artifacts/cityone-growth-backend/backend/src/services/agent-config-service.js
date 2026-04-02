import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "agent-config.json");
const INTENTS_FILE = path.join(DATA_DIR, "agent-intents.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  enabled: true,
  welcome_messages: {
    zh: "你好，我是 CityOne AI 助理，有什么我可以帮你的吗？",
    th: "สวัสดี ฉันคือ CityOne AI Assistant มีอะไรให้ช่วยไหม?",
    en: "Hi, I'm CityOne AI Assistant. How can I help you today?"
  },
  identity_rules: {
    guest_unfollowed: ["borrow_help", "return_help", "invite_help", "points_redeem_help"],
    oa_fan: [
      "borrow_help", "return_help", "invite_help", "points_redeem_help",
      "nearby_sites_query", "benefit_claim_query", "invite_poster_generate"
    ],
    identified_user: [
      "borrow_help", "return_help", "invite_help", "points_redeem_help",
      "nearby_sites_query", "benefit_claim_query", "invite_poster_generate",
      "coupon_list_query", "coupon_recommend", "recent_orders_query", "points_balance_query"
    ],
    member: [
      "borrow_help", "return_help", "invite_help", "points_redeem_help",
      "nearby_sites_query", "benefit_claim_query", "invite_poster_generate",
      "coupon_list_query", "coupon_recommend", "recent_orders_query", "points_balance_query",
      "after_sale_apply", "member_rights_query"
    ]
  },
  tool_switches: {
    "tool-nearby-sites": true,
    "tool-coupon-list": true,
    "tool-coupon-recommend": true,
    "tool-claim-benefits": true,
    "tool-invite-poster": true,
    "tool-order-query": true,
    "tool-points-query": true,
    "tool-member-rights": false,
    "tool-after-sale": false,
    "tool-activity-query": true
  },
  quick_prompts: {
    zh: [
      "帮我找附近站点",
      "帮我看看有哪些券能用",
      "积分怎么兑换？",
      "如何邀请好友？"
    ],
    th: [
      "ช่วยหาสถานีใกล้เคียง",
      "ดูคูปองที่ใช้ได้",
      "แลกคะแนนอย่างไร?",
      "เชิญเพื่อนอย่างไร?"
    ],
    en: [
      "Find nearby stations",
      "Check my available coupons",
      "How to redeem points?",
      "How to invite friends?"
    ]
  },
  updated_at: new Date().toISOString()
};

const DEFAULT_INTENTS = [
  {
    intent_code: "greeting",
    intent_name: "问候 / 打招呼",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["在吗", "你好", "嗨", "hi", "hello", "你在吗", "有人吗", "帮我", "请问", "问一下", "你好啊", "早", "晚上好"],
      th: ["สวัสดี", "หวัดดี", "อยู่ไหม", "มีคนอยู่ไหม", "ช่วยได้ไหม"],
      en: ["hello", "hi", "hey", "are you there", "anyone there", "help me", "can you help"]
    }
  },
  {
    intent_code: "nearby_sites_query",
    intent_name: "查附近站点",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["附近站点", "最近的站点", "在哪里借", "附近哪里有", "离我最近", "找站点", "周边站点"],
      th: ["สถานีใกล้เคียง", "ยืมที่ไหน", "ใกล้ๆ นี้", "หาสถานี"],
      en: ["nearby station", "nearest station", "where to borrow", "find station", "close station"]
    }
  },
  {
    intent_code: "borrow_help",
    intent_name: "借电流程说明",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["怎么借", "如何借", "借电流程", "借宝贝", "借充电宝", "扫码借", "开始借"],
      th: ["ยืมอย่างไร", "วิธียืม", "ขั้นตอนการยืม"],
      en: ["how to borrow", "borrow process", "start borrowing", "how do I borrow"]
    }
  },
  {
    intent_code: "return_help",
    intent_name: "还电流程说明",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["怎么还", "如何还", "还电流程", "还充电宝", "还宝贝", "归还", "还回去"],
      th: ["คืนอย่างไร", "วิธีคืน", "ขั้นตอนการคืน"],
      en: ["how to return", "return process", "return powerbank", "how do I return"]
    }
  },
  {
    intent_code: "coupon_list_query",
    intent_name: "查我的可用券",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["我的券", "有哪些券", "可用的券", "我的优惠", "查看券", "我的卡券", "券包"],
      th: ["คูปองของฉัน", "คูปองที่ใช้ได้", "ดูคูปอง"],
      en: ["my coupons", "available coupon", "check my coupon", "what coupon do I have"]
    }
  },
  {
    intent_code: "coupon_recommend",
    intent_name: "推荐最优券",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["最划算的券", "推荐券", "用哪张券", "最好的券", "最优惠", "哪个券最值"],
      th: ["คูปองที่คุ้มที่สุด", "แนะนำคูปอง", "ใช้คูปองอะไร"],
      en: ["best coupon", "recommend coupon", "which coupon", "most discount"]
    }
  },
  {
    intent_code: "benefit_claim_query",
    intent_name: "查可领取的福利",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["能领什么", "有什么福利", "可以领取", "福利", "领奖励", "我能领什么", "有哪些奖励"],
      th: ["รับสิทธิประโยชน์", "สิทธิ์ที่ได้รับ", "รับรางวัล"],
      en: ["what benefits", "claim reward", "available reward", "what can I get"]
    }
  },
  {
    intent_code: "points_balance_query",
    intent_name: "查积分",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["积分", "我的积分", "有多少积分", "积分余额", "查积分"],
      th: ["คะแนนของฉัน", "ตรวจสอบคะแนน", "คะแนนสะสม"],
      en: ["my points", "check points", "how many points", "points balance"]
    }
  },
  {
    intent_code: "points_redeem_help",
    intent_name: "积分兑换说明",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["积分怎么用", "积分兑换", "积分换什么", "怎么兑换", "用积分换"],
      th: ["แลกคะแนน", "วิธีแลกคะแนน", "ใช้คะแนนอย่างไร"],
      en: ["redeem points", "how to redeem", "exchange points", "use my points"]
    }
  },
  {
    intent_code: "invite_help",
    intent_name: "邀请说明",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["邀请好友", "邀请朋友", "如何邀请", "推荐好友", "拉人"],
      th: ["เชิญเพื่อน", "วิธีเชิญ", "แนะนำเพื่อน"],
      en: ["invite friend", "how to invite", "refer a friend", "referral"]
    }
  },
  {
    intent_code: "invite_poster_generate",
    intent_name: "生成邀请海报",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["生成海报", "邀请海报", "分享海报", "生成链接", "我的邀请链接", "邀请二维码"],
      th: ["สร้างโปสเตอร์", "โปสเตอร์เชิญ", "ลิงก์เชิญ"],
      en: ["invite poster", "generate poster", "invite link", "my referral link"]
    }
  },
  {
    intent_code: "recent_orders_query",
    intent_name: "查最近订单",
    enabled: true,
    need_confirm: false,
    phrases: {
      zh: ["最近订单", "我的订单", "借电记录", "消费记录", "历史订单", "查订单"],
      th: ["คำสั่งซื้อล่าสุด", "ประวัติการยืม", "ดูออเดอร์"],
      en: ["recent order", "my order", "borrow history", "order history"]
    }
  },
  {
    intent_code: "after_sale_apply",
    intent_name: "发起售后",
    enabled: true,
    need_confirm: true,
    phrases: {
      zh: ["售后", "投诉", "问题反馈", "设备故障", "无法归还", "卡住了", "出了问题", "帮帮我"],
      th: ["บริการหลังการขาย", "ร้องเรียน", "ปัญหา", "คืนไม่ได้"],
      en: ["after sale", "complaint", "problem", "device issue", "cannot return", "stuck"]
    }
  }
];

export function loadAgentConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    return DEFAULT_CONFIG;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAgentConfig(data) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...data, updated_at: new Date().toISOString() }, null, 2), "utf-8");
}

export function loadAgentIntents() {
  ensureDataDir();
  if (!fs.existsSync(INTENTS_FILE)) {
    fs.writeFileSync(INTENTS_FILE, JSON.stringify(DEFAULT_INTENTS, null, 2), "utf-8");
    return DEFAULT_INTENTS;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(INTENTS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : DEFAULT_INTENTS;
  } catch {
    return DEFAULT_INTENTS;
  }
}

export function saveAgentIntents(data) {
  ensureDataDir();
  fs.writeFileSync(INTENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}
