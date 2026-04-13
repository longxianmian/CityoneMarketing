import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SendOutlined, UserOutlined, PlusOutlined, SmileOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import useAgentStore, { AgentMessage, AgentCard } from '../../store/agent'
import UserPageHeader from '../../components/user/UserPageHeader'
import AgentMessageList from '../../components/user/agent/AgentMessageList'
import AgentIdentityBanner from '../../components/user/agent/AgentIdentityBanner'
import { initAgentSession, sendAgentMessage, confirmAgentAction, getAgentSessionLatest } from '../../api/agent'

type Lang = 'zh' | 'th' | 'en'

function nowISO() { return new Date().toISOString() }
function uid() { return Date.now().toString() + Math.random().toString(36).slice(2, 7) }

const WELCOME: Record<Lang, string> = {
  zh: '你好！我是小城 👋\n有什么可以帮你的？可以直接提问，或从下方选择常见问题。',
  th: 'สวัสดี! ฉันคือ小城 👋\nมีอะไรให้ช่วยไหม? พิมพ์ถามได้เลย หรือเลือกจากคำถามด้านล่าง',
  en: "Hi! I'm 小城 👋\nHow can I help you? Ask me anything, or pick a common question below.",
}

const QUICK_PROMPTS: Record<Lang, string[]> = {
  zh: ['怎么借充电宝？', '有什么卡券可以用？', '积分怎么兑换？', '分享福利给好友？'],
  th: ['ยืมพาวเวอร์แบงก์ยังไง?', 'ใช้คูปองอะไรได้บ้าง?', 'แลกคะแนนยังไง?', 'แชร์สิทธิ์ให้เพื่อนยังไง?'],
  en: ['How to borrow power bank?', 'What coupons can I use?', 'How to redeem points?', 'Share benefits with friends?'],
}

// ─── Intent → Action Card (frontend augments backend text reply with action card) ─

type IntentCardFn = (lang: Lang) => AgentCard

