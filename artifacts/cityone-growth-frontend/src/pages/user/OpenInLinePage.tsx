import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import {
  buildResumeLaunchTargets,
  getRuntimeLineConfig,
  isDesktopBrowser,
} from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'

const WAIT_MS = 1500

export default function OpenInLinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { inLineContext } = useLiff()
  const [opening, setOpening] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const stageRef = useRef<'idle' | 'liff' | 'scheme' | 'done'>('idle')

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const tokenValid = !!intentToken && !!payload
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const cfg = getRuntimeLineConfig()
  const { resumeLiffUrl } = buildResumeLaunchTargets(
    intentToken,
    cfg.liffId,
    cfg.officialAccountId,
  )
  const desktop = isDesktopBrowser()
  const handoffReturned = searchParams.get('handoff') === 'returned'
  const qrContinueUrl = useMemo(() => {
    return resumeLiffUrl || continuePath
  }, [continuePath, resumeLiffUrl])

  useEffect(() => {
    clientLog('open_in_line_view', {
      intent_id: payload?.intent_id || '',
      token_valid: tokenValid,
      in_line_context: inLineContext,
      is_desktop: desktop,
      handoff_returned: handoffReturned,
    })
    if (tokenValid && inLineContext) {
      navigate(continuePath, { replace: true })
    }
  }, [
    continuePath,
    desktop,
    handoffReturned,
    inLineContext,
    navigate,
    payload?.intent_id,
    tokenValid,
  ])

  useEffect(() => {
    if (!desktop || !qrContinueUrl) {
      setQrDataUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(qrContinueUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [desktop, qrContinueUrl])

  const handleOpen = (ev?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (opening || !tokenValid || desktop || !resumeLiffUrl) {
      ev?.preventDefault()
      return
    }
    setOpening(true)
    clientLog('open_in_line_primary_click', {
      intent_id: payload?.intent_id || '',
      primary_launch_url: 'resume-liff-url',
    })

    const markDone = () => {
      stageRef.current = 'done'
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') markDone()
    }
    const clearListeners = () => {
      window.removeEventListener('blur', markDone)
      window.removeEventListener('pagehide', markDone)
      document.removeEventListener('visibilitychange', onHidden)
    }
    window.addEventListener('blur', markDone, { once: true })
    window.addEventListener('pagehide', markDone, { once: true })
    document.addEventListener('visibilitychange', onHidden)

    stageRef.current = 'liff'
    ev?.preventDefault()
    window.location.assign(resumeLiffUrl)
    window.setTimeout(() => {
      if (stageRef.current === 'done') {
        clearListeners()
        return
      }
      clearListeners()
      setOpening(false)
    }, WAIT_MS)
  }

  if (!tokenValid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前操作已失效</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
            当前继续令牌无效或已过期，请返回福利中心重新发起操作。
          </div>
          <button
            onClick={() => navigate('/welfare', { replace: true })}
            style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            返回福利中心
          </button>
        </div>
      </div>
    )
  }

  if (desktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请用手机 LINE App 扫码继续</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
            当前设备无法直接唤起 LINE App，请用手机上的 LINE 扫描下方二维码继续当前操作。
          </div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="请用手机 LINE App 扫码继续" style={{ width: 220, height: 220, borderRadius: 16, border: '1px solid #e5e7eb', padding: 12, background: '#fff' }} />
          ) : (
            <div style={{ color: '#888', fontSize: 13 }}>二维码生成失败，请改用手机直接打开本页。</div>
          )}
        </div>
      </div>
    )
  }

  const title = handoffReturned ? '请继续打开 LINE' : '请在 LINE 中继续'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{title}</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
          当前操作需要在 LINE App 内继续处理。进入 LINE 后，系统会自动恢复刚才的当前操作，再继续完成身份识别与业务流程。
        </div>
        <a
          href={resumeLiffUrl || '#'}
          onClick={handleOpen}
          aria-disabled={opening || !resumeLiffUrl}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 999,
            border: 'none',
            background: opening ? '#9fdcc6' : '#12b981',
            color: '#fff',
            fontWeight: 700,
            cursor: opening || !resumeLiffUrl ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            pointerEvents: opening || !resumeLiffUrl ? 'none' : 'auto',
          }}
        >
          {opening ? '正在尝试打开 LINE...' : '打开 LINE 继续'}
        </a>
        <div style={{ marginTop: 14, color: '#888', fontSize: 13 }}>
          如未自动跳转，请再次点击按钮继续。
        </div>
      </div>
    </div>
  )
}
