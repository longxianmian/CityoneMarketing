// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildOaAddFriendUrl, buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'

/**
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - 外部浏览器是进入 LINE 的前置引导层，不是失败页
 * - 不允许把"当前会话未识别到 LINE 身份"表达成"未注册/请先注册"
 * - 不允许在此页自动跳 /welfare 或 /mine
 */

const LOGO_URL = `${import.meta.env.BASE_URL}cityone-logo.webp`

export default function OpenInLinePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { inLineClient } = useLiff()
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')

  // 返回详情页：优先用浏览器后退，避免在 history 里又 push 一条详情页副本
  // 副作用是详情页左上角的"再返回"会回到本页(open-in-line)而不是 /welfare。
  // 仅在用户直接以 URL 打开本页(location.key === 'default')时才 replace 跳。
  const handleBackToDetail = () => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(returnPath, { replace: true })
    }
  }
  const lineCfg = getRuntimeLineConfig()
  const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, lineCfg.liffId)
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const oaAddFriendUrl = buildOaAddFriendUrl(lineCfg.officialAccountId)
  // 是否走外部浏览器分支（非 LINE in-app）。inLineClient=false 即代表外部浏览器，
  // LIFF 在外部浏览器里点击会被 LINE 平台 redirect 回 LIFF endpoint，造成
  // ContinuePage→OpenInLinePage 死循环；正确做法是直接跳 OA 加好友直链拉起 LINE app。
  const isExternalBrowser = !inLineClient

  React.useEffect(() => {
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
    clientLog('open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineClient,
      has_oa_url: !!oaAddFriendUrl,
      has_liff_url: !!liffUrl,
    })
  }, [payload?.action, payload?.intent_id, inLineClient, oaAddFriendUrl, liffUrl])

  const handlePrimary = () => {
    if (!intentToken) return
    if (isExternalBrowser) {
      // 外部浏览器：直接拉起 LINE app 进 OA 加好友页。OA basicId 缺失时降级回 LIFF
      // （走死循环也比按钮无反馈强；同时上报 fallback 标记便于诊断）。
      const target = oaAddFriendUrl || liffUrl
      clientLog('oa_add_friend_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        target_kind: oaAddFriendUrl ? 'oa_direct' : (liffUrl ? 'liff_fallback' : 'none'),
      })
      console.info('[follow-flow] oa_add_friend_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        target_kind: oaAddFriendUrl ? 'oa_direct' : 'liff_fallback',
      })
      if (!target) return
      window.location.href = target
      return
    }
    // LINE 内：LIFF 已 ready，直接跳 continue 路由让 LiffProvider 接管身份恢复
    clientLog('open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: '/welfare/continue?intent=...',
    })
    console.info('[follow-flow] open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: '/welfare/continue?intent=...',
    })
    window.location.assign(continuePath)
  }

  // 主按钮文案/可用性：外部浏览器走 OA 加好友直链；LINE 内沿用"关注并继续"
  const primaryLabel = isExternalBrowser ? '添加 LINE 好友' : '关注并继续'
  const primaryDisabled = isExternalBrowser
    ? (!oaAddFriendUrl && !liffUrl) || !intentToken
    : !intentToken

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      {/* 绿色顶部 brand 区 */}
      <div
        style={{
          background: '#10b981',
          color: '#fff',
          padding: '48px 28px 36px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <img
            src={LOGO_URL}
            alt="CityOne 图标"
            style={{ width: 56, height: 56, objectFit: 'contain' }}
          />
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1 }}>
          CityOne
        </div>
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            官方认证账号
          </span>
        </div>
      </div>

      {/* 内容区 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '32px 32px 40px',
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', paddingTop: 32 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.35,
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            请关注 CityOne LINE
            <br />
            官方账号
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 16,
              lineHeight: 1.8,
              color: '#666',
            }}
          >
            关注后即可继续领取卡券、参与活动或进入后续流程。
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8, marginTop: 32 }}>
          <button
            disabled={primaryDisabled}
            onClick={handlePrimary}
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 999,
              border: 'none',
              background: primaryDisabled ? '#a7e9d0' : '#10b981',
              color: '#fff',
              fontSize: 17,
              fontWeight: 700,
              cursor: primaryDisabled ? 'not-allowed' : 'pointer',
              boxShadow: primaryDisabled ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}
          >
            {primaryLabel}
          </button>
          {isExternalBrowser && (
            <p style={{ margin: '8px 4px 0', fontSize: 12, lineHeight: 1.6, color: '#888', textAlign: 'center' }}>
              点击后会打开 LINE App 进入 CityOne 官方账号加好友页。<br />
              加好友完成后请回到本页继续操作。
            </p>
          )}
          <button
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 999,
              border: '1px solid #d4d4d4',
              background: '#fff',
              color: '#222',
              fontSize: 17,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={handleBackToDetail}
          >
            返回详情页
          </button>
        </div>
      </div>
    </div>
  )
}
