import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import { buildOaAddFriendUrl, getRuntimeLineConfig, setRuntimeLineConfig } from '../../lib/line'
import { fetchPendingIntent, type PendingIntentRecord } from '../../lib/pendingIntent'
import { clientLog } from '../../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const REDIRECT_GUARD_PREFIX = '_cityone_redirect_guard_v1:'
const REDIRECT_GUARD_LIMIT = 3
const FRIENDSHIP_POLL_MS = 2500

type IdentitySyncResult = {
  user_id: string
  line_user_id: string
}

type FollowPageStatus =
  | 'idle'
  | 'loading_intent'
  | 'probing_friendship'
  | 'waiting_follow'
  | 'redirecting'
  | 'expired'
  | 'failed'

function readRedirectCount(intentId: string) {
  try {
    const raw = sessionStorage.getItem(`${REDIRECT_GUARD_PREFIX}${intentId}`)
    const parsed = raw ? JSON.parse(raw) as { count?: number } : null
    return Number(parsed?.count || 0)
  } catch {
    return 0
  }
}

function markRedirect(intentId: string, route: string) {
  const count = readRedirectCount(intentId) + 1
  try {
    sessionStorage.setItem(
      `${REDIRECT_GUARD_PREFIX}${intentId}`,
      JSON.stringify({ count, route, ts: Date.now() }),
    )
  } catch {
    // ignore
  }
  if (count > REDIRECT_GUARD_LIMIT) {
    clientLog('CITYONE_REDIRECT_GUARD_STOP', {
      intent_id: intentId,
      redirect_to: route,
      count,
      error_code: 'redirect_guard_exceeded',
    })
    return false
  }
  return true
}

async function syncIdentityWithBackend(intentId: string, idToken: string) {
  const res = await fetch(`${API_BASE}/api/line/identity/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent_id: intentId, id_token: idToken }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || 'LINE 身份识别失败')
  }
  return json.data as IdentitySyncResult
}

async function recordFriendship(params: {
  intentId: string
  userId: string
  lineUserId: string
  friendFlag: boolean
}) {
  const res = await fetch(`${API_BASE}/api/line/friendship/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent_id: params.intentId,
      user_id: params.userId,
      line_user_id: params.lineUserId,
      friendFlag: params.friendFlag,
      source: 'liff',
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || 'LINE 关注状态记录失败')
  }
  return json.data as { is_fan: boolean; source?: string }
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        {children}
      </div>
    </div>
  )
}

