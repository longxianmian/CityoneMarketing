import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Spin, Tag, Button, Card, Space } from 'antd'
import { ArrowLeftOutlined, ShareAltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const TYPE_LABELS: Record<string, { label: string; color: string; btnText: string; route: string }> = {
  lucky_wheel:        { label: '大转盘',  color: '#fa8c16', btnText: '立即抽奖', route: '/activity/wheel/'   },
  spin_wheel:         { label: '大转盘',  color: '#fa8c16', btnText: '立即抽奖', route: '/activity/wheel/'   },
  scratch_card:       { label: '刮刮卡',  color: '#1677ff', btnText: '立即刮卡', route: '/activity/scratch/' },
  thai_fortune_draw:  { label: '祈福抽签', color: '#722ed1', btnText: '求签祈福', route: '/activity/fortune/' },
  default:            { label: '活动',    color: '#52c41a', btnText: '立即参与', route: '' },
}

type Step = 'detail' | 'success'

async function checkFanStatus(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
    const json = await res.json()
    return json?.data?.is_fan === true
  } catch {
    return false
  }
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shareVisible, setShareVisible] = useState(false)
  const [step, setStep] = useState<Step>('detail')
  const [pointsAwarded, setPointsAwarded] = useState<number>(0)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [participating, setParticipating] = useState(false)
  const [checking, setChecking] = useState(false)

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

  // 来自 FollowOAPage 回跳：auto=participate → 自动参与
  useEffect(() => {
    if (searchParams.get('auto') === 'participate' && activity && !participating) {
      doParticipate()
    }
  }, [activity, searchParams.get('auto')])

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
  const title = pick(activity?.activity_name || activity?.activity_title || activity?.title) || activity?.name || ''
  const subTitle = pick(activity?.activity_subtitle || activity?.subTitle) || ''
  const description = pick(activity?.activity_desc || activity?.description) || ''
  const highlights = pick(activity?.highlights) || ''
  const participationGuide = pick(activity?.participation_guide || activity?.participationGuide) || ''
  const rewardGuide = pick(activity?.reward_guide || activity?.rewardGuide) || ''
  const noticeText = pick(activity?.notice_text || activity?.noticeText) || ''
  const coverImage = activity?.cover_image || activity?.coverImage || ''
  const coverVideo = activity?.cover_video || activity?.coverVideo || ''
  const linkedProducts: any[] = activity?.linkedProducts || []
  const buttonText = activity?.buttonText ? pick(activity.buttonText) : typeInfo.btnText
  const isInteractive = ['lucky_wheel', 'spin_wheel', 'scratch_card', 'thai_fortune_draw'].includes(actType)

  const backLabel = { zh: '返回福利中心', th: 'กลับศูนย์สิทธิพิเศษ', en: 'Back to Benefits' }[language]!
  const successTitle = { zh: '参与成功！', th: 'เข้าร่วมสำเร็จ!', en: 'Joined Successfully!' }[language]!
  const successDesc = {
    zh: '你已成功参与本活动，奖励将自动发放到你的账户。',
    th: 'คุณเข้าร่วมกิจกรรมสำเร็จแล้ว รางวัลจะเข้าบัญชีโดยอัตโนมัติ',
    en: 'You have successfully joined. Rewards will be credited to your account automatically.',
  }[language]!

  const doParticipate = async () => {
    setParticipating(true)
    try {
      const userId = getDeviceUserId()
      const res = await fetch(`${API_BASE}/api/activities/${id}/participate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const json = await res.json()
      setPointsAwarded(json.data?.points_awarded ?? 0)
      setAlreadyJoined(json.data?.already_joined ?? false)
    } catch {
      setPointsAwarded(0)
    } finally {
      setParticipating(false)
      setStep('success')
    }
  }

  // 核心：点击操作按钮 → 先检查粉丝身份，再决定路径
  const handleAction = async () => {
    setChecking(true)
    try {
      const userId = getDeviceUserId()
      const isFan = await checkFanStatus(userId)

      if (isFan) {
        // 已关注：直接执行
        if (isInteractive && typeInfo.route) {
          nav(`${typeInfo.route}${id}`)
        } else {
          await doParticipate()
        }
      } else {
        // 未关注：跳到关注页，回跳目标根据类型决定
        const redirectTo = isInteractive && typeInfo.route
          ? `${typeInfo.route}${id}`
          : `/activity/${id}?auto=participate`
        nav(`/follow-oa?to=${encodeURIComponent(redirectTo)}&name=${encodeURIComponent(title)}&back=${encodeURIComponent(`/activity/${id}`)}`)
      }
    } finally {
      setChecking(false)
    }
  }

  // ── 参与中 loading ────────────────────────────────────────────────────────
  if (participating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #52c41a 0%, #95de64 100%)' }}>
        <Spin size="large" />
      </div>
    )
  }

  // ── 参与成功步骤 ──────────────────────────────────────────────────────────
  if (step === 'success') {
    const pointsLabel = {
      zh: alreadyJoined ? '您已参与过此活动' : (pointsAwarded > 0 ? `已获得 ${pointsAwarded} 积分` : '参与成功'),
      th: alreadyJoined ? 'คุณเคยเข้าร่วมกิจกรรมนี้แล้ว' : (pointsAwarded > 0 ? `ได้รับ ${pointsAwarded} คะแนน` : 'เข้าร่วมสำเร็จ'),
      en: alreadyJoined ? 'You have already joined this activity.' : (pointsAwarded > 0 ? `You earned ${pointsAwarded} points` : 'Joined successfully'),
    }[language]!

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #52c41a 0%, #95de64 100%)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <Card style={{ borderRadius: 20, overflow: 'hidden', textAlign: 'center', padding: '24px 16px' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{successTitle}</div>
            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 16 }}>{successDesc}</div>
            {!alreadyJoined && pointsAwarded > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #fffbe6 0%, #fff7e0 100%)',
                border: '1px solid #ffd666', borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 28 }}>🎁</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#d48806' }}>+{pointsAwarded}</span>
                <span style={{ fontSize: 14, color: '#ad6800', fontWeight: 600 }}>
                  {{ zh: '积分', th: 'คะแนน', en: 'pts' }[language]}
                </span>
              </div>
            )}
            {alreadyJoined && (
              <div style={{ background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 12, padding: '10px 16px', marginBottom: 16, color: '#888', fontSize: 13 }}>
                {pointsLabel}
              </div>
            )}
            {title && (
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>{title}</div>
              </div>
            )}
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block onClick={() => nav('/welfare')}>{backLabel}</Button>
            </Space>
          </Card>
        </div>
      </div>
    )
  }

  // ── 活动详情主视图 ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 100 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => nav('/welfare')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
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
            {participationGuide.split(/\n|→/).filter(Boolean).map((s: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1677ff', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7, paddingTop: 2 }}>{s.trim()}</span>
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
          disabled={checking}
          style={{ width: '100%', padding: '14px 0', background: checking ? '#ccc' : 'linear-gradient(135deg, #1677ff, #4096ff)', border: 'none', borderRadius: 50, color: '#fff', fontSize: 17, fontWeight: 700, cursor: checking ? 'not-allowed' : 'pointer', boxShadow: checking ? 'none' : '0 4px 16px rgba(22,119,255,0.35)', letterSpacing: 0.5, transition: 'background 0.2s' }}
        >
          {checking
            ? ({ zh: '验证中...', th: 'กำลังตรวจสอบ...', en: 'Checking...' }[language])
            : buttonText}
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
