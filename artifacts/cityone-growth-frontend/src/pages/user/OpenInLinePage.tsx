import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { buildLiffContinueUrl, isDesktopBrowser } from '../../lib/line'
import { fetchPendingIntent, type PendingIntentRecord } from '../../lib/pendingIntent'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'

const WAIT_MS = 1500

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        {children}
      </div>
    </div>
  )
}

export default function OpenInLinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { inLineContext } = useLiff()
  const [intent, setIntent] = useState<PendingIntentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [opening, setOpening] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showContinueFallback, setShowContinueFallback] = useState(false)
  const stageRef = useRef<'idle' | 'liff' | 'done'>('idle')

  const intentId = useMemo(() => String(searchParams.get('intent') || '').trim(), [searchParams])
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentId)}`
  const continueLiffUrl = useMemo(() => buildLiffContinueUrl(intentId), [intentId])
  const desktop = isDesktopBrowser()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorText('')
    setIntent(null)

    if (!intentId) {
      setLoading(false)
      setErrorText('缺少 intent_id，无法继续当前操作。')
      return
    }

    void fetchPendingIntent(intentId)
      .then((record) => {
        if (cancelled) return
        setIntent(record)
        setLoading(false)
      })
      .catch((err: any) => {
        if (cancelled) return
        setErrorText(err?.message || '当前操作不存在或已失效。')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [intentId])

  useEffect(() => {
    clientLog('open_in_line_view', {
      intent_id: intentId,
      intent_status: intent?.status || '',
      in_line_context: inLineContext,
      is_desktop: desktop,
      has_error: !!errorText,
    })
    if (intentId && inLineContext) {
      navigate(continuePath, { replace: true })
    }
  }, [continuePath, desktop, errorText, inLineContext, intent?.status, intentId, navigate])

  useEffect(() => {
    if (!desktop || !continueLiffUrl) {
      setQrDataUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(continueLiffUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [continueLiffUrl, desktop])

  const handleOpenLine = (ev?: React.MouseEvent<HTMLAnchorElement>) => {
    if (opening || !intentId || desktop || !continueLiffUrl) {
      ev?.preventDefault()
      return
    }

    setOpening(true)
    setShowContinueFallback(false)
    stageRef.current = 'liff'
    clientLog('open_in_line_primary_click', {
      intent_id: intentId,
      redirect_to: continueLiffUrl,
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

    window.setTimeout(() => {
      if (stageRef.current === 'done') {
        clearListeners()
        return
      }
      clearListeners()
      setOpening(false)
      setShowContinueFallback(true)
    }, WAIT_MS)
  }

  if (loading) {
    return (
      <CardShell>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>正在读取当前任务</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>请稍候，系统正在确认本次操作仍然有效。</div>
      </CardShell>
    )
  }

  if (desktop) {
    return (
      <CardShell>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请用手机 LINE App 扫码继续</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
          当前设备无法直接完成 LINE 身份恢复，请用手机上的 LINE 扫描下方二维码继续当前操作。
        </div>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="请用手机 LINE App 扫码继续" style={{ width: 220, height: 220, borderRadius: 16, border: '1px solid #e5e7eb', padding: 12, background: '#fff' }} />
        ) : (
          <div style={{ color: '#888', fontSize: 13 }}>二维码生成失败，请改用手机直接打开本页。</div>
        )}
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>
        {errorText ? '继续当前操作失败' : '请在 LINE 中继续'}
      </div>
      <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
        {errorText || '当前操作需要在 LINE 环境内继续处理。进入 LINE 后，系统会自动恢复当前任务并继续后续步骤。'}
      </div>
      <a
        href={continueLiffUrl || '#'}
        onClick={handleOpenLine}
        aria-disabled={opening || !continueLiffUrl}
        style={{
          width: '100%',
          height: 48,
          borderRadius: 999,
          border: 'none',
          background: opening ? '#9fdcc6' : '#12b981',
          color: '#fff',
          fontWeight: 700,
          cursor: opening || !continueLiffUrl ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          pointerEvents: opening || !continueLiffUrl ? 'none' : 'auto',
        }}
      >
        {opening ? '正在尝试打开 LINE...' : '打开 LINE 继续'}
      </a>
      <button
        onClick={() => navigate(continuePath, { replace: true })}
        style={{ width: '100%', height: 48, marginTop: 12, borderRadius: 999, border: '1px solid #12b981', background: '#fff', color: '#12b981', fontWeight: 800, cursor: 'pointer' }}
      >
        在当前页面继续恢复任务
      </button>
      {showContinueFallback ? (
        <div style={{ marginTop: 14, color: '#888', fontSize: 13 }}>
          如果没有成功进入 LINE，请先点击上方按钮再次尝试，或使用当前页面继续恢复同一个任务。
        </div>
      ) : (
        <div style={{ marginTop: 14, color: '#888', fontSize: 13 }}>
          如未自动跳转，请再次点击按钮继续。
        </div>
      )}
    </CardShell>
  )
}
