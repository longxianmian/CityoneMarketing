// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import {
  buildRuntimeLiffUrlWithPath,
  buildRuntimeLineSchemeUrlWithPath,
  getRuntimeLineConfig,
} from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'

/**
 * 强约束（2026-04-20 重构 v3）：
 * - 外部浏览器是进入 LINE 的前置引导层，不是失败页
 * - 不允许把"当前会话未识别到 LINE 身份"表达成"未注册/请先注册"
 * - 不允许在此页自动跳 /welfare 或 /mine
 *
 * 设计要点：
 * 这个页面只表达一个用户意图："我同意关注 CityOne LINE 官方账号 + 继续业务"。
 * 不向用户暴露任何技术动作（"用 LINE 打开"、"扫码"、"添加好友"），
 * 所有"如何关注 / 如何恢复身份 / 如何执行业务"的复杂度由下游 ContinuePage 接管。
 *
 * 点击"关注并继续"的行为按场景区分（用户无感知）：
 * - LINE 内 WebView：client-side navigate 到 /welfare/continue（已经在 LIFF 容器内，
 *   直接走 ContinuePage，避免跳 liffUrl 触发自指死循环）
 * - 外部浏览器：跳 liffUrl，LINE 平台 Universal Link 拉起 LINE app → LIFF /continue
 *
 * ContinuePage 的职责（已有）：
 * - 恢复 LINE 身份（LIFF login）
 * - 检查 isFriend：已关注 → consume intent；未关注 → 引导用户在 LINE 内点加好友
 * - 完成后回到本页自动 consume + 跳 success
 *
 * LINE 平台硬约束：H5 不能静默替用户关注 OA。"关注"必须用户在 LINE app 内手动点
 * "加为好友"。"关注并继续"按钮的语义是"用户表态愿意关注 + 系统送他到 LINE 内完成"。
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
  // line:// scheme 兜底（已安装 LINE 时直接被系统拦截拉起 LINE app）
  const lineSchemeUrl = buildRuntimeLineSchemeUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, lineCfg.liffId)
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
      branch: isExternalBrowser ? 'external' : 'in_line',
      has_liff_url: !!liffUrl,
    })
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineClient,
    })
  }, [payload?.action, payload?.intent_id, inLineClient, isExternalBrowser, liffUrl])

  const handleFollowAndContinue = () => {
    if (!intentToken) return
    if (isExternalBrowser) {
      // 外部浏览器：跳 liffUrl，LINE 平台拉起 LINE app
      if (!liffUrl) return
      clientLog('follow_and_continue_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        branch: 'external',
        target: 'liff_url',
      })
      window.location.href = liffUrl
      return
    }
    // LINE 内：直接 client-side navigate，避免跳 liffUrl 自指死循环
    clientLog('follow_and_continue_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      branch: 'in_line',
      target: '/welfare/continue',
    })
    navigate(continuePath, { replace: true })
  }

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
            onClick={handleFollowAndContinue}
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
            onClick={handleBackToDetail}
          >
            返回详情页
          </button>
          {/* URL scheme 兜底链接：当 https Universal Link 在某些设备/浏览器拉不起 LINE app
              时（部分 Android 国行/Chromium 内嵌浏览器/iOS Safari 拒绝 Universal Link 时），
              用户可点这条 line:// scheme 直接由系统拉起 LINE。桌面浏览器无 LINE 时点击
              不会有反应，所以放在主按钮下方作为辅助。 */}
          {isExternalBrowser && lineSchemeUrl ? (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <a
                href={lineSchemeUrl}
                onClick={() => {
                  clientLog('open_in_line_scheme_click', {
                    intent_id: payload?.intent_id || '',
                    action_type: payload?.action || '',
                    branch: 'external',
                    target: 'line_scheme',
                  })
                }}
                style={{
                  fontSize: 13,
                  color: '#10b981',
                  textDecoration: 'underline',
                }}
              >
                如未自动跳转，点这里在 LINE 中打开
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
