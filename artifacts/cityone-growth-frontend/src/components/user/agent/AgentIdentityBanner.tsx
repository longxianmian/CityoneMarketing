import React from 'react'

interface Props {
  tier: string | null
  capabilities: string[]
  lang: 'zh' | 'th' | 'en'
}

const TIER_CONFIG: Record<string, { icon: string; color: string; labelZh: string; labelTh: string; labelEn: string }> = {
  guest: { icon: '👤', color: '#A0A7B3', labelZh: '访客', labelTh: 'ผู้เยี่ยมชม', labelEn: 'Guest' },
  fan: { icon: '⭐', color: '#2CDBCE', labelZh: 'OA 粉丝', labelTh: 'แฟน OA', labelEn: 'OA Fan' },
  user: { icon: '🔵', color: '#2F80FF', labelZh: '已认证用户', labelTh: 'ผู้ใช้ที่ยืนยันแล้ว', labelEn: 'Verified User' },
  member: { icon: '💎', color: '#7B61FF', labelZh: '会员', labelTh: 'สมาชิก', labelEn: 'Member' },
}

const CAPABILITY_LABELS: Record<string, Record<'zh' | 'th' | 'en', string>> = {
  borrow: { zh: '借还充电宝', th: 'ยืม/คืน', en: 'Power Bank' },
  borrow_help: { zh: '借还充电宝', th: 'ยืม/คืน', en: 'Power Bank' },
  return_help: { zh: '归还充电宝', th: 'คืน', en: 'Return' },
  coupon: { zh: '卡券查询', th: 'คูปอง', en: 'Coupons' },
  coupon_list_query: { zh: '卡券查询', th: 'คูปอง', en: 'Coupons' },
  coupon_recommend: { zh: '领取卡券', th: 'รับคูปอง', en: 'Get Coupons' },
  points: { zh: '积分兑换', th: 'คะแนน', en: 'Points' },
  points_redeem_help: { zh: '积分兑换', th: 'แลกคะแนน', en: 'Redeem Points' },
  points_balance_query: { zh: '积分查询', th: 'ดูคะแนน', en: 'Check Points' },
  invite: { zh: '分享福利', th: 'แชร์สิทธิ์', en: 'Share Benefits' },
  invite_help: { zh: '分享给好友', th: 'แชร์ให้เพื่อน', en: 'Share with Friends' },
  invite_poster_generate: { zh: '分享福利', th: 'แชร์สิทธิ์พิเศษ', en: 'Share Benefits' },
  order: { zh: '订单查询', th: 'คำสั่งซื้อ', en: 'Orders' },
  recent_orders_query: { zh: '订单查询', th: 'ดูคำสั่งซื้อ', en: 'My Orders' },
  after_sale_apply: { zh: '售后申请', th: 'บริการหลังขาย', en: 'After-sales' },
  activity: { zh: '活动参与', th: 'กิจกรรม', en: 'Activities' },
  nearby_sites_query: { zh: '附近站点', th: 'สถานีใกล้เคียง', en: 'Nearby Stations' },
  benefit_claim_query: { zh: '福利领取', th: 'รับสิทธิ์', en: 'Benefits' },
}

const HINT: Record<'zh' | 'th' | 'en', Record<string, string>> = {
  zh: {
    guest: '关注 LINE OA 后可解锁更多能力',
    fan: '完成首次借用可解锁更多能力',
    user: '成为会员可解锁全部能力',
    member: '您已解锁全部问问能力',
  },
  th: {
    guest: 'ติดตาม LINE OA เพื่อปลดล็อกความสามารถเพิ่มเติม',
    fan: 'ยืมครั้งแรกเพื่อปลดล็อกความสามารถเพิ่มเติม',
    user: 'เป็นสมาชิกเพื่อปลดล็อกทุกความสามารถ',
    member: 'คุณปลดล็อกความสามารถทั้งหมดแล้ว',
  },
  en: {
    guest: 'Follow LINE OA to unlock more capabilities',
    fan: 'Complete first borrow to unlock more',
    user: 'Become a member to unlock all capabilities',
    member: 'You have unlocked all AI Agent capabilities',
  },
}

export default function AgentIdentityBanner({ tier, capabilities, lang }: Props) {
  const safeTier = tier && TIER_CONFIG[tier] ? tier : 'guest'
  const cfg = TIER_CONFIG[safeTier]
  const label = lang === 'th' ? cfg.labelTh : lang === 'en' ? cfg.labelEn : cfg.labelZh
  const hint = HINT[lang]?.[safeTier] || ''

  return (
    <div
      style={{
        margin: '0 16px 12px',
        background: '#fff',
        borderRadius: 14,
        border: `1.5px solid ${cfg.color}33`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{label}</span>
          {hint && <span style={{ fontSize: 11, color: '#A0A7B3' }}>· {hint}</span>}
        </div>
        {capabilities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {capabilities.map((cap) => {
              const capLabel = CAPABILITY_LABELS[cap]?.[lang] || cap
              return (
                <span
                  key={cap}
                  style={{
                    fontSize: 11, color: cfg.color,
                    background: cfg.color + '18',
                    borderRadius: 999, padding: '2px 8px', fontWeight: 600,
                  }}
                >
                  {capLabel}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
