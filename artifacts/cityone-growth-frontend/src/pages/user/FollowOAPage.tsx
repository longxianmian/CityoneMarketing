/**
 * FollowOAPage — 关注 OA 拦截页
 *
 * 转化最优流程（点击一次，自动跳转）：
 *   1. 用户点「关注 LINE OA」→ 打开 LINE 原生加好友页
 *   2. 用户返回 → 直接跳目标页（无任何验证步骤）
 *   3. 目标页含 auto= 参数 → 自动执行领取/参与操作
 */
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import { useEffectiveUserId } from '../../hooks/useEffectiveUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const SESSION_KEY = 'follow_oa_clicked'

export default function FollowOAPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { language } = useI18n()
  const lineProfile = useLineUserStore((s) => s.profile)
  const effectiveUserId = useEffectiveUserId()

  const to   = params.get('to')   || '/welfare'
  const name = params.get('name') || ''
  const back = params.get('back') || '/welfare'

  const [oaId, setOaId] = useState('')
  const clickedRef = useRef(!!sessionStorage.getItem(SESSION_KEY))

  // 从后端拉取真实 OA ID
  useEffect(() => {
    fetch(`${API_BASE}/api/growth/line/config`)
      .then((r) => r.json())
      .then((j) => {
        const id: string = j?.data?.officialAccountId || ''
        if (id && id !== '@YOUR_OA_ID') setOaId(id)
      })
      .catch(() => {})
  }, [])

  // 用户从 LINE 返回后 → 直接跳目标页，无任何额外验证
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return
      if (!clickedRef.current) return
      sessionStorage.removeItem(SESSION_KEY)
      navigate(to, { replace: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [to, navigate])

  const handleFollow = () => {
    const id = oaId || '@cityone'
    sessionStorage.setItem(SESSION_KEY, '1')
    clickedRef.current = true

    // 点击即视为即将关注 → 预写入 fans.json（无需等待 LINE webhook）
    // 同时传 user_id（canonical）和 line_user_id（LINE UID），确保两个维度都能命中 check-follow
    const userId = effectiveUserId
    fetch(`${API_BASE}/api/user/set-fan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:          userId,
        line_user_id:     lineProfile?.lineUserId || userId,
        line_display_name: lineProfile?.lineDisplayName || '',
        line_picture_url:  lineProfile?.linePictureUrl  || '',
      }),
    }).catch(() => {})

    // line:// 深链接在 LINE App 内打开原生加好友弹窗（无 QR 码页）
    window.location.href = `line://ti/p/${encodeURIComponent(id)}`
  }

  const L = {
    pageTitle: { zh: '关注 LINE OA', th: 'ติดตาม LINE OA',   en: 'Follow LINE OA' }[language]!,
    headline:  { zh: '需先关注 CityOne LINE OA', th: 'กรุณาติดตาม CityOne LINE OA ก่อน', en: 'Follow CityOne LINE OA First' }[language]!,
    desc:      { zh: '关注后即可享受专属福利，领取卡券、参与活动、兑换积分礼品，全部畅享无阻。', th: 'หลังจากติดตาม คุณจะได้รับสิทธิพิเศษ รับคูปอง เข้าร่วมกิจกรรม แลกของรางวัล', en: 'Follow to enjoy exclusive benefits: coupons, activities, and rewards.' }[language]!,
    step1:     { zh: '① 点击下方按钮，跳转关注页面', th: '① กดปุ่มด้านล่างเพื่อไปหน้าติดตาม', en: '① Tap below to go to the follow page' }[language]!,
    step2:     { zh: '② 点击「加入好友」关注 CityOne', th: '② กด "เพิ่มเพื่อน" เพื่อติดตาม CityOne', en: '② Tap "Add Friend" to follow CityOne' }[language]!,
    step3:     { zh: '③ 返回后自动进入目标页面', th: '③ กลับมาจะเข้าสู่หน้าเป้าหมายอัตโนมัติ', en: '③ Return and you\'ll land on the target page automatically' }[language]!,
    followBtn: { zh: '关注 LINE OA 并继续', th: 'ติดตาม LINE OA แล้วดำเนินการต่อ', en: 'Follow LINE OA & Continue' }[language]!,
    backBtn:   { zh: '返回', th: 'กลับ', en: 'Back' }[language]!,
    oaBadge:   { zh: '官方认证帐号', th: 'บัญชีที่ได้รับการยืนยัน', en: 'Verified Official Account' }[language]!,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0fef4 0%, #e6f4ff 100%)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 32px' }}>

        {/* 顶部导航 */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e8f4e8' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(back)}
            style={{ paddingLeft: 0 }}
          >
            {L.backBtn}
          </Button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, marginRight: 40 }}>
            {L.pageTitle}
          </span>
        </div>

        {/* LINE OA 品牌卡 */}
        <div style={{
          margin: '24px 16px 0',
          borderRadius: 20,
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(6,199,85,0.12)',
          border: '1px solid #d9f7be',
        }}>
          {/* 品牌头部 */}
          <div style={{
            background: 'linear-gradient(135deg, #06c755 0%, #00a84e 100%)',
            padding: '28px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>CityOne</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '3px 10px', borderRadius: 20 }}>
              {L.oaBadge}
            </div>
          </div>

          <div style={{ padding: '24px 20px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#1a1a1a' }}>{L.headline}</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.8, marginBottom: 20 }}>{L.desc}</div>

            {/* 触发操作名称（如"新人礼包免费充电30分钟"）*/}
            {name && (
              <div style={{
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '1px solid #ffd591',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 14,
                color: '#ad6800',
              }}>
                🎯 {name}
              </div>
            )}

            {/* 操作步骤 */}
            <div style={{ background: '#f6ffed', border: '1px solid #d9f7be', borderRadius: 14, padding: '16px', marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#389e0d', marginBottom: 12 }}>
                {{ zh: '操作步骤', th: 'ขั้นตอน', en: 'Steps' }[language]}
              </div>
              {[L.step1, L.step2, L.step3].map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.9 }}>{s}</div>
              ))}
            </div>

            {/* 唯一按钮：点击即跳转，返回自动进入目标页 */}
            <Button
              type="primary"
              size="large"
              block
              onClick={handleFollow}
              style={{
                height: 52,
                borderRadius: 50,
                fontSize: 16,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #06c755, #00a84e)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(6,199,85,0.35)',
              }}
            >
              {L.followBtn}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
