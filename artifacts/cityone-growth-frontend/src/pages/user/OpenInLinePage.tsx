// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'

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
  const [searchParams] = useSearchParams()
  const { inLineClient } = useLiff()
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, getRuntimeLineConfig().liffId)
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`

  React.useEffect(() => {
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [payload?.action, payload?.intent_id])

  const handleOpenInLine = () => {
    if (!intentToken) return
    console.info('[follow-flow] open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: inLineClient ? '/welfare/continue?intent=...' : 'liff:/continue?intent=...',
    })
    if (inLineClient) {
      window.location.assign(continuePath)
      return
    }
    if (!liffUrl) return
    window.location.href = liffUrl
  }

  const followDisabled = (!liffUrl && !inLineClient) || !intentToken

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
            disabled={followDisabled}
            onClick={handleOpenInLine}
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 999,
              border: 'none',
              background: followDisabled ? '#a7e9d0' : '#10b981',
              color: '#fff',
              fontSize: 17,
              fontWeight: 700,
              cursor: followDisabled ? 'not-allowed' : 'pointer',
              boxShadow: followDisabled ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}
          >
            关注并继续
          </button>
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
            onClick={() => navigate(returnPath)}
          >
            返回详情页
          </button>
        </div>
      </div>
    </div>
  )
}
