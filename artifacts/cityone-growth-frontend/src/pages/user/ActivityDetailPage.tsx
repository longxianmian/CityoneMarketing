import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { Spin, Tag, Button, Card, Space } from 'antd'
import { ArrowLeftOutlined, ShareAltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useI18n, type AppLanguage } from '../../i18n'
import SharePromoModal from '../../components/SharePromoModal'
import OssImage, { useOssUrl } from '../../components/OssImage'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'
import { useFollowGate } from '../../hooks/useFollowGate'
import { activityQueryKey, fetchActivityById } from '../../cache/activityCache'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

type ML = { zh: string; th: string; en: string }
const TYPE_LABELS_ML: Record<string, { label: ML; color: string; btnText: ML; route: string }> = {
  lucky_wheel:       { label: { zh:'大转盘',  th:'วงล้อนำโชค',  en:'Lucky Wheel'    }, color:'#fa8c16', btnText:{ zh:'立即抽奖', th:'หมุนเลย',       en:'Spin Now'     }, route:'/activity/wheel/'   },
  spin_wheel:        { label: { zh:'大转盘',  th:'วงล้อนำโชค',  en:'Lucky Wheel'    }, color:'#fa8c16', btnText:{ zh:'立即抽奖', th:'หมุนเลย',       en:'Spin Now'     }, route:'/activity/wheel/'   },
  scratch_card:      { label: { zh:'刮刮卡',  th:'การ์ดขูด',    en:'Scratch Card'   }, color:'#1677ff', btnText:{ zh:'立即刮卡', th:'ขูดเลย',        en:'Scratch Now'  }, route:'/activity/scratch/' },
  thai_fortune_draw: { label: { zh:'祈福抽签', th:'เซียมซีนำโชค', en:'Fortune Draw'   }, color:'#722ed1', btnText:{ zh:'求签祈福', th:'จับเซียมซี',     en:'Draw Fortune' }, route:'/activity/fortune/' },
  default:           { label: { zh:'活动',   th:'กิจกรรม',     en:'Activity'       }, color:'#52c41a', btnText:{ zh:'立即参与', th:'เข้าร่วมเลย',    en:'Join Now'     }, route:'' },
}

