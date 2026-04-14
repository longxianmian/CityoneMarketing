/**
 * FollowOAPage — 关注 OA 拦截页
 *
 * 主链路：liff.requestFriendship() → LINE 原生弹窗 → 用户关注 → 验证 → navigate(to)
 * 全程闭环，LIFF WebView 不销毁，链路不丢。
 */
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '../../i18n'
import useLineUserStore from '../../store/lineUser'
import { useLiff, getLiff } from '../../providers/LiffProvider'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
// sessionStorage keys — 与 WelfareHomePage 恢复器共享
const SK_PENDING     = 'cityone_follow_pending'
const SK_RETURN_PATH = 'cityone_follow_return_path'
const SK_BACK_PATH   = 'cityone_follow_back_path'
const SK_ACTION      = 'cityone_follow_action'
const SK_NAME_KEY    = 'cityone_follow_name'

function clearFollowKeys() {
  sessionStorage.removeItem(SK_PENDING)
  sessionStorage.removeItem(SK_RETURN_PATH)
  sessionStorage.removeItem(SK_BACK_PATH)
  sessionStorage.removeItem(SK_ACTION)
  sessionStorage.removeItem(SK_NAME_KEY)
}

export default function FollowOAPage() {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const { language } = useI18n()
  const lineProfile  = useLineUserStore((s) => s.profile)
  const mergeProfile = useLineUserStore((s) => s.mergeProfile)
  const { liffReady } = useLiff()

  const to   = params.get('to')   || sessionStorage.getItem(SK_RETURN_PATH) || '/welfare'
  const name = params.get('name') || sessionStorage.getItem(SK_NAME_KEY) || ''
  const back = params.get('back') || sessionStorage.getItem(SK_BACK_PATH) || '/welfare'

  const [oaId, setOaId]         = useState('')
  const [checking, setChecking] = useState(false)

  // store 已确认关注 → 直接跳目标页（已关注用户不重复卡门控）
  useEffect(() => {
    if (liffReady && lineProfile?.isFriend === true) {
      clearFollowKeys()
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

  // ── 双轨链路：requestFriendship（主）+ line://（降级）────────────────────
  const handleFollow = async () => {
    // 1. 先无条件写恢复状态（无论哪条路都必须有，/welfare 恢复器依赖这些 key）
    sessionStorage.setItem(SK_PENDING, '1')
    sessionStorage.setItem(SK_RETURN_PATH, to)
    sessionStorage.setItem(SK_BACK_PATH, back)
    if (name) sessionStorage.setItem(SK_NAME_KEY, name)

    const liff = getLiff()

    // 2. liff 未就绪时，不静默 return，直接降级 line://
    if (!liff || !liffReady) {
      console.error('[FollowOAPage] liff not ready, fallback to line://')
      alert('[FollowOAPage] LIFF not ready, fallback to LINE OA')
      const id = oaId || '@cityone'
      window.location.href = `line://ti/p/${encodeURIComponent(id)}`
      return
    }

    const canRequest = liff.isApiAvailable?.('requestFriendship') === true
    console.log('[FollowOAPage] requestFriendship available =', canRequest)
    setChecking(true)

    if (canRequest) {
      // ── 主链路：requestFriendship — LINE 原生弹窗，WebView 不销毁 ──────
      try {
        await liff.requestFriendship()
        const friendship = await liff.getFriendship()
        if (!friendship.friendFlag) {
          console.log('[FollowOAPage] user did not follow')
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
        clearFollowKeys()
        navigate(to, { replace: true })
        return
      } catch (e: any) {
        console.error('[FollowOAPage] requestFriendship failed, fallback to line://', e?.code, e?.message)
        setChecking(false)
        // /welfare 恢复器将在用户返回后接管
      }
    } else {
      // requestFriendship 不可用，统一降级
      console.log('[FollowOAPage] requestFriendship not available, using line://')
      setChecking(false)
    }

    // 3. 统一降级出口：line:// 跳转，WebView 可能销毁，/welfare 恢复器接管
    const id = oaId || '@cityone'
    window.location.href = `line://ti/p/${encodeURIComponent(id)}`
  }

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