const INTENT_ACTION_CARDS: Record<string, IntentCardFn> = {
  points_redeem_help: (l) => ({
    type: 'benefit',
    title: { zh: '🌟 前往积分兑换中心', th: '🌟 ไปศูนย์แลกคะแนน', en: '🌟 Go to Points Redemption' }[l],
    subtitle: { zh: '选择礼品或优惠券，用积分直接兑换', th: 'เลือกของรางวัลหรือคูปอง แลกด้วยคะแนนได้เลย', en: 'Choose gifts or coupons and redeem with your points' }[l],
    ctaPrimary: { text: { zh: '立即去兑换 →', th: 'แลกเลย →', en: 'Redeem Now →' }[l], route: '/my-points' },
  }),
  points_balance_query: (l) => ({
    type: 'benefit',
    title: { zh: '⭐ 查看积分余额', th: '⭐ ดูยอดคะแนน', en: '⭐ View Points Balance' }[l],
    subtitle: { zh: '查看当前积分余额、获取记录和兑换商品', th: 'ดูยอดคะแนน ประวัติ และสินค้าที่แลกได้', en: 'Check balance, history and redeemable items' }[l],
    ctaPrimary: { text: { zh: '查看积分 →', th: 'ดูคะแนน →', en: 'View Points →' }[l], route: '/my-points' },
  }),
  coupon_list_query: (l) => ({
    type: 'coupon',
    title: { zh: '🎟️ 查看我的卡券', th: '🎟️ ดูคูปองของฉัน', en: '🎟️ View My Coupons' }[l],
    subtitle: { zh: '查看所有可用优惠券，选一张最适合的', th: 'ดูคูปองที่ใช้ได้ทั้งหมด เลือกที่เหมาะสุด', en: 'View all available coupons and pick the best one' }[l],
    ctaPrimary: { text: { zh: '查看卡券 →', th: 'ดูคูปอง →', en: 'View Coupons →' }[l], route: '/my-coupons' },
  }),
  coupon_recommend: (l) => ({
    type: 'coupon',
    title: { zh: '🎟️ 领取优惠券', th: '🎟️ รับคูปอง', en: '🎟️ Get Coupons' }[l],
    subtitle: { zh: '前往福利中心领取最新优惠券', th: 'ไปที่ศูนย์สิทธิ์เพื่อรับคูปองล่าสุด', en: 'Go to welfare center for the latest coupons' }[l],
    ctaPrimary: { text: { zh: '去领券 →', th: 'รับคูปอง →', en: 'Get Coupons →' }[l], route: '/welfare' },
  }),
  benefit_claim_query: (l) => ({
    type: 'benefit',
    title: { zh: '🎁 福利中心', th: '🎁 ศูนย์สิทธิประโยชน์', en: '🎁 Welfare Center' }[l],
    subtitle: { zh: '查看所有可领取福利、限时活动和专属奖励', th: 'ดูสิทธิ์ทั้งหมด กิจกรรมจำกัดเวลา และรางวัลพิเศษ', en: 'View all benefits, limited activities and exclusive rewards' }[l],
    ctaPrimary: { text: { zh: '去福利中心 →', th: 'ไปศูนย์สิทธิ์ →', en: 'Go to Welfare →' }[l], route: '/welfare' },
  }),
  nearby_sites_query: (l) => ({
    type: 'site',
    title: { zh: '📍 查看附近站点地图', th: '📍 ดูแผนที่สถานีใกล้เคียง', en: '📍 View Nearby Station Map' }[l],
    subtitle: { zh: '实时显示附近可借还充电宝的全部站点', th: 'แสดงสถานียืม/คืนพาวเวอร์แบงก์ใกล้คุณแบบเรียลไทม์', en: 'Real-time map of all nearby power bank stations' }[l],
    ctaPrimary: { text: { zh: '打开地图 →', th: 'เปิดแผนที่ →', en: 'Open Map →' }[l], route: '/nearby' },
  }),
  borrow_help: (l) => ({
    type: 'site',
    title: { zh: '⚡ 借充电宝', th: '⚡ ยืมพาวเวอร์แบงก์', en: '⚡ Borrow Power Bank' }[l],
    subtitle: { zh: '找到附近站点，扫码即借，简单快捷', th: 'หาสถานีใกล้เคียง สแกนโค้ดยืมได้เลย รวดเร็ว', en: 'Find nearby station, scan to borrow — fast and easy' }[l],
    ctaPrimary: { text: { zh: '找附近站点 →', th: 'หาสถานี →', en: 'Find Station →' }[l], route: '/nearby' },
  }),
  return_help: (l) => ({
    type: 'site',
    title: { zh: '🔄 归还充电宝', th: '🔄 คืนพาวเวอร์แบงก์', en: '🔄 Return Power Bank' }[l],
    subtitle: { zh: '找到离你最近的可归还站点，轻松完成归还', th: 'หาสถานีคืนที่ใกล้ที่สุด คืนได้ง่าย', en: 'Find the nearest return station and return easily' }[l],
    ctaPrimary: { text: { zh: '找归还站点 →', th: 'หาสถานีคืน →', en: 'Find Return Station →' }[l], route: '/nearby' },
  }),
  invite_help: (l) => ({
    type: 'invite',
    title: { zh: '📢 把活动/卡券分享给好友赚积分', th: '📢 แชร์กิจกรรม/คูปองให้เพื่อนรับคะแนน', en: '📢 Share Activities or Coupons — Earn Points Together' }[l],
    subtitle: { zh: '把你喜欢的活动或优惠券分享给好友，好友参与后双方都获得积分奖励，比直接邀请转化率更高！', th: 'แชร์กิจกรรมหรือคูปองที่ชอบให้เพื่อน เพื่อนเข้าร่วมแล้วทั้งคู่ได้คะแนน', en: 'Share an activity or coupon you like — when friends join, both of you earn points!' }[l],
    ctaPrimary: { text: { zh: '去挑一个活动分享 →', th: 'เลือกกิจกรรมแชร์ →', en: 'Pick an Activity to Share →' }[l], route: '/welfare' },
    ctaSecondary: { text: { zh: '分享我的卡券 →', th: 'แชร์คูปองของฉัน →', en: 'Share My Coupons →' }[l], route: '/my-coupons' },
  }),
  invite_poster_generate: (l) => ({
    type: 'invite',
    title: { zh: '🎁 分享限时福利给好友', th: '🎁 แชร์สิทธิ์พิเศษให้เพื่อน', en: '🎁 Share Exclusive Benefits with Friends' }[l],
    subtitle: { zh: '选一个好友会喜欢的活动或卡券，分享出去后好友领取即可为你积累积分', th: 'เลือกกิจกรรมหรือคูปองที่เพื่อนจะชอบ แชร์แล้วเพื่อนรับก็ได้คะแนนให้คุณ', en: 'Pick something your friend will love — share it and earn points when they claim it' }[l],
    ctaPrimary: { text: { zh: '浏览全部福利 →', th: 'ดูสิทธิ์ทั้งหมด →', en: 'Browse All Benefits →' }[l], route: '/welfare' },
    ctaSecondary: { text: { zh: '查看我的卡券 →', th: 'ดูคูปองของฉัน →', en: 'View My Coupons →' }[l], route: '/my-coupons' },
  }),
  growth_saving_intent: (l) => ({
    type: 'invite',
    title: { zh: '💰 分享内容给好友赚积分', th: '💰 แชร์เนื้อหาให้เพื่อนได้คะแนน', en: '💰 Share Content & Earn Points' }[l],
    subtitle: { zh: '挑一个活动或卡券分享出去，好友看到优惠，你也攒到积分兑奖励，双赢！', th: 'เลือกกิจกรรมหรือคูปองแชร์ให้เพื่อน เพื่อนได้โปร คุณได้คะแนน ได้ทั้งคู่!', en: 'Pick an activity or coupon to share — your friends see the deal, you earn points. Win-win!' }[l],
    ctaPrimary: { text: { zh: '去挑内容分享 →', th: 'เลือกเนื้อหาแชร์ →', en: 'Pick Content to Share →' }[l], route: '/welfare' },
    ctaSecondary: { text: { zh: '分享我的卡券 →', th: 'แชร์คูปองของฉัน →', en: 'Share My Coupons →' }[l], route: '/my-coupons' },
  }),
  recent_orders_query: (l) => ({
    type: 'order',
    title: { zh: '📦 查看我的订单', th: '📦 ดูคำสั่งซื้อของฉัน', en: '📦 View My Orders' }[l],
    subtitle: { zh: '查看所有借用记录、费用明细和使用时长', th: 'ดูประวัติการยืม ค่าใช้จ่าย และระยะเวลาทั้งหมด', en: 'View all rental records, costs and durations' }[l],
    ctaPrimary: { text: { zh: '查看订单 →', th: 'ดูคำสั่งซื้อ →', en: 'View Orders →' }[l], route: '/mine' },
  }),
  after_sale_apply: (l) => ({
    type: 'order',
    title: { zh: '💬 联系客服处理', th: '💬 ติดต่อฝ่ายบริการ', en: '💬 Contact Support' }[l],
    subtitle: { zh: '提交问题说明，客服会在 30 分钟内跟进', th: 'ส่งรายละเอียดปัญหา ทีมงานตอบกลับภายใน 30 นาที', en: 'Submit your issue — support responds within 30 minutes' }[l],
    ctaPrimary: { text: { zh: '联系客服 →', th: 'ติดต่อ →', en: 'Contact Now →' }[l], route: '/welfare' },
  }),
}

