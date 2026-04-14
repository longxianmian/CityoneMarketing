/**
 * FollowOAPage — 关注 OA 拦截页
 *
 * 主链路：liff.requestFriendship() → LINE 原生弹窗 → 用户关注 → 验证 → navigate(to)
 * 全程闭环，LIFF WebView 不销毁，链路不丢。
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import { useLiff, getLiff } from '../../providers/LiffProvider'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const SK_PENDING = 'cityone_follow_pending'
const SK_TO      = 'cityone_follow_to'

export default function FollowOAPage() {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const { language } = useI18n()
  const lineProfile  = useLineUserStore((s) => s.profile)
  const setIsFriend  = useLineUserStore((s) => s.setIsFriend)
  const mergeProfile = useLineUserStore((s) => s.mergeProfile)
  const { liffReady } = useLiff()

  const to   = params.get('to')   || sessionStorage.getItem(SK_TO) || '/welfare'
  const name = params.get('name') || ''
  const back = params.get('back') || '/welfare'

  const [oaId, setOaId]       = useState('')
  const [checking, setChecking] = useState(false)
  const busyRef = useRef(false)

  // store 已确认关注 → 直接跳目标页
  useEffect(() => {
    if (liffReady && lineProfile?.isFriend === true) {
      sessionStorage.removeItem(SK_PENDING)
      sessionStorage.removeItem(SK_TO)
      navigate(to, { replace: true })
    }
  }, [liffReady, lineProfile?.isFriend, navigate, to])

  // 拉取真实 OA ID
  useEffect(() => {
    fetch(`${API_BASE}/api/growth/line/config`)
      .then((r) => r.json())
      .then((j) => {
        const id: string = j?.data?.officialAccountId || ''
        if (id && id !== '@YOUR_OA_ID') setOaId(id)
      })
      .catch(() => {})
  }, [])

  // ── 主链路：liff.requestFriendship() ─────────────────────────────────────
  // LINE 官方 API，在 LINE 内弹出关注确认弹窗，LIFF WebView 全程不销毁，链路不丢
  const handleFollow = async () => {
    const liff = getLiff()
    if (!liff) return

    setChecking(true)
    try {
      await liff.requestFriendship()

      const friendship = await liff.getFriendship()
      if (!friendship.friendFlag) {
        setChecking(false)
        return
      }

      const p = await liff.getProfile()
      mergeProfile({
        lineUserId:      p.userId,
        lineDisplayName: p.displayName,
        linePictureUrl:  p.pictureUrl || '',
        isFriend:        true,
      })

      sessionStorage.removeItem(SK_PENDING)
      sessionStorage.removeItem(SK_TO)
      navigate(to, { replace: true })
    } catch {
      setChecking(false)
    }
  }

  // ── 兜底链路：visibilitychange + focus ────────────────────────────────────
  // 仅在 sessionStorage 有 pending 标记时生效（非主流程，降级保护）
  const verifyFallback = useCallback(async () => {
    if (busyRef.current) return
    if (sessionStorage.getItem(SK_PENDING) !== '1') return
    busyRef.current = true
    const liff = getLiff()
    if (!liff) { busyRef.current = false; return }
    try {
      const friendship = await liff.getFriendship()
      if (friendship.friendFlag) {
        try {
          const p = await liff.getProfile()
          mergeProfile({
            lineUserId:      p.userId,
            lineDisplayName: p.displayName,
            linePictureUrl:  p.pictureUrl || '',
            isFriend:        true,
          })
        } catch { setIsFriend(true) }
        sessionStorage.removeItem(SK_PENDING)
        sessionStorage.removeItem(SK_TO)
        navigate(to, { replace: true })
        return
      }
    } catch {}
    busyRef.current = false
  }, [to, navigate, mergeProfile, setIsFriend])

  useEffect(() => {
    if (!liffReady) return
    // 页面重载后恢复（兜底）
    if (sessionStorage.getItem(SK_PENDING) === '1') verifyFallback()
    const onVisible = () => { if (!document.hidden) verifyFallback() }
    const onFocus   = () => verifyFallback()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [liffReady, verifyFallback])

  const L = {
    pageTitle: { zh: '关注 LINE OA', th: 'ติดตาม LINE OA',   en: 'Follow LINE OA' }[language]!,
    headline:  { zh: '需先关注 CityOne LINE OA', th: 'กรุณาติดตาม CityOne LINE OA ก่อน', en: 'Follow CityOne LINE OA First' }[language]!,
    desc:      { zh: '关注后即可享受专属福利，领取卡券、参与活动、兑换积分礼品，全部畅享无阻。', th: 'หลังจากติดตาม คุณจะได้รับสิทธิพิเศษ รับคูปอง เข้าร่วมกิจกรรม แลกของรางวัล', en: 'Follow to enjoy exclusive benefits: coupons, activities, and rewards.' }[language]!,
    step1:     { zh: '① 点击下方按钮', th: '① กดปุ่มด้านล่าง', en: '① Tap the button below' }[language]!,
    step2:     { zh: '② 在弹窗中点击「加入好友」', th: '② กด "เพิ่มเพื่อน" ในป๊อปอัพ', en: '② Tap "Add Friend" in the popup' }[language]!,
    step3:     { zh: '③ 关注成功后自动继续', th: '③ ระบบจะดำเนินการต่อโดยอัตโนมัติ', en: '③ System continues automatically after following' }[language]!,
    followBtn: { zh: '关注 LINE OA 并继续', th: 'ติดตาม LINE OA แล้วดำเนินการต่อ', en: 'Follow LINE OA & Continue' }[language]!,
    backBtn:   { zh: '返回', th: 'กลับ', en: 'Back' }[language]!,
    oaBadge:   { zh: '官方认证帐号', th: 'บัญชีที่ได้รับการยืนยัน', en: 'Verified Official Account' }[language]!,
    verifying: { zh: '正在验证关注状态…', th: 'กำลังตรวจสอบ…', en: 'Verifying…' }[language]!,
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #f0fef4 0%, #e6f4ff 100%)' }}>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e8f4e8' }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ paddingLeft: 0 }}>
            {L.backBtn}
          </Button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, marginRight: 40 }}>
            {L.pageTitle}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          <div style={{ borderRadius: 20, background: '#fff', overflow: 'hidden', boxShadow: '0 2px 16px rgba(6,199,85,0.12)', border: '1px solid #d9f7be' }}>
            <div style={{ background: 'linear-gradient(135deg, #06c755 0%, #00a84e 100%)', padding: '18px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>💬</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>CityOne</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '3px 10px', borderRadius: 20 }}>
                {L.oaBadge}
              </div>
            </div>

            <div style={{ padding: '20px 20px 24px' }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: '#1a1a1a' }}>{L.headline}</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 16 }}>{L.desc}</div>

              {name && (
                <div style={{ background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)', border: '1px solid #ffd591', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ad6800' }}>
                  🎯 {name}
                </div>
              )}

              <div style={{ background: '#f6ffed', border: '1px solid #d9f7be', borderRadius: 14, padding: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#389e0d', marginBottom: 10 }}>
                  {{ zh: '操作步骤', th: 'ขั้นตอน', en: 'Steps' }[language]}
                </div>
                {[L.step1, L.step2, L.step3].map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.9 }}>{s}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', background: 'rgba(240,254,244,0.95)', borderTop: '1px solid #e8f4e8', backdropFilter: 'blur(8px)' }}>
          <Button
            type="primary"
            size="large"
            block
            onClick={handleFollow}
            loading={checking}
            disabled={checking}
            style={{ height: 52, borderRadius: 50, fontSize: 16, fontWeight: 700, background: checking ? '#52c41a' : 'linear-gradient(135deg, #06c755, #00a84e)', border: 'none', boxShadow: '0 4px 16px rgba(6,199,85,0.35)' }}
          >
            {checking ? L.verifying : L.followBtn}
          </Button>
        </div>

      </div>
    </div>
  )
}
