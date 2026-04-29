import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import {
  consumePendingIntent,
  fetchPendingIntent,
  type PendingIntentRecord,
} from '../../lib/pendingIntent'
import { clientLog } from '../../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const REDIRECT_GUARD_PREFIX = '_cityone_redirect_guard_v1:'
const CONSUME_SINGLEFLIGHT_PREFIX = '_cityone_consume_singleflight_v1:'
const REDIRECT_GUARD_LIMIT = 3

type ContinueStatus =
  | 'idle'
  | 'loading_intent'
  | 'resolving_identity'
  | 'checking_friendship'
  | 'consuming'
  | 'completed'
  | 'expired'
  | 'error'

type IdentitySyncResult = {
  user_id: string
  line_user_id: string
  identity_level?: string
  is_fan?: boolean
}

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
    console.warn('CITYONE_REDIRECT_GUARD_STOP', {
      intent_id: intentId,
      redirect_to: route,
      count,
      error_code: 'redirect_guard_exceeded',
    })
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

function clearRedirectGuard(intentId: string) {
  try {
    sessionStorage.removeItem(`${REDIRECT_GUARD_PREFIX}${intentId}`)
  } catch {
    // ignore
  }
}

function clearConsumeSingleflight(intentId: string) {
  try {
    sessionStorage.removeItem(`${CONSUME_SINGLEFLIGHT_PREFIX}${intentId}`)
  } catch {
    // ignore
  }
}

function markConsumeSingleflight(intentId: string) {
  try {
    const key = `${CONSUME_SINGLEFLIGHT_PREFIX}${intentId}`
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    return true
  }
}

function resolveResultPath(intent: PendingIntentRecord | null, result: any) {
  const direct = String(result?.redirect_url || result?.nextPath || result?.next_path || '').trim()
  if (direct) return direct
  const source = String(intent?.source_url || '').trim()
  return source || ''
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
  return json.data as { is_fan: boolean; source?: string; checked_at?: string }
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', background: '#fff', padding: '28px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        margin: '0 auto',
        borderRadius: '50%',
        border: '3px solid rgba(44, 219, 206, 0.18)',
        borderTopColor: '#2cdbce',
        animation: 'boot-spin 0.8s linear infinite',
      }}
    />
  )
}

type ContinuePageProps = {
  intentTokenOverride?: string
}