function makeGuestUnlockCard(lang: Lang): AgentCard {
  return {
    type: 'benefit',
    title: { zh: '🔓 关注 LINE OA 解锁完整 Agent 功能', th: '🔓 ติดตาม LINE OA เพื่อปลดล็อคฟีเจอร์ Agent', en: '🔓 Follow LINE OA to Unlock Full Agent Features' }[lang],
    subtitle: { zh: '关注后可查询卡券、积分余额、历史订单，Agent 可直接帮你执行操作', th: 'หลังติดตาม ดูคูปอง คะแนน คำสั่งซื้อ และให้ Agent ดำเนินการแทนได้', en: 'Follow to check coupons, points, orders — and let Agent act on your behalf' }[lang],
    badge: { zh: '免费关注', th: 'ติดตามฟรี', en: 'Free' }[lang],
    ctaPrimary: { text: { zh: '立即关注 →', th: 'ติดตามเลย →', en: 'Follow Now →' }[lang], route: '/welfare' },
  }
}

function makeText(id: string, text: string): AgentMessage {
  return { id, role: 'ai', type: 'text', text, createdAt: nowISO() }
}

// ─── Backend message type → frontend AgentMessageType ─────────────────────────
function mapBackendType(t: string): AgentMessage['type'] {
  if (t === 'welcome' || t === 'text') return 'text'
  if (t === 'tool_result' || t === 'tool_card') return 'tool_card'
  if (t === 'confirm_request') return 'confirm_card'
  return 'text'
}

