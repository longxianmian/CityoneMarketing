// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'

/**
 * 强约束（2026-04-20 重构）：
 * - 外部浏览器是进入 LINE 的前置引导层，不是失败页
 * - 不允许把"当前会话未识别到 LINE 身份"表达成"未注册/请先注册"
 * - 不允许在此页自动跳 /welfare 或 /mine
 *
 * 设计要点：
 * - 不区分桌面/手机 UA（UA 检测不可靠，且手机用户不可能扫自己屏幕上的二维码）
 * - 所有外部浏览器场景统一一个动作：跳 liffUrl 让 LINE 平台 / LINE app 自己处理
 *   - 手机：Universal Link 拉起 LINE app → LIFF /continue → 身份恢复 → 业务执行
 *   - 桌面：LINE 平台自己引导（极少数场景）
 * - 不引导用户先关注 OA 再回来。加好友这件事让用户进入 LINE app 后由 ContinuePage
 *   在 isFriend === false 时再处理。
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

  const lineCfg = getRuntimeLineConfig()
  const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, lineCfg.liffId)
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`

  const isExternalBrowser = !inLineClient

  // 返回详情页：优先用浏览器后退，避免 history 里又 push 一条详情页副本
  const handleBackToDetail = () => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(returnPath, { replace: true })
    }
  }

  useEffect(() => {
    clientLog('open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineClient,
      branch: isExternalBrowser ? 'external_open_in_line' : 'in_line_continue',
      has_liff_url: !!liffUrl,
    })
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineClient,
    })
  }, [payload?.action, payload?.intent_id, inLineClient, isExternalBrowser, liffUrl])

  const handlePrimary = () => {
    if (!intentToken) return
    if (isExternalBrowser) {
      // 外部浏览器：跳 liffUrl 让 LINE 平台接管（手机会拉起 LINE app）
      if (!liffUrl) return
      clientLog('open_in_line_external_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        target: 'liff_url',
      })
      window.location.href = liffUrl
      return
    }
    // LINE 内：直接跳 continue 路由让 LiffProvider 接管
    clientLog('open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: '/welfare/continue?intent=...',
    })
    window.location.assign(continuePath)
  }

  const primaryLabel = isExternalBrowser ? '用 LINE 打开本页' : '继续'
  const primaryDisabled = !intentToken || (isExternalBrowser && !liffUrl)

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
            请在 LINE 中继续操作
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 16,
              lineHeight: 1.8,
              color: '#666',
            }}
          >
            点击下方按钮在 LINE App 中打开本页面，
            <br />
            完成后续流程（领取卡券 / 参与活动等）。
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