type Step = 'detail' | 'success'

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { language, t } = useI18n()
  const lang = language as AppLanguage
  const { data: activity, isLoading: loading } = useQuery({
    queryKey: activityQueryKey(id!),
    queryFn: () => fetchActivityById(id!),
    enabled: !!id,
  })
  const [shareVisible, setShareVisible] = useState(false)
  const [step, setStep] = useState<Step>('detail')
  const [pointsAwarded, setPointsAwarded] = useState<number>(0)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [participating, setParticipating] = useState(false)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const heroVideoRef = useRef<HTMLVideoElement>(null)
  const { guard, checking } = useFollowGate()
  const effectiveUserId = useEffectiveUserId()

  const handleStartVideo = async () => {
    setVideoStarted(true)
    const el = heroVideoRef.current
    if (!el) return
    setVideoPaused(false)
    try {
      await el.play()
    } catch {
      setVideoPaused(true)
    }
  }

  const toggleVideoPlay = async () => {
    const el = heroVideoRef.current
    if (!el) return
    if (el.paused) {
      try {
        await el.play()
        setVideoPaused(false)
      } catch {
        setVideoPaused(true)
      }
      return
    }
    el.pause()
    setVideoPaused(true)
  }

  // 来自 FollowOAPage 回跳：auto=participate → 自动参与
  useEffect(() => {
    if (searchParams.get('auto') === 'participate' && activity && !participating) {
      doParticipate()
    }
  }, [activity, searchParams.get('auto')])

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field)
        if (parsed && typeof parsed === 'object') return parsed[lang] || parsed.zh || parsed.en || parsed.th || ''
      } catch {}
      return field
    }
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  )

  const actType = activity?.activity_type || activity?.activityType || activity?.type || ''
  const typeInfoML = TYPE_LABELS_ML[actType] || TYPE_LABELS_ML.default
  const typeLabel = typeInfoML.label[lang] || typeInfoML.label.zh
  const typeBtnText = typeInfoML.btnText[lang] || typeInfoML.btnText.zh
  const title = pick(activity?.activity_name || activity?.activity_title || activity?.title) || activity?.name || ''
  const subTitle = pick(activity?.activity_subtitle || activity?.subTitle) || ''
  const description = pick(activity?.activity_desc || activity?.description) || ''
  const highlights = pick(activity?.highlights) || ''
  const participationGuide = pick(activity?.participation_guide || activity?.participationGuide) || ''
  const rewardGuide = pick(activity?.reward_guide || activity?.rewardGuide) || ''
  const noticeText = pick(activity?.notice_text || activity?.noticeText) || ''
  const coverImage = activity?.cover_image || activity?.coverImage || ''
  const coverVideo = activity?.cover_video || activity?.coverVideo || ''
  const resolvedCoverImage = useOssUrl(coverImage || undefined)
  const resolvedCoverVideo = useOssUrl(coverVideo || undefined)
  const videoReady = !!resolvedCoverVideo
  const linkedProducts: any[] = activity?.linkedProducts || []
  const buttonText = activity?.buttonText ? pick(activity.buttonText) : typeBtnText
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
      const userId = effectiveUserId
      const entryCode = searchParams.get('entry_code') || ''
      const utmSource = searchParams.get('utm_source') || ''
      const res = await fetch(`${API_BASE}/api/activities/${id}/participate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...(entryCode && { source_landing_id: entryCode }),
          ...(utmSource && { source_channel_id: utmSource }),
        }),
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

  // 核心：点击操作按钮 → 使用预加载结果（或按需查询）决定路径
  const handleAction = () => {
    const baseTarget = isInteractive && typeInfoML.route
      ? `${typeInfoML.route}${id}`
      : `/activity/${id}?auto=participate`
    const entryCode = searchParams.get('entry_code') || ''
    const utmSource = searchParams.get('utm_source') || ''
    guard(
      async () => {
        if (isInteractive && typeInfoML.route) {
          nav(`${typeInfoML.route}${id}`)
        } else {
          await doParticipate()
        }
      },
      {
        label: title,
        returnPath: baseTarget,
        back: `/activity/${id}`,
        intentAction: 'participate_activity',
        resourceId: id || '',
        source: {
          ...(entryCode && { source_landing_id: entryCode }),
          ...(utmSource && { source_channel_id: utmSource }),
        },
      }
    )
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f5f5' }}>
      <div style={{ flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={() => { const b = (location.state as any)?.backTo; b ? nav(b) : location.key !== 'default' ? nav(-1) : nav('/welfare') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 8, display: 'flex', alignItems: 'center', color: '#333' }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>{t('detail.detail')}</span>
        {activity && <Tag color={typeInfoML.color} style={{ marginRight: 8 }}>{typeLabel}</Tag>}
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

      <div style={{ flexShrink: 0, width: '100%', aspectRatio: '16/9', background: '#f0f0f0', overflow: 'hidden', position: 'relative' } as React.CSSProperties}>
        {/* 视频始终保留在DOM，避免安卓重新挂载后autoPlay不在手势上下文 */}
        {videoReady && (
          <video
            ref={heroVideoRef}
            src={resolvedCoverVideo}
            loop
            playsInline
            preload="metadata"
            poster={resolvedCoverImage || undefined}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                     visibility: videoStarted ? 'visible' : 'hidden' } as React.CSSProperties}
            onClick={toggleVideoPlay}
            onPlay={() => setVideoPaused(false)}
            onPause={() => setVideoPaused(videoStarted)}
          />
        )}
        {/* 暂停提示 */}
        {videoStarted && videoPaused && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', lineHeight: 1, marginLeft: 2 }}>▶</span>
            </div>
          </div>
        )}
        {/* 未播放时：封面图 + 播放按钮叠加层 */}
        {!videoStarted && (
          coverImage ? (
            <div style={{ position: 'absolute', inset: 0, cursor: videoReady ? 'pointer' : 'default' }}
                 onClick={videoReady ? handleStartVideo : undefined}>
              <OssImage src={coverImage} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} placeholderStyle={{ width: '100%', height: '100%' }} />
              {videoReady && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
                  </div>
                </div>
              )}
            </div>
          ) : videoReady ? (
            <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                 onClick={handleStartVideo}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, color: '#fff', lineHeight: 1, marginLeft: 3 }}>▶</span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1677ff20, #1677ff40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 48 }}>🎁</span>
            </div>
          )
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>{title}</h1>
        {subTitle && <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{subTitle}</p>}

        {description && (
          <Section title={t('detail.description')}>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{description}</p>
          </Section>
        )}

        {highlights && (
          <Section title={t('detail.highlights')}>
            {highlights.split(/\n|·|•/).filter(Boolean).map((h: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#1677ff', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✦</span>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{h.trim()}</span>
              </div>
            ))}
          </Section>
        )}

        {participationGuide && (
          <Section title={t('detail.howToJoin')}>
            {participationGuide.split(/\n|→/).filter(Boolean).map((s: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1677ff', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.7, paddingTop: 2 }}>{s.trim()}</span>
              </div>
            ))}
          </Section>
        )}

        {(rewardGuide || linkedProducts.length > 0) && (
          <Section title={t('detail.rewards')}>
            {rewardGuide && <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8, marginBottom: 12 }}>{rewardGuide}</p>}
            {linkedProducts.map((p: any) => (
              <div
                key={p.id}
                onClick={() => nav(`/redeem/${p.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#fff', borderRadius: 12, marginBottom: 8, cursor: 'pointer', border: '1px solid #f0f0f0' }}
              >
                {p.coverImage && <OssImage src={p.coverImage} alt={p.title} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{pick(p.title) || p.title}</div>
                  {p.pointsPrice > 0 && <div style={{ fontSize: 12, color: '#1677ff' }}>{p.pointsPrice} {t('productDetail.pts')}</div>}
                  {p.pointsPrice === 0 && <div style={{ fontSize: 12, color: '#52c41a' }}>{t('productDetail.free')}</div>}
                </div>
                <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
              </div>
            ))}
          </Section>
        )}

        {noticeText && (
          <Section title={t('detail.notice')}>
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.8 }}>{noticeText}</p>
          </Section>
        )}
      </div>
      </div>

      <div style={{ flexShrink: 0, padding: '12px 16px 24px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
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
