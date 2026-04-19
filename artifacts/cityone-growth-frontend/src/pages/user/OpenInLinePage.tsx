// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../../lib/line'
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
 *
 * 设计要点（2026-04-20 重构）：
 * 桌面浏览器 → 显示 LIFF URL 二维码，让用户用手机 LINE 扫码（一步到位拉起 LINE app）
 * 手机外部浏览器 → "用 LINE 打开本页"按钮，点击跳 liffUrl 拉起 LINE app
 * LINE 内 WebView → 不应到达此页（由 ContinuePage 处理）；万一到达则提供"继续"按钮
 *
 * 不再在 H5 内引导用户"添加 LINE 好友"——加好友这件事让用户进入 LINE app 后自然完成。
 */

const LOGO_URL = `${import.meta.env.BASE_URL}cityone-logo.webp`

function detectUaKind(): 'mobile' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}

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

  const uaKind = useMemo(detectUaKind, [])
  const isExternalBrowser = !inLineClient
  // 三分支判断
  const showDesktopQr = isExternalBrowser && uaKind === 'desktop'
  const showMobileOpenInLine = isExternalBrowser && uaKind === 'mobile'
  const showInLineContinue = !isExternalBrowser

  // 桌面 QR：内容为 liffUrl，用户手机扫后直接拉起 LINE app
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrError, setQrError] = useState<string>('')
  useEffect(() => {
    if (!showDesktopQr || !liffUrl) return
    let cancelled = false
    QRCode.toDataURL(liffUrl, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrDataUrl(url) })
      .catch((err) => { if (!cancelled) setQrError(String(err?.message || err)) })
    return () => { cancelled = true }
  }, [showDesktopQr, liffUrl])

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
      ua_kind: uaKind,
      branch: showDesktopQr ? 'desktop_qr' : showMobileOpenInLine ? 'mobile_open_in_line' : 'in_line_continue',
      has_liff_url: !!liffUrl,
    })
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      ua_kind: uaKind,
      in_line_client: inLineClient,
    })
  }, [payload?.action, payload?.intent_id, inLineClient, uaKind, showDesktopQr, showMobileOpenInLine, liffUrl])

  const handlePrimary = () => {
    if (!intentToken) return
    if (showMobileOpenInLine) {
      // 手机外部浏览器：跳 liffUrl 拉起 LINE app（Universal Link）
      if (!liffUrl) return
      clientLog('open_in_line_external_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        ua_kind: uaKind,
        target: 'liff_url',
      })
      window.location.href = liffUrl
      return
    }
    if (showInLineContinue) {
      // LINE 内：直接跳 continue 路由让 LiffProvider 接管
      clientLog('open_in_line_click', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        target: '/welfare/continue?intent=...',
      })
      window.location.assign(continuePath)
    }
  }

  // 主按钮文案
  const primaryLabel = showInLineContinue ? '继续' : '用 LINE 打开本页'
  const primaryDisabled = showDesktopQr || !intentToken || (showMobileOpenInLine && !liffUrl)

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
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1.4,
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            {showDesktopQr ? '请用手机 LINE 扫码继续' : '请在 LINE 中继续操作'}
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 15,
              lineHeight: 1.7,
              color: '#666',
            }}
          >
            {showDesktopQr
              ? '本页面需要在 LINE App 内完成。用你手机的 LINE 扫描下方二维码即可继续。'
              : showMobileOpenInLine
                ? '点击下方按钮在 LINE App 中打开本页面，继续后续流程。'
                : '已识别到 LINE 环境，点击继续即可。'}
          </p>
        </div>

        {/* 桌面 QR 区 */}
        {showDesktopQr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0' }}>
            <div
              style={{
                padding: 16,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="LINE 二维码" width={240} height={240} style={{ display: 'block' }} />
              ) : qrError ? (
                <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c00', fontSize: 12, padding: 12, textAlign: 'center' }}>
                  二维码生成失败：{qrError}
                </div>
              ) : (
                <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>
                  正在生成二维码…
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.6 }}>
              扫码后会在你手机的 LINE 中打开本页面
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8, marginTop: showDesktopQr ? 8 : 32 }}>
          {!showDesktopQr && (
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
