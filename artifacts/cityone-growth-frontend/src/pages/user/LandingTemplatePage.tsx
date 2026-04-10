import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
import { useI18n, type AppLanguage } from '../../i18n'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const LINE_OA_URL = 'https://line.me/R/ti/p/@cityone'

const UI = {
  zh: {
    defaultButton: '立即关注 LINE OA',
    processing: '✓ 正在跳转...',
    noRegister: '无需注册 · 通过 LINE 直接加入',
  },
  th: {
    defaultButton: 'ติดตาม LINE OA เลย',
    processing: '✓ กำลังนำทาง...',
    noRegister: 'ไม่ต้องลงทะเบียน · เข้าร่วมผ่าน LINE ได้เลย',
  },
  en: {
    defaultButton: 'Follow LINE OA Now',
    processing: '✓ Redirecting...',
    noRegister: 'No registration needed · Join via LINE',
  },
}

// 从目标 action 推导出目标路径 + auto 触发参数
function buildTargetPath(tpl: any, landingId: string, utmParams: string): string {
  const action = tpl.autoAction || tpl.primary_cta_action || ''
  let base = ''
  if (action === 'open_activity' && tpl.targetActivityId) {
    base = `/activity/${tpl.targetActivityId}?auto=participate`
  } else if (action === 'open_product' && tpl.targetProductId) {
    base = `/redeem/${tpl.targetProductId}?auto=redeem`
  } else if (action === 'open_nearby') {
    base = '/nearby'
  } else {
    base = '/welfare'
  }
  // 拼接归因参数
  const sep = base.includes('?') ? '&' : '?'
  const attribution = `entry_code=${encodeURIComponent(landingId)}${utmParams ? '&' + utmParams : ''}`
  return base + sep + attribution
}

export default function LandingTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const { language } = useI18n()
  const lang = language as AppLanguage
  const ui = UI[lang] || UI.en
  const [tpl, setTpl] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)

  // 提取并透传来自广告平台的 UTM 参数
  const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
    .filter(k => searchParams.get(k))
    .map(k => `${k}=${encodeURIComponent(searchParams.get(k)!)}`)
    .join('&')

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
    if (!tpl || following) return
    setFollowing(true)

    // 1. 打开 LINE OA（新标签）
    window.open(LINE_OA_URL, '_blank')

    // 2. 800ms 后跳转到目标详情页（携带归因参数 + auto 触发）
    setTimeout(() => {
      const targetPath = buildTargetPath(tpl, id!, utmParams)
      nav(targetPath)
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
