import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RobotOutlined, MessageOutlined, ThunderboltOutlined, LockOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import UserBottomNav from '../../components/user/UserBottomNav'
import UserPageHeader from '../../components/user/UserPageHeader'
import { getAgentCapabilities } from '../../api/agent'

const INTRO: Record<string, string> = {
  zh: '有问题？问问小城，帮你快速完成充电宝借还、卡券查询、积分兑换等操作。',
  th: 'มีคำถาม? ถาม小城ช่วยยืมพาวเวอร์แบงก์ ตรวจสอบคูปอง และแลกคะแนนได้เลย',
  en: 'Got questions? Ask 小城 to quickly borrow power banks, check coupons, and redeem points.',
}

const CAN_HELP: Record<string, string> = {
  zh: '可以帮你做什么',
  th: 'ช่วยคุณทำอะไรได้บ้าง',
  en: 'What I can help with',
}

const ACTIONS: Record<string, { zh: string; th: string; en: string; icon: string; route?: string }[]> = {
  all: [
    { zh: '帮我找附近站点', th: 'ช่วยหาสถานีใกล้ฉัน', en: 'Find nearby stations', icon: '📍', route: '/nearby' },
    { zh: '查看可用卡券', th: 'ดูคูปองที่ใช้ได้', en: 'Check available coupons', icon: '🎟️', route: '/my-coupons' },
    { zh: '积分兑换', th: 'แลกคะแนน', en: 'Redeem points', icon: '⭐', route: '/my-points' },
    { zh: '分享福利给好友', th: 'แชร์สิทธิ์ให้เพื่อน', en: 'Share benefits with friends', icon: '📢' },
  ],
}

const TIER_LABELS: Record<string, Record<string, string>> = {
  guest:            { zh: '访客', th: 'ผู้เยี่ยมชม', en: 'Guest' },
  guest_unfollowed: { zh: '访客', th: 'ผู้เยี่ยมชม', en: 'Guest' },
  fan:              { zh: 'OA 粉丝', th: 'แฟน OA', en: 'OA Fan' },
  user:             { zh: '已认证用户', th: 'ผู้ใช้', en: 'User' },
  member:           { zh: '会员', th: 'สมาชิก', en: 'Member' },
}

const TIER_COLORS: Record<string, string> = {
  guest: '#A0A7B3', guest_unfollowed: '#A0A7B3',
  fan: '#2CDBCE', user: '#2F80FF', member: '#7B61FF',
}

const LOCKED_CAP: Record<string, string> = {
  zh: '关注 OA 后解锁', th: 'ปลดล็อกหลังติดตาม OA', en: 'Unlock after following OA',
}

const START: Record<string, string> = {
  zh: '开始问问', th: 'เริ่มถามดู', en: 'Start Asking',
}

const DEFAULT_TAGS: Record<string, string[]> = {
  zh: ['借还充电宝', '活动参与指引', '积分兑换', '卡券使用'],
  th: ['ยืม/คืน', 'กิจกรรม', 'แลกคะแนน', 'คูปอง'],
  en: ['Power Bank', 'Activities', 'Points', 'Coupons'],
}
const TAG_COLORS = ['#2CDBCE', '#7B61FF', '#FF7A59', '#2F80FF']

export default function AgentPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { profile } = useLineUserStore()
  const lang = (['zh', 'th', 'en'].includes(language) ? language : 'zh') as 'zh' | 'th' | 'en'

  const [tier, setTier] = useState<string | null>(null)
  const [caps, setCaps] = useState<string[]>([])
  const [loadingCaps, setLoadingCaps] = useState(false)

  useEffect(() => {
    const fetchCaps = async () => {
      setLoadingCaps(true)
      try {
        const res = await getAgentCapabilities({ line_user_id: profile?.lineUserId })
        const data = res.data?.data || res.data || {}
        setTier(data.identity_tier || data.identityTier || null)
        setCaps(data.capabilities || [])
      } catch {
        setTier(null)
        setCaps([])
      } finally {
        setLoadingCaps(false)
      }
    }
    fetchCaps()
  }, [profile?.lineUserId])

  const tierColor = tier ? (TIER_COLORS[tier] || '#A0A7B3') : '#A0A7B3'
  const tierLabel = tier ? (TIER_LABELS[tier]?.[lang] || tier) : ''

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <UserPageHeader title={t('agent.title')} onBack={() => navigate('/welfare')} />

        <div style={{ padding: '12px 16px 90px' }}>
          <div
            style={{ borderRadius: 22, background: 'linear-gradient(135deg, #2CDBCE 0%, #2F80FF 100%)', color: '#fff', padding: '20px 20px 22px', marginBottom: 16, boxShadow: '0 16px 28px rgba(44,219,206,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <RobotOutlined style={{ fontSize: 26 }} />
              <div style={{ fontSize: 26, fontWeight: 800 }}>{t('agent.title')}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.75, opacity: 0.96 }}>{INTRO[lang]}</div>
          </div>

          {tier && (
            <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${tierColor}33`, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
              <span style={{ fontSize: 22 }}>{tier === 'member' ? '💎' : tier === 'user' ? '🔵' : tier === 'fan' ? '⭐' : '👤'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tierColor, marginBottom: 2 }}>{tierLabel}</div>
                <div style={{ fontSize: 12, color: '#A0A7B3' }}>
                  {lang === 'zh' ? `当前身份 · 已解锁 ${caps.length} 项能力`
                    : lang === 'th' ? `สถานะปัจจุบัน · ปลดล็อก ${caps.length} ความสามารถ`
                    : `Current identity · ${caps.length} capabilities unlocked`}
                </div>
              </div>
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECF1F6', padding: '16px 16px 18px', marginBottom: 14, boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <MessageOutlined style={{ fontSize: 17, color: '#2CDBCE' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{CAN_HELP[lang]}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DEFAULT_TAGS[lang].map((tag, i) => (
                <span key={tag} style={{ background: TAG_COLORS[i] + '18', color: TAG_COLORS[i], borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 700 }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ECF1F6', padding: '16px 16px 18px', marginBottom: 16, boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              {lang === 'zh' ? '推荐操作' : lang === 'th' ? 'การดำเนินการแนะนำ' : 'Quick Actions'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIONS.all.map((a) => (
                <button
                  key={a.zh}
                  onClick={() => a.route ? navigate(a.route) : navigate('/agent/chat')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#F7F9FC', borderRadius: 12, border: '1px solid #ECF1F6', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', flex: 1 }}>{a[lang]}</span>
                  <span style={{ color: '#bbb', fontSize: 16 }}>›</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/agent/chat')}
            style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(90deg, #2CDBCE 0%, #2F80FF 100%)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(44,219,206,0.28)' }}
          >
            <ThunderboltOutlined style={{ fontSize: 17 }} />
            {START[lang]}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <UserBottomNav
          current="agent"
          onHome={() => navigate('/welfare')}
          onAgent={() => navigate('/agent/chat')}
          onMine={() => navigate('/mine')}
        />
      </div>
    </div>
  )
}