export default function FollowRequiredPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffChecked, inLineContext } = useLiff()
  const [runtimeCfg, setRuntimeCfgState] = useState(() => getRuntimeLineConfig())
  const [intent, setIntent] = useState<PendingIntentRecord | null>(null)
  const [status, setStatus] = useState<FollowPageStatus>('idle')
  const [errorText, setErrorText] = useState('')
  const [opening, setOpening] = useState(false)
  const [awaitingFollow, setAwaitingFollow] = useState(false)

  const mountedRef = useRef(true)
  const probeInFlightRef = useRef(false)
  const identityRef = useRef<IdentitySyncResult | null>(null)
  const lastFriendFlagRef = useRef<boolean | null>(null)

  const intentId = useMemo(() => String(searchParams.get('intent') || '').trim(), [searchParams])
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentId)}`
  const oaAddFriendUrl = buildOaAddFriendUrl(runtimeCfg.officialAccountId)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (runtimeCfg.channelId && runtimeCfg.officialAccountId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/growth/line/config`)
        const json = await res.json()
        if (cancelled) return
        setRuntimeLineConfig(json?.data || null)
        setRuntimeCfgState(getRuntimeLineConfig())
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runtimeCfg.channelId, runtimeCfg.officialAccountId])

  useEffect(() => {
    let cancelled = false
    setStatus('loading_intent')
    setErrorText('')
    setIntent(null)
    setAwaitingFollow(false)
    identityRef.current = null
    lastFriendFlagRef.current = null

    if (!intentId) {
      setStatus('failed')
      setErrorText('缺少 intent_id，无法继续当前关注确认。')
      return
    }

    void fetchPendingIntent(intentId)
      .then((record) => {
        if (cancelled) return
        setIntent(record)
        if (record.status === 'expired') {
          setStatus('expired')
          return
        }
        if (record.status === 'failed') {
          setStatus('failed')
          setErrorText(record.last_error || '当前操作已失效，请返回详情页重新发起。')
          return
        }
        setStatus('waiting_follow')
      })
      .catch((err: any) => {
        if (cancelled) return
        setStatus('failed')
        setErrorText(err?.message || '当前操作不存在或已失效。')
      })

    return () => {
      cancelled = true
    }
  }, [intentId])

  useEffect(() => {
    clientLog('follow_required_view', {
      intent_id: intentId,
      intent_status: intent?.status || '',
      in_line_context: inLineContext,
    })
  }, [inLineContext, intent?.status, intentId])

  const navigateToContinue = useCallback((source: string) => {
    if (!intentId) return
    if (!markRedirect(intentId, continuePath)) {
      setStatus('failed')
      setErrorText('当前关注确认流程跳转次数过多，系统已停止自动跳转以避免死循环。')
      return
    }
    clientLog('follow_required_auto_resume', {
      intent_id: intentId,
      source,
      redirect_to: continuePath,
    })
    setStatus('redirecting')
    navigate(continuePath, { replace: true })
  }, [continuePath, intentId, navigate])

  const probeFriendship = useCallback(async (reason: string) => {
    if (!intentId || !liffChecked || probeInFlightRef.current) return

    const liff = getLiff()
    if (!liff || typeof liff.isLoggedIn !== 'function' || typeof liff.getFriendship !== 'function') {
      return
    }
    if (!liff.isLoggedIn()) {
      return
    }

    probeInFlightRef.current = true
    if (mountedRef.current) {
      setStatus((current) => (current === 'redirecting' ? current : 'probing_friendship'))
    }

    try {
      let identity = identityRef.current
      if (!identity) {
        const idToken = typeof liff.getIDToken === 'function' ? liff.getIDToken() : ''
        if (!idToken) {
          throw new Error('LINE ID Token 获取失败，无法继续当前关注确认。')
        }
        identity = await syncIdentityWithBackend(intentId, idToken)
        identityRef.current = identity
      }

      const friendship = await liff.getFriendship()
      const friendFlag = friendship?.friendFlag === true

      if (lastFriendFlagRef.current !== friendFlag || reason !== 'poll') {
        await recordFriendship({
          intentId,
          userId: identity.user_id,
          lineUserId: identity.line_user_id,
          friendFlag,
        })
        lastFriendFlagRef.current = friendFlag
      }

      clientLog('follow_required_friendship_probe', {
        intent_id: intentId,
        reason,
        friendFlag,
      })

      if (!mountedRef.current) return
      setErrorText('')
      if (friendFlag) {
        navigateToContinue(reason)
        return
      }
      setStatus('waiting_follow')
    } catch (err: any) {
      clientLog('follow_required_friendship_probe_failed', {
        intent_id: intentId,
        reason,
        error: err?.message || 'unknown',
      })
      if (!mountedRef.current) return
      setStatus('waiting_follow')
      if (reason !== 'poll') {
        setErrorText(err?.message || '当前环境暂时无法确认关注状态，请稍后重试。')
      }
    } finally {
      probeInFlightRef.current = false
    }
  }, [intentId, liffChecked, navigateToContinue])

  useEffect(() => {
    if (!intentId || !intent || status === 'expired' || status === 'failed') return
    if (intent.status === 'consumed') {
      navigateToContinue('already_consumed')
      return
    }
    if (!liffChecked) return

    void probeFriendship('initial')
    const intervalId = window.setInterval(() => {
      void probeFriendship('poll')
    }, FRIENDSHIP_POLL_MS)
    const handleFocus = () => {
      void probeFriendship('focus')
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void probeFriendship('visible')
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [intent, intentId, liffChecked, navigateToContinue, probeFriendship, status])

  const handleOpenFriendship = async () => {
    if (opening || !intentId) return
    setOpening(true)
    setAwaitingFollow(true)
    setErrorText('')
    try {
      const liff = getLiff()
      clientLog('follow_required_open_click', {
        intent_id: intentId,
        in_line_context: inLineContext,
        has_request_friendship: typeof liff?.requestFriendship === 'function',
      })
      if (liff && typeof liff.requestFriendship === 'function') {
        await liff.requestFriendship()
      } else if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      } else {
        setErrorText('当前未检测到可用的关注入口，请检查 LINE OA 配置。')
      }
      void probeFriendship('after_open')
    } catch (err: any) {
      clientLog('follow_required_request_friendship_failed', {
        intent_id: intentId,
        error: err?.message || 'unknown',
      })
      if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      }
      setErrorText('关注面板打开失败，请稍后重试。')
    } finally {
      setOpening(false)
    }
  }

  if (status === 'loading_intent' || status === 'idle') {
    return (
      <CardShell>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>正在读取当前任务</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>请稍候，系统正在确认本次操作仍然有效。</div>
      </CardShell>
    )
  }

  if (status === 'expired') {
    return (
      <CardShell>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前操作已过期</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>
          当前 pending intent 已超过可恢复时限，请返回详情页重新发起同一个操作。
        </div>
      </CardShell>
    )
  }

  if (status === 'failed') {
    return (
      <CardShell>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前操作已失效</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>{errorText || '当前操作无法继续，请返回详情页重新发起。'}</div>
      </CardShell>
    )
  }

  const isChecking = status === 'probing_friendship'
  const description = awaitingFollow
    ? '关注完成后，系统会自动检测当前任务并继续处理，无需再手动点击“我已关注，继续”。如果没有成功拉起关注面板，可以再次点击按钮。'
    : '当前操作需要先完成 CityOne LINE 官方账号关注确认。点击下方按钮后，系统会自动检测关注状态并继续同一个 intent。'

  return (
    <CardShell>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>请先关注官方账号</div>
      <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
        {description}
      </div>
      {isChecking ? (
        <div style={{ color: '#0f766e', fontSize: 13, marginBottom: 12 }}>
          系统正在确认关注状态，请稍候。
        </div>
      ) : null}
      {errorText ? (
        <div style={{ color: '#b45309', fontSize: 13, marginBottom: 12 }}>{errorText}</div>
      ) : null}
      <button
        onClick={() => void handleOpenFriendship()}
        disabled={opening}
        style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: opening ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 800, cursor: opening ? 'not-allowed' : 'pointer' }}
      >
        {opening ? '正在打开关注入口...' : '关注 CityOne LINE 官方账号并继续'}
      </button>
      <div style={{ marginTop: 14, color: '#888', fontSize: 13, lineHeight: 1.7 }}>
        {inLineContext
          ? '完成关注后系统会自动回到继续页并恢复同一个任务。'
          : '当前页面也会持续检测关注状态；如需更稳定的恢复体验，建议在 LINE 内继续。'}
      </div>
    </CardShell>
  )
}
