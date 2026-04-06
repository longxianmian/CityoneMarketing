import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin, Tag } from 'antd'
import { ArrowLeftOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const TYPE_LABELS: Record<string, { label: string; color: string; btnText: string; route: string }> = {
  lucky_wheel: { label: '大转盘', color: '#fa8c16', btnText: '立即抽奖', route: '/activity/wheel/' },
  scratch_card: { label: '刮刮卡', color: '#1677ff', btnText: '立即刮卡', route: '/activity/scratch/' },
  thai_fortune_draw: { label: '祈福抽签', color: '#722ed1', btnText: '求签祈福', route: '/activity/fortune/' },
  default: { label: '活动', color: '#52c41a', btnText: '立即参与', route: '' },
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shareVisible, setShareVisible] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activities/${id}`)
        const json = await res.json()
        setActivity(json.data || json)
      } catch { setActivity(null) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  )

  const actType = activity?.activity_type || activity?.activityType || activity?.type || ''
  const typeInfo = TYPE_LABELS[actType] || TYPE_LABELS.default
  const title = activity?.activity_name || activity?.activity_title || pick(activity?.title) || activity?.name || ''
  const subTitle = activity?.activity_subtitle || pick(activity?.subTitle) || ''
  const description = activity?.activity_desc || pick(activity?.description) || ''
  const highlights = activity?.highlights || ''
  const participationGuide = activity?.participation_guide || activity?.participationGuide || ''
  const rewardGuide = activity?.reward_guide || activity?.rewardGuide || ''
  const noticeText = activity?.notice_text || activity?.noticeText || ''
  const coverImage = activity?.cover_image || activity?.coverImage || ''
  const coverVideo = activity?.cover_video || activity?.coverVideo || ''
  const linkedProducts: any[] = activity?.linkedProducts || []
  const buttonText = activity?.buttonText ? pick(activity.buttonText) : typeInfo.btnText
  const isInteractive = ['lucky_wheel', 'scratch_card', 'thai_fortune_draw'].includes(actType)

  const handleAction = () => {
    if (isInteractive && typeInfo.route) {
      nav(`${typeInfo.route}${id}`)
    } else {
      nav('/welfare')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 100 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>活动详情</span>
        {activity && <Tag color={typeInfo.color} style={{ marginRight: 8 }}>{typeInfo.label}</Tag>}
        <button
          onClick={() => setShareVisible(true)}
          title="分享好友赚积分"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: '#1677ff' }}
        >
          <ShareAltOutlined style={{ fontSize: 20 }} />
        </button>
      </div>

      <SharePromoModal
        open={shareVisible}
        onClose={() => setShareVisible(false)}
        type="activity"
        id={id!}
        name={title}
        campaignId={activity?.campaign_id}
      />

      {coverVideo ? (
        <video src={coverVideo} autoPlay muted loop playsInline style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
      ) : coverImage ? (
        <img src={coverImage} alt={title} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 180, background: 'linear-gradient(135deg, #1677ff20, #1677ff40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 48 }}>🎁</span>
        </div>
      )}

      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>{title}</h1>
        {subTitle && <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{subTitle}</p>}

        {description && (
          <Section title="活动说明">
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{description}</p>
          </Section>
        )}

        {highlights && (
          <Section title="活动亮点">
            {highlights.split(/\n|·|•/).filter(Boolean).map((h: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#1677ff', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✦</span>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{h.trim()}</span>
              </div>
            ))}
          </Section>
        )}

        {participationGuide && (
          <Section title="参与步骤">
            {participationGuide.split(/\n|→/).filter(Boolean).map((step: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1677ff', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7, paddingTop: 2 }}>{step.trim()}</span>
              </div>
            ))}
          </Section>
        )}

        {(rewardGuide || linkedProducts.length > 0) && (
          <Section title="奖励预告">
            {rewardGuide && <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8, marginBottom: 12 }}>{rewardGuide}</p>}
            {linkedProducts.map((p: any) => (
              <div
                key={p.id}
                onClick={() => nav(`/redeem/${p.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#fff', borderRadius: 12, marginBottom: 8, cursor: 'pointer', border: '1px solid #f0f0f0' }}
              >
                {p.coverImage && <img src={p.coverImage} alt={p.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{pick(p.title) || p.title}</div>
                  {p.pointsPrice > 0 && <div style={{ fontSize: 12, color: '#1677ff' }}>{p.pointsPrice} 积分</div>}
                  {p.pointsPrice === 0 && <div style={{ fontSize: 12, color: '#52c41a' }}>免费</div>}
                </div>
                <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
              </div>
            ))}
          </Section>
        )}

        {noticeText && (
          <Section title="注意事项">
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.8 }}>{noticeText}</p>
          </Section>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: '#fff', borderTop: '1px solid #f0f0f0', zIndex: 20 }}>
        <button
          onClick={handleAction}
          style={{ width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, #1677ff, #4096ff)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(22,119,255,0.35)', letterSpacing: 0.5 }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 12, borderLeft: '3px solid #1677ff', paddingLeft: 10 }}>{title}</h3>
      {children}
    </div>
  )
}