export default function ContinuePage({
  intentTokenOverride = '',
}: ContinuePageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffChecked, inLineContext } = useLiff()
  const [status, setStatus] = useState<ContinueStatus>('idle')
  const [errorText, setErrorText] = useState('')
  const [intent, setIntent] = useState<PendingIntentRecord | null>(null)
  const [result, setResult] = useState<any>(null)
  const startedRef = useRef('')
  const mountedRef = useRef(true)

  const intentId = useMemo(
    () => String(intentTokenOverride || searchParams.get('intent') || '').trim(),
    [intentTokenOverride, searchParams],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fail = useCallback((message: string, extra?: Record<string, any>) => {
    console.warn('CITYONE_INTENT_FAILED', {
      intent_id: intentId,
      error_code: extra?.error_code || 'frontend_error',
      ...extra,
    })
    clientLog('CITYONE_INTENT_FAILED', {
      intent_id: intentId,
      error_code: extra?.error_code || 'frontend_error',
      ...extra,
    })
    setErrorText(message)
    setStatus('error')
  }, [intentId])

  const runFlow = useCallback(async () => {
    if (!intentId) {
      fail('缺少 intent_id，无法继续当前操作。', {
        error_code: 'missing_intent_id',
      })
      return
    }
    if (!liffChecked) return
    if (startedRef.current === intentId) return
    startedRef.current = intentId

    try {
      setStatus('loading_intent')
      const currentIntent = await fetchPendingIntent(intentId)
      if (!mountedRef.current) return
      setIntent(currentIntent)

      if (currentIntent.status === 'consumed') {
        clearRedirectGuard(intentId)
        clearConsumeSingleflight(intentId)
        setResult(currentIntent.result || {})
        setStatus('completed')
        return
      }
      if (currentIntent.status === 'expired') {
        console.info('CITYONE_INTENT_EXPIRED', { intent_id: intentId, intent_status: currentIntent.status })
        setStatus('expired')
        return
      }
      if (currentIntent.status === 'failed') {
        fail(currentIntent.last_error || '当前操作此前已失败，请返回详情页重新发起。', {
          error_code: 'intent_failed',
          intent_status: currentIntent.status,
        })
        return
      }

      const liff = getLiff()
      if (!liff || typeof liff.isLoggedIn !== 'function') {
        fail('LIFF 初始化失败，当前环境暂时无法识别 LINE 身份。', { error_code: 'liff_not_ready' })
        return
      }

      console.info('CITYONE_LIFF_INIT', {
        intent_id: intentId,
        liff_context: inLineContext ? 'line_client' : 'external_browser',
        logged_in: liff.isLoggedIn(),
      })

      if (!liff.isLoggedIn()) {
        if (typeof liff.login === 'function') {
          liff.login({ redirectUri: window.location.href })
          return
        }
        fail('当前环境无法启动 LINE 登录。', { error_code: 'liff_login_unavailable' })
        return
      }

      setStatus('resolving_identity')
      const idToken = typeof liff.getIDToken === 'function' ? liff.getIDToken() : ''
      if (!idToken) {
        if (typeof liff.login === 'function') {
          liff.login({ redirectUri: window.location.href })
          return
        }
        fail('LINE ID Token 获取失败，无法完成身份识别。', { error_code: 'missing_id_token' })
        return
      }

      const identity = await syncIdentityWithBackend(intentId, idToken)
      if (!mountedRef.current) return
      console.info('CITYONE_IDENTITY_SYNCED', {
        intent_id: intentId,
        user_id: identity.user_id,
        line_user_id: identity.line_user_id,
        identity_level: identity.identity_level,
      })

      setStatus('checking_friendship')
      if (typeof liff.getFriendship !== 'function') {
        fail('当前 LIFF 环境不支持关注状态校验，请检查 LINE Channel 与 OA 绑定。', {
          error_code: 'friendship_api_unavailable',
        })
        return
      }
      const friendship = await liff.getFriendship()
      const friendFlag = friendship?.friendFlag === true
      const friendshipResult = await recordFriendship({
        intentId,
        userId: identity.user_id,
        lineUserId: identity.line_user_id,
        friendFlag,
      })
      if (!mountedRef.current) return
      console.info('CITYONE_FRIENDSHIP_CHECKED', {
        intent_id: intentId,
        user_id: identity.user_id,
        line_user_id: identity.line_user_id,
        friendFlag,
        source: friendshipResult.source || 'liff',
      })

      if (!friendFlag) {
        const followPath = `/welfare/follow-required?intent=${encodeURIComponent(intentId)}`
        console.info('CITYONE_FOLLOW_REQUIRED', {
          intent_id: intentId,
          user_id: identity.user_id,
          line_user_id: identity.line_user_id,
          redirect_to: followPath,
        })
        if (!markRedirect(intentId, followPath)) {
          fail('当前关注确认流程跳转次数过多，系统已停止自动跳转以避免死循环。', {
            error_code: 'redirect_guard_exceeded',
          })
          return
        }
        navigate(followPath, { replace: true })
        return
      }

      if (!markConsumeSingleflight(intentId)) {
        setStatus('consuming')
        return
      }

      setStatus('consuming')
      console.info('CITYONE_INTENT_CONSUME_START', {
        intent_id: intentId,
        user_id: identity.user_id,
        line_user_id: identity.line_user_id,
        intent_status: currentIntent.status,
      })
      const consumed = await consumePendingIntent({
        intentId,
        consumeKey: `consume:${intentId}`,
        userId: identity.user_id,
        lineUserId: identity.line_user_id,
      })
      if (!mountedRef.current) return

      if (consumed.result?.error === true) {
        clearConsumeSingleflight(intentId)
        fail(consumed.result.message || '当前操作执行失败。', {
          error_code: consumed.result.code || 'consume_failed',
        })
        return
      }

      clearRedirectGuard(intentId)
      clearConsumeSingleflight(intentId)
      setResult(consumed.result || {})
      setStatus('completed')
      console.info('CITYONE_INTENT_CONSUME_SUCCESS', {
        intent_id: intentId,
        user_id: identity.user_id,
        line_user_id: identity.line_user_id,
        consume_result: consumed.result?.resultCode || 'ok',
        replayed: consumed.replayed === true,
      })
    } catch (err: any) {
      clearConsumeSingleflight(intentId)
        fail(err?.message || '继续当前操作失败。', { error_code: 'continue_flow_error' })
    }
  }, [fail, inLineContext, intentId, liffChecked, navigate])

  useEffect(() => {
    void runFlow()
  }, [runFlow])

  const resultPath = resolveResultPath(intent, result)

  if (
    status === 'idle' ||
    status === 'loading_intent' ||
    status === 'resolving_identity' ||
    status === 'checking_friendship' ||
    status === 'consuming'
  ) {
    return (
      <CardShell>
        <Spinner />
        <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800 }}>正在继续处理</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginTop: 10 }}>
          系统正在识别当前 LINE 身份，并判断是否已关注官方账号。
        </div>
      </CardShell>
    )
  }

  if (status === 'completed') {
    return (
      <CardShell>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>当前操作已完成</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
          系统已完成本次业务处理，同一个任务不会重复执行。
        </div>
        {resultPath ? (
          <button
            onClick={() => window.location.assign(resultPath)}
            style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
          >
            查看结果
          </button>
        ) : null}
      </CardShell>
    )
  }

  if (status === 'expired') {
    return (
      <CardShell>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>当前操作已过期</div>
        <div style={{ color: '#666', lineHeight: 1.8 }}>
          该任务已超过有效期。请返回原详情页重新发起，不会自动跳回首页。
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>继续当前操作失败</div>
      <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
        {errorText || '当前步骤未能完成，请稍后重试。'}
      </div>
      <button
        onClick={() => {
          startedRef.current = ''
          clearConsumeSingleflight(intentId)
          void runFlow()
        }}
        style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
      >
        重试
      </button>
      {intent?.source_url ? (
        <button
          onClick={() => window.location.assign(intent.source_url || '')}
          style={{ width: '100%', height: 48, marginTop: 12, borderRadius: 999, border: '1px solid #d9d9d9', background: '#fff', color: '#222', fontWeight: 700, cursor: 'pointer' }}
        >
          返回当前详情页
        </button>
      ) : null}
    </CardShell>
  )
}