// ─── Convert backend AgentBackendMessage → frontend AgentMessage ──────────────
// Supports both restored history messages and new reply messages from backend.
function normalizeMessage(backendMsg: any): AgentMessage {
  const payload = backendMsg.payload || {}
  const rawCards: any[] = Array.isArray(payload.cards) ? payload.cards : []

  const cards: AgentCard[] = rawCards.map((c: any) => ({
    type: (c.card_type || 'benefit') as AgentCard['type'],
    title: c.title || '',
    subtitle: c.desc || c.subtitle || '',
    badge: c.badge,
    meta: c.meta,
    coverImage: c.cover_image || '',
    ctaPrimary: c.action_text
      ? { text: c.action_text, action: c.action_type, route: c.route || c.action_url }
      : undefined,
  }))

  const suggestions: string[] = Array.isArray(payload.suggestions) ? payload.suggestions : []

  return {
    id: backendMsg.message_id || uid(),
    role: backendMsg.role === 'user' ? 'user' : 'ai',
    type: mapBackendType(backendMsg.type || 'text'),
    text: backendMsg.text || payload.text || '',
    cards,
    suggestions,
    createdAt: backendMsg.created_at || nowISO(),
  }
}

// ─── Frontend intent fallback (keyword-based, used when backend returns intent_unknown) ──
// Backend handles real NLU; this only selects which action card to show when backend can't.

function detectFrontendIntent(text: string): string {
  const t = text.toLowerCase()
  if (/划算|便宜|免费|省钱|打折|折扣|省一点|更便宜|free|cheaper|discount|save money|any deal|คุ้ม|ถูกกว่า|ฟรีไหม|ส่วนลด/.test(t)) return 'growth_saving_intent'
  if (/券|优惠|有活动|coupon|voucher|promo|offer|คูปอง|โปรโมชัน/.test(t)) return 'coupon_list_query'
  if (/积分|兑换|point|redeem|คะแนน|แลก/.test(t)) return 'points_redeem_help'
  if (/邀请|好友|推荐|分享.*福利|分享.*活动|分享.*卡券|invite|refer|share.*benefit|ชวน|เชิญ|แชร์/.test(t)) return 'invite_help'
  if (/海报|poster/.test(t)) return 'invite_poster_generate'
  if (/借|borrow|ยืม/.test(t)) return 'borrow_help'
  if (/还|归还|return|คืน/.test(t)) return 'return_help'
  if (/站点|地图|附近|station|map|nearby|สถานี|แผนที่|ใกล้/.test(t)) return 'nearby_sites_query'
  if (/订单|记录|历史|order|history|คำสั่งซื้อ|ประวัติ/.test(t)) return 'recent_orders_query'
  if (/福利|benefit|welfare|สิทธิ/.test(t)) return 'benefit_claim_query'
  if (/售后|退款|投诉|refund|complaint|คืนเงิน|ร้องเรียน/.test(t)) return 'after_sale_apply'
  return ''
}

