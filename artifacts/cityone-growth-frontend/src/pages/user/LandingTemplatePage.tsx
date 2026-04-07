import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { useI18n, type AppLanguage } from '../../i18n'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const ACTION_ROUTES: Record<string, string> = {
  open_welfare: '/welfare',
  open_nearby: '/nearby',
}

const UI = {
  zh: {
    defaultButton: '立即关注 LINE OA',
    processing: '✓ 处理中...',
    noRegister: '无需注册 · 通过 LINE 直接加入',
  },
  th: {
    defaultButton: 'ติดตาม LINE OA เลย',
    processing: '✓ กำลังดำเนินการ...',
    noRegister: 'ไม่ต้องลงทะเบียน · เข้าร่วมผ่าน LINE ได้เลย',
  },
  en: {
    defaultButton: 'Follow LINE OA Now',
    processing: '✓ Processing...',
    noRegister: 'No registration needed · Join via LINE',
  },
}

export default function LandingTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = UI[lang] || UI.en
  const [tpl, setTpl] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    const fetchTpl = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/landing-templates/${id}`)
        const json = await res.json()
        setTpl(json.data || json)
      } catch {
        setTpl(null)
      } finally {
        setLoading(false)
      }
    }
    fetchTpl()
  }, [id])

  const handleFollow = () => {
    if (!tpl) return
    setFollowing(true)
    setTimeout(() => {
      setFollowing(false)
      const action = tpl.autoAction
      if (action === 'open_activity' && tpl.targetActivityId) {
        nav(`/activity/${tpl.targetActivityId}`)
      } else if (action === 'open_product' && tpl.targetProductId) {
        nav(`/redeem/${tpl.targetProductId}`)
      } else if (ACTION_ROUTES[action]) {
        nav(ACTION_ROUTES[action])
      } else {
        nav('/welfare')
      }
    }, 800)
  }

  const pick = (field: any): string => {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field === 'object') return field[lang] || field.en || field.zh || field.th || ''
    return ''
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f4ee' }}>
      <Spin size="large" />
    </div>
  )

  const title = tpl ? pick(tpl.title) : ''
  const subTitle = tpl ? pick(tpl.subTitle) : ''
  const benefitText = tpl ? pick(tpl.benefitText) : ''
  const supportText = tpl ? pick(tpl.supportText) : ''
  const buttonText = tpl ? (pick(tpl.buttonText) || ui.defaultButton) : ui.defaultButton
  const coverImage = tpl?.coverImage || ''

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      {coverImage && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 28, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <img src={coverImage} alt="cover" style={{ width: '100%', display: 'block' }} />
        </div>
      )}

      {!coverImage && (
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #00b96b, #1677ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 4px 20px rgba(22,119,255,0.4)' }}>
          <span style={{ fontSize: 36 }}>C</span>
        </div>
      )}

      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        {title && (
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1.3, marginBottom: 12 }}>
            {title}
          </h1>
        )}
        {subTitle && (
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginBottom: 16, lineHeight: 1.6 }}>
            {subTitle}
          </p>
        )}
        {benefitText && (
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 20px', marginBottom: 20, backdropFilter: 'blur(8px)' }}>
            <p style={{ color: '#ffd666', fontSize: 14, fontWeight: 600, margin: 0 }}>✦ {benefitText}</p>
          </div>
        )}
        {supportText && (
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
            {supportText}
          </p>
        )}

        <button
          onClick={handleFollow}
          disabled={following}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '16px 24px',
            background: following ? '#52c41a' : 'linear-gradient(135deg, #06c755, #00b96b)',
            border: 'none',
            borderRadius: 50,
            color: '#fff',
            fontSize: 17,
            fontWeight: 700,
            cursor: following ? 'default' : 'pointer',
            boxShadow: '0 6px 24px rgba(6,199,85,0.5)',
            transition: 'all 0.2s',
            letterSpacing: 0.5,
          }}
        >
          {following ? ui.processing : buttonText}
        </button>

        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
          {ui.noRegister}
        </p>
      </div>
    </div>
  )
}
