import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, message } from 'antd'
import { ArrowLeftOutlined, CheckCircleFilled, LoadingOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import { getDeviceUserId } from '../../utils/deviceUserId'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export default function FollowOAPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { language } = useI18n()
  const lineProfile = useLineUserStore((s) => s.profile)

  const to   = params.get('to')   || '/welfare'
  const name = params.get('name') || ''
  const back = params.get('back') || '/welfare'

  const [oaId, setOaId]         = useState('')
  const [checking, setChecking] = useState(false)
  const [opened, setOpened]     = useState(false)   // 用户已点击过关注按钮

  // 从后端配置拉取 OA ID
  useEffect(() => {
    fetch(`${API_BASE}/api/growth/line/config`)
      .then((r) => r.json())
      .then((j) => {
        const id: string = j?.data?.officialAccountId || ''
        if (id && id !== '@YOUR_OA_ID') setOaId(id)
      })
      .catch(() => {})
  }, [])

  const L = {
    pageTitle:    { zh: '关注 LINE OA', th: 'ติดตาม LINE OA', en: 'Follow LINE OA' }[language]!,
    headline:     { zh: '需先关注 CityOne LINE OA', th: 'กรุณาติดตาม CityOne LINE OA ก่อน', en: 'Follow CityOne LINE OA First' }[language]!,
    desc:         { zh: '关注后即可享受专属福利，领取卡券、参与活动、兑换积分礼品，全部畅享无阻。', th: 'หลังจากติดตามแล้ว คุณจะได้รับสิทธิพิเศษ รับคูปอง เข้าร่วมกิจกรรม แลกของรางวัล', en: 'Follow to enjoy exclusive benefits: coupons, activities, and rewards.' }[language]!,
    step1:        { zh: '① 点击下方按钮，跳转到关注页面', th: '① กดปุ่มด้านล่างเพื่อไปหน้าติดตาม', en: '① Tap the button below to open the follow page' }[language]!,
    step2:        { zh: '② 点击「加入好友」关注 CityOne 官方帐号', th: '② กด "เพิ่มเพื่อน" เพื่อติดตาม CityOne', en: '② Tap "Add Friend" to follow CityOne OA' }[language]!,
    step3:        { zh: '③ 返回此页，点击「我已关注，继续」', th: '③ กลับมาหน้านี้ แล้วกด "ติดตามแล้ว ดำเนินการต่อ"', en: '③ Come back here and tap "Already Followed, Continue"' }[language]!,
    followBtn:    { zh: '前往关注 LINE OA', th: 'ไปติดตาม LINE OA', en: 'Go Follow LINE OA' }[language]!,
    confirmBtn:   { zh: '我已关注，立即继续', th: 'ติดตามแล้ว ดำเนินการต่อ', en: 'Already Followed, Continue' }[language]!,
    verifying:    { zh: '验证中…', th: 'กำลังตรวจสอบ…', en: 'Verifying…' }[language]!,
    notYet:       { zh: '暂未检测到关注，请先关注 OA 再继续', th: 'ยังไม่พบการติดตาม กรุณาติดตามก่อน', en: 'Not followed yet, please follow first' }[language]!,
    backBtn:      { zh: '返回', th: 'กลับ', en: 'Back' }[language]!,
    oaBadge:      { zh: '官方认证帐号', th: 'บัญชีที่ได้รับการยืนยัน', en: 'Verified Official Account' }[language]!,
  }

  // 构建 LINE OA 关注链接
  // 在 LINE 内使用 line://ti/p/ 深链接直接打开原生关注弹窗（无 QR 码页）
  const buildFollowUrl = () => {
    const id = oaId || '@cityone'
    const encoded = encodeURIComponent(id)           // %40cityonexxx
    // line:// 深链接在 LINE App 内直接弹出「加入好友」页，不会跳到网页 QR 码
    return `line://ti/p/${encoded}`
  }

  const handleOpenFollow = () => {
    const url = buildFollowUrl()
    // 在 LINE in-app browser 内 window.location.href 跳 line:// 深链接
    // 会打开 LINE 原生加好友页面，用户关注后可用系统「返回」键回来
    window.location.href = url
    setOpened(true)
  }

  // 用户声称已关注 → 向后端验证
  const handleConfirm = async () => {
    setChecking(true)
    try {
      const userId = lineProfile?.lineUserId || getDeviceUserId()
      const res  = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
      const json = await res.json()
      const isFan: boolean = json?.data?.is_fan === true

      if (isFan) {
        // 已是粉丝 → 跳回目标页（to 里含 auto=claim/participate 等参数，页面会自动触发操作）
        navigate(to, { replace: true })
      } else {
        message.warning(L.notYet)
      }
    } catch {
      message.error({ zh: '验证失败，请重试', th: 'ตรวจสอบล้มเหลว', en: 'Verification failed, please retry' }[language]!)
    } finally {
      setChecking(false)
    }
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

            {/* 主按钮：前往关注（line:// 深链接）*/}
            <Button
              type="primary"
              size="large"
              block
              onClick={handleOpenFollow}
              style={{
                height: 52,
                borderRadius: 50,
                fontSize: 16,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #06c755, #00a84e)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(6,199,85,0.35)',
                marginBottom: opened ? 12 : 0,
              }}
            >
              {L.followBtn}
            </Button>

            {/* 已关注确认按钮：只在用户点击过关注后出现 */}
            {opened && (
              <Button
                size="large"
                block
                onClick={handleConfirm}
                disabled={checking}
                icon={checking ? <LoadingOutlined /> : <CheckCircleFilled style={{ color: '#06c755' }} />}
                style={{
                  height: 52,
                  borderRadius: 50,
                  fontSize: 15,
                  fontWeight: 700,
                  border: '2px solid #06c755',
                  color: '#06c755',
                  background: '#fff',
                }}
              >
                {checking ? L.verifying : L.confirmBtn}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