// ─── Page constants ────────────────────────────────────────────────────────────

const TITLE_MAP: Record<Lang, string> = { zh: '问问', th: 'ถามดู', en: 'Ask' }
const PLACEHOLDER_MAP: Record<Lang, string> = { zh: '输入你的问题…', th: 'พิมพ์คำถาม…', en: 'Type your question…' }
const EMOJI_LIST = [
  '😊','😂','🤣','❤️','😍','🙏','😭','😘','🥰','😅',
  '🤔','😁','👍','🎉','🔥','💯','✅','⭐','💪','🤝',
  '😎','🥳','🤩','😜','🤗','😇','🥺','😢','😤','🫡',
  '🍜','🧋','☕','🍰','🎂','🏆','💰','💎','📱','💻',
  '🚀','💡','🎯','📦','🛵','⚡','🔋','🗺️','📍','🎁',
]

// ─── Page component ────────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const { profile } = useLineUserStore()
  const lang = (['zh', 'th', 'en'].includes(language) ? language : 'zh') as Lang

  const {
    sessionId, identityTier, capabilities, messages, quickPrompts, isThinking,
    setSessionId, setIdentityTier, setCapabilities, addMessage,
    setMessages, setQuickPrompts, setThinking, setPendingConfirmAction,
  } = useAgentStore()

  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  // 是否为恢复场景，用于展示"↩ 已恢复上次对话"提示
  const [restored, setRestored] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    if (showEmoji) {
      const close = (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest('[data-emoji-area]')) setShowEmoji(false)
      }
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [showEmoji])

  // ─── 兜底恢复：本地无 sessionId 时通过 /latest 接口恢复 ───────────────
  const recoverFromLatest = async (lineUserId: string): Promise<boolean> => {
    try {
      const res = await getAgentSessionLatest(lineUserId)
      const data = res.data?.data || res.data || {}
      if (data.session?.session_id) {
        setSessionId(data.session.session_id)
        const msgs: any[] = Array.isArray(data.messages) ? data.messages : []
        if (msgs.length > 0) {
          setMessages(msgs.map(normalizeMessage))
          setRestored(true)
          return true
        }
      }
    } catch {}
    return false
  }

  // ─── 每次进入页面都调用 session/init，由后端决定恢复还是新建 ─────────────
  // 文档要求：不在前端判断 sessionId 是否存在，直接调 init，后端处理恢复逻辑
  useEffect(() => {
    setThinking(false)
    setPendingConfirmAction(null)

    const doInit = async () => {
      try {
        const lineUserId = profile?.lineUserId || 'admin_test'
        const res = await initAgentSession({ line_user_id: lineUserId, language: lang })
        const data = res.data?.data || res.data || {}

        const sid: string = data.session_id || data.sessionId || ''
        const isRestored: boolean = !!data.restored
        const backendMessages: any[] = Array.isArray(data.messages) ? data.messages : []

        // Dev override: 让所有功能可测试
        const tier = 'member'
        const allCaps = Object.keys(INTENT_ACTION_CARDS)
        const prompts: string[] = data.quick_prompts || QUICK_PROMPTS[lang]

        if (sid) setSessionId(sid)
        setIdentityTier(tier)
        setCapabilities(allCaps)
        setQuickPrompts(prompts)

        if (backendMessages.length > 0) {
          // 后端返回了消息（含历史消息或新会话欢迎消息），直接渲染
          setMessages(backendMessages.map(normalizeMessage))
          setRestored(isRestored)
        } else {
          // 后端没有返回消息时，用本地欢迎语兜底
          const welcomeText: string = data.welcome_message || WELCOME[lang]
          setMessages([{ id: 'welcome', role: 'ai', type: 'text', text: welcomeText, createdAt: nowISO() }])
          setRestored(false)
        }
      } catch {
        // init 失败：尝试 /latest 兜底恢复
        setIdentityTier('member')
        setCapabilities(Object.keys(INTENT_ACTION_CARDS))
        setQuickPrompts(QUICK_PROMPTS[lang])
        const lineUserId = profile?.lineUserId || 'admin_test'
        const recovered = await recoverFromLatest(lineUserId)
        if (!recovered) {
          setMessages([{ id: 'welcome', role: 'ai', type: 'text', text: WELCOME[lang], createdAt: nowISO() }])
          setRestored(false)
        }
      }
    }
    doInit()
  }, [])

  // ─ Build displayable AgentMessages from backend response data ─────────────
  const buildAIMessages = useCallback((responseData: any, userText = ''): AgentMessage[] => {
    if (!responseData) return []

    const reply = responseData.reply
    const intent = responseData.intent || {}
    const backendCode: string = intent.code || ''
    // Use store tier (which may be overridden for admin testing), not backend message tier
    const tier: string = identityTier || responseData.identity_tier || ''
    const policy: string = responseData.policy_result || 'allowed'

    // Effective intent: backend code if recognized, otherwise detect from user's message text
    const isUnknown = !backendCode || backendCode === 'unknown' || backendCode === 'intent_unknown'
    const intentCode = isUnknown ? detectFrontendIntent(userText) : backendCode

    if (!reply) {
      const text = responseData.text || responseData.message
      if (text) return [makeText(uid(), text)]
      return []
    }

    const msgs: AgentMessage[] = []

    // 1. AI text reply (LLM-generated)
    if (reply.text) {
      msgs.push(makeText(uid(), reply.text))
    }

    // 2. Tool result cards from backend (when backend has tools connected)
    if (Array.isArray(reply.cards) && reply.cards.length > 0) {
      msgs.push({ id: uid(), role: 'ai', type: 'tool_card', cards: reply.cards, createdAt: nowISO() })
    }

    // 3. Intent-based action card — always try to push a relevant card.
    //    Backend code used first; if unknown, falls back to frontend keyword detection.
    //    This ensures guests always get an actionable card even without LLM tool access.
    if (intentCode && intentCode !== 'greeting') {
      const cardFn = INTENT_ACTION_CARDS[intentCode]
      if (cardFn) {
        msgs.push({ id: uid(), role: 'ai', type: 'tool_card', cards: [cardFn(lang)], createdAt: nowISO() })
      }
    }

    // 4. Confirm card — Agent needs user approval before executing action
    //    Normalize snake_case keys from backend (action_code → actionCode, etc.)
    //    Fall back to intentCode if confirm_action fields are all empty
    if (reply.reply_type === 'confirm_required') {
      const ca = reply.confirm_action || {}
      const resolvedCode = ca.actionCode || ca.action_code || ca.intent_code || intentCode || ''
      msgs.push({
        id: uid(), role: 'ai', type: 'confirm_card',
        confirmAction: {
          actionCode: resolvedCode,
          actionText: ca.actionText || ca.action_text || ca.description || ca.text || ca.message || '',
          confirmText: ca.confirmText || ca.confirm_text || '',
        },
        createdAt: nowISO(),
      })
    }

    // 5. Guest unlock card — shown when blocked or intent still unknown after fallback
    //    Tells user what they'll unlock by following LINE OA
    if (
      tier === 'guest_unfollowed' &&
      (reply.reply_type === 'intent_unknown' || policy.startsWith('blocked'))
    ) {
      msgs.push({
        id: uid(), role: 'ai', type: 'tool_card',
        cards: [makeGuestUnlockCard(lang)],
        createdAt: nowISO(),
      })
    }

    // 6. Suggestion chips
    if (Array.isArray(reply.suggestions) && reply.suggestions.length > 0) {
      msgs.push({ id: uid(), role: 'ai', type: 'suggestions', suggestions: reply.suggestions, createdAt: nowISO() })
    }

    if (msgs.length === 0) {
      msgs.push(makeText(uid(), '✅'))
    }

    return msgs
  }, [lang, identityTier])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isThinking) return
    addMessage({ id: uid(), role: 'user', type: 'text', text: text.trim(), createdAt: nowISO() })
    setInput('')
    setThinking(true)

    try {
      if (sessionId) {
        const res = await sendAgentMessage(sessionId, { text: text.trim(), language: lang })
        const data = res.data?.data || res.data
        buildAIMessages(data, text.trim()).forEach((m) => addMessage(m))
      } else {
        addMessage(makeText(uid(), {
          zh: '⚠️ 小城暂时离线，请稍后再试。',
          th: '⚠️ 小城ออฟไลน์ชั่วคราว กรุณาลองใหม่',
          en: '⚠️ 小城 is temporarily offline. Please try again later.',
        }[lang]))
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const isTimeout = code === 'ECONNABORTED' || code === 'ERR_NETWORK' ||
        String((err as { message?: string })?.message).toLowerCase().includes('timeout')
      addMessage(makeText(uid(), isTimeout ? {
        zh: '问问正在思考中，响应时间较长，请稍后重试。',
        th: 'ระบบกำลังประมวลผล กรุณาลองส่งใหม่อีกครั้ง',
        en: 'Response is taking longer than expected. Please try again.',
      }[lang] : {
        zh: '网络异常，请检查网络后重试。',
        th: 'เครือข่ายผิดปกติ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่',
        en: 'Network error. Please check your connection and retry.',
      }[lang]))
    } finally {
      setThinking(false)
    }
  }, [sessionId, isThinking, lang, addMessage, setThinking, setIdentityTier, buildAIMessages])

  const handleConfirm = useCallback(async (actionCode: string, confirm: boolean) => {
    setPendingConfirmAction(null)

    if (!confirm) {
      addMessage(makeText(uid(), { zh: '已取消操作。', th: 'ยกเลิกแล้ว', en: 'Action cancelled.' }[lang]))
      return
    }

    // If this intent has a known route, navigate directly — that IS the action
    const card = actionCode ? INTENT_ACTION_CARDS[actionCode]?.(lang) : null
    const route = card?.ctaPrimary?.route

    // Show executing feedback
    addMessage(makeText(uid(), { zh: '✅ 好的，正在为你跳转…', th: '✅ กำลังพาไป…', en: '✅ On it, navigating…' }[lang]))

    // Notify backend asynchronously (best-effort, don't block navigation)
    if (sessionId && actionCode) {
      confirmAgentAction(sessionId, { intent_code: actionCode, confirmed: true, language: lang }).catch(() => {})
    }

    if (route) {
      setTimeout(() => navigate(route), 500)
    }
  }, [sessionId, lang, addMessage, navigate, setPendingConfirmAction])

  function insertEmoji(emoji: string) {
    setInput((prev) => prev + emoji)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const src = ev.target?.result as string
      addMessage({ id: uid(), role: 'user', type: 'file_echo', text: isImage ? '' : `📄 ${file.name}`, image: isImage ? src : undefined, createdAt: nowISO() })
      setTimeout(() => {
        addMessage(makeText(uid(), {
          zh: '已收到文件！客服人员将尽快跟进处理。',
          th: 'ได้รับไฟล์แล้ว ทีมงานจะติดต่อกลับโดยเร็ว',
          en: 'File received! Our team will follow up shortly.',
        }[lang]))
      }, 600)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const prompts = quickPrompts.length > 0 ? quickPrompts : QUICK_PROMPTS[lang]
  const showInitialPrompts = messages.length <= 1 && !isThinking

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F7F9FC' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>

        <UserPageHeader
          title={TITLE_MAP[lang]}
          onBack={() => navigate('/welfare')}
          right={
            <div style={{ width: 34, height: 34, borderRadius: 999, overflow: 'hidden', marginRight: 6, flexShrink: 0, background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.linePictureUrl
                ? <img src={profile.linePictureUrl} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UserOutlined style={{ fontSize: 17, color: '#667085' }} />}
            </div>
          }
        />

        {identityTier && (
          <AgentIdentityBanner tier={identityTier} capabilities={capabilities} lang={lang} />
        )}

        {/* 恢复会话提示：返回聊天页时显示，让用户感知到历史对话已恢复 */}
        {restored && messages.length > 1 && (
          <div style={{
            margin: '0 16px 0',
            padding: '7px 14px',
            background: 'linear-gradient(90deg, #EAF9F7, #EBF3FF)',
            borderRadius: 10,
            fontSize: 12,
            color: '#2CDBCE',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14 }}>↩</span>
            {{ zh: '已恢复上次对话', th: 'กู้คืนการสนทนาครั้งก่อนแล้ว', en: 'Previous conversation restored' }[lang]}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
          <AgentMessageList
            messages={messages}
            isThinking={isThinking}
            userAvatar={profile?.linePictureUrl}
            lang={lang}
            onSuggestionClick={sendMessage}
            onConfirm={handleConfirm}
            onFollowOA={() => navigate('/welfare')}
          />

          {showInitialPrompts && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#A0A7B3', marginBottom: 8, paddingLeft: 46 }}>
                {{ zh: '常见问题快速提问', th: 'คำถามที่พบบ่อย', en: 'Common questions' }[lang]}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 46 }}>
                {prompts.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    style={{ border: '1px solid #E0E7F0', borderRadius: 12, padding: '9px 12px', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 600, textAlign: 'left', lineHeight: 1.4, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {showEmoji && (
          <div data-emoji-area=""
            style={{ background: '#fff', borderTop: '1px solid #ECF1F6', padding: '10px 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, flexShrink: 0 }}>
            {EMOJI_LIST.map((emoji) => (
              <button key={emoji} onClick={() => insertEmoji(emoji)}
                style={{ fontSize: 22, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 2px', borderRadius: 8 }}>{emoji}</button>
            ))}
          </div>
        )}

        <div style={{ padding: '10px 12px', background: '#fff', borderTop: showEmoji ? 'none' : '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder={PLACEHOLDER_MAP[lang]}
              style={{ width: '100%', border: '1.5px solid #E0E7F0', borderRadius: 999, padding: '10px 42px 10px 16px', fontSize: 14, outline: 'none', background: '#F7F9FC', color: '#111827', boxSizing: 'border-box' }}
            />
            <button data-emoji-area="" onClick={(e) => { e.stopPropagation(); setShowEmoji((v) => !v) }}
              style={{ position: 'absolute', right: 12, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <SmileOutlined style={{ fontSize: 20, color: showEmoji ? '#2CDBCE' : '#A0A7B3' }} />
            </button>
          </div>

          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: 42, height: 42, borderRadius: 999, border: '1.5px solid #E0E7F0', background: '#F7F9FC', color: '#667085', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PlusOutlined style={{ fontSize: 18 }} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleFileChange} />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
            style={{ width: 42, height: 42, borderRadius: 999, border: 'none', background: input.trim() && !isThinking ? 'linear-gradient(135deg, #2CDBCE, #2F80FF)' : '#E0E7F0', color: input.trim() && !isThinking ? '#fff' : '#A0A7B3', cursor: input.trim() && !isThinking ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
            <SendOutlined style={{ fontSize: 17 }} />
          </button>
        </div>

        <style>{`
          @keyframes agentBounce {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}
