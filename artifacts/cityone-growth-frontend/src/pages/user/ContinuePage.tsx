// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止在 continue 页复活首页/个人中心 fallback 或页面自执行业务动作。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiff, getLiff, syncLiffFriendshipIdentity } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { consumePendingIntent, decodePendingIntentPayload } from '../../lib/pendingIntent'
import { resolvePendingIntentNextPath } from '../../lib/pendingIntentResult'
import { clientLog } from '../../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const AUTO_RUN_PREFIX = 'continue:auto-run:'
const AUTO_REENTRY_COOLDOWN_MS = 4000
const EXTERNAL_CONTEXT_SETTLE_MS = 2200
const IN_LINE_LOGIN_GRACE_MS = 1800

type ContinueStatus =
  | 'idle'
  | 'resolving_identity'
  | 'checking_follow'
  | 'consuming'
  | 'done'
  | 'need_line_login'
  | 'error'

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

async function registerFanTruth(params: {
  userId: string
  lineUserId: string
  displayName?: string
  pictureUrl?: string
}) {
  const { userId, lineUserId, displayName = '', pictureUrl = '' } = params
  if (!userId || !lineUserId) return false

  const res = await fetch(`${API_BASE}/api/user/set-fan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_picture_url: pictureUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok && json?.code === 200
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readSdkLoggedIn() {
  try {
    const liff = getLiff()
    if (!liff || typeof liff.isLoggedIn !== 'function') return false
    return liff.isLoggedIn() === true
  } catch {
    return false
  }
}

function resolveInternalNavigationTarget(target: string) {
  const raw = String(target || '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return raw.startsWith('/') ? raw : null
  }
}

function canUseCallbackShellNavigate(target: string) {
  const pathname = resolveInternalNavigationTarget(target)
  if (!pathname) return false
  return (
    pathname === '/welfare' ||
    pathname.startsWith('/welfare?') ||
    pathname.startsWith('/welfare/continue') ||
    pathname.startsWith('/welfare/follow-confirm')
  )
}

type ContinuePageProps = {
  intentTokenOverride?: string
}

export default function ContinuePage({ intentTokenOverride = '' }: ContinuePageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, liffChecked, inLineContext } = useLiff()

  const [status, setStatus] = useState<ContinueStatus>('idle')
  const [errorText, setErrorText] = useState('')
  const [contextWatchElapsed, setContextWatchElapsed] = useState(false)

  const inFlightRef = useRef(false)
  const consumedRef = useRef(false)
  const mountedRef = useRef(true)
  const mountedAtRef = useRef(Date.now())

  const intentToken = String(intentTokenOverride || searchParams.get('intent') || '')
  const intentPayload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])

  const returnPath = String(intentPayload?.return_path || '/welfare')
  const failPath = String(intentPayload?.fail_path || returnPath)
  const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(intentToken)}`
  const followConfirmPath = `/welfare/follow-confirm?intent=${encodeURIComponent(intentToken)}`
  const autoRunKey = `${AUTO_RUN_PREFIX}${intentToken}`
  const internalFailPath = useMemo(
    () => resolveInternalNavigationTarget(failPath || returnPath),
    [failPath, returnPath]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    mountedAtRef.current = Date.now()
    setContextWatchElapsed(false)
  }, [intentToken])

  useEffect(() => {
    if (!intentPayload) return
    console.info('[follow-flow] continue_processing_enter', {
      intent_id: intentPayload.intent_id || '',
      action_type: intentPayload.action || '',
      in_line_context: inLineContext,
      liff_ready: liffReady,
      liff_checked: liffChecked,
    })
  }, [intentPayload, inLineContext, liffReady, liffChecked])

  const clearAutoRunLock = useCallback(() => {
    if (!intentToken) return
    sessionStorage.removeItem(autoRunKey)
  }, [autoRunKey, intentToken])

  const setAutoRunLock = useCallback(() => {
    if (!intentToken) return
    sessionStorage.setItem(autoRunKey, String(Date.now()))
  }, [autoRunKey, intentToken])

  const hitAutoRunCooldown = useCallback(() => {
    if (!intentToken) return false
    const raw = sessionStorage.getItem(autoRunKey)
    const ts = Number(raw || 0)
    if (!ts) return false
    return Date.now() - ts < AUTO_REENTRY_COOLDOWN_MS
  }, [autoRunKey, intentToken])

  const waitForIdentityReady = useCallback(async () => {
    const deadline = Date.now() + 1600
    while (Date.now() < deadline) {
      const state = useLineUserStore.getState()
      const canonicalUserId = state.canonicalUserId || state.profile?.lineUserId || ''
      const lineUserId = state.profile?.lineUserId || ''
      if (canonicalUserId && lineUserId) {
        return { canonicalUserId, lineUserId, isFriend: state.profile?.isFriend }
      }
      await sleep(60)
    }

    if (inLineContext && (liffReady || readSdkLoggedIn())) {
      try {
        const refreshed = await syncLiffFriendshipIdentity()
        return {
          canonicalUserId: refreshed?.canonicalUserId || '',
          lineUserId: refreshed?.lineUserId || '',
          isFriend: refreshed?.isFriend,
        }
      } catch {
        // ignore
      }
    }

    const state = useLineUserStore.getState()
    return {
      canonicalUserId: state.canonicalUserId || state.profile?.lineUserId || '',
      lineUserId: state.profile?.lineUserId || '',
      isFriend: state.profile?.isFriend,
    }
  }, [inLineContext, liffReady])

  const handleExplicitLineLogin = useCallback(() => {
    try {
      const liff = getLiff()
      if (liff && typeof liff.login === 'function') {
        liff.login({ redirectUri: window.location.href })
        return
      }
      setErrorText('当前环境无法拉起 LINE 登录，请返回详情页重试')
      setStatus('error')
    } catch (err: any) {
      setErrorText(err?.message || '拉起 LINE 登录失败，请返回详情页重试')
      setStatus('error')
    }
  }, [])

  const runFlow = useCallback(async () => {
    if (!mountedRef.current || !intentToken || !intentPayload) {
      setErrorText('待恢复动作无效或已损坏')
      setStatus('error')
      return
    }
    if (inFlightRef.current || consumedRef.current) return

    if (!inLineContext) {
      clientLog('continue_missing_line_context', {
        intent_id: intentPayload.intent_id || '',
        action_type: intentPayload.action || '',
      })
      navigate(openInLinePath, { replace: true })
      return
    }

    inFlightRef.current = true

    try {
      setStatus('resolving_identity')
      const identity = await waitForIdentityReady()
      if (!mountedRef.current) return

      if (!identity.canonicalUserId || !identity.lineUserId) {
        if (inLineContext && Date.now() - mountedAtRef.current < IN_LINE_LOGIN_GRACE_MS) {
          clientLog('continue_identity_grace_wait', {
            intent_id: intentPayload.intent_id || '',
            action_type: intentPayload.action || '',
            elapsed_ms: Date.now() - mountedAtRef.current,
          })
          window.setTimeout(() => {
            if (!mountedRef.current || consumedRef.current) return
            clearAutoRunLock()
            void runFlow()
          }, 450)
          return
        }
        if (readSdkLoggedIn()) {
          setErrorText('LINE 身份同步超时，请稍后重试')
          setStatus('error')
          return
        }
        setErrorText('当前 LINE 身份尚未建立，请先完成 LINE 登录')
        setStatus('need_line_login')
        return
      }

      setStatus('checking_follow')
      let effectiveUserId = identity.canonicalUserId
      let followed = identity.isFriend === true

      if (followed) {
        const profile = useLineUserStore.getState().profile
        const fanSynced = await registerFanTruth({
          userId: effectiveUserId,
          lineUserId: identity.lineUserId,
          displayName: profile?.lineDisplayName || '',
          pictureUrl: profile?.linePictureUrl || '',
        }).catch(() => false)

        clientLog('continue_fan_truth_sync', {
          intent_id: intentPayload.intent_id || '',
          action_type: intentPayload.action || '',
          line_user_id: identity.lineUserId,
          canonical_user_id: effectiveUserId,
          synced: fanSynced,
        })
      } else {
        followed = await checkFollow(effectiveUserId)
      }
      if (!mountedRef.current) return

      if (!followed) {
        clearAutoRunLock()
        navigate(followConfirmPath, { replace: true })
        return
      }

      consumedRef.current = true
      setStatus('consuming')

      const consumed = await consumePendingIntent({
        token: intentToken,
        userId: effectiveUserId,
        lineUserId: identity.lineUserId,
      })
      if (!mountedRef.current) return

      if (consumed?.result?.error === true) {
        consumedRef.current = false
        const errMsg = String(
          (consumed.result as any)?.message || '原操作此前已执行失败，无法继续'
        )
        console.info('[follow-flow] consume_replay_error', {
          intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
          action_type: consumed?.payload?.action || intentPayload.action || '',
          error_code: (consumed.result as any)?.code || '',
          replayed: consumed?.replayed === true,
        })
        setErrorText(errMsg)
        setStatus('error')
        return
      }

      const nextPath = resolvePendingIntentNextPath({
        payload: consumed?.payload || intentPayload,
        result: consumed?.result,
        fallbackPath: returnPath,
      })

      console.info('[follow-flow] consume_success', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        result_code: consumed?.result?.resultCode || '',
        next_path: nextPath,
      })

      clearAutoRunLock()
      setStatus('done')
      const internalNextPath = resolveInternalNavigationTarget(nextPath)
      if (internalNextPath && canUseCallbackShellNavigate(internalNextPath)) {
        navigate(internalNextPath, { replace: true })
        return
      }
      window.location.assign(internalNextPath || nextPath)
    } catch (err: any) {
      if (!mountedRef.current) return
      consumedRef.current = false
      console.info('[follow-flow] continue_flow_fail', {
        intent_id: intentPayload?.intent_id || '',
        action_type: intentPayload?.action || '',
        error: err?.message || '继续原操作失败',
      })
      setErrorText(err?.message || '继续原操作失败')
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [
    clearAutoRunLock,
    followConfirmPath,
    openInLinePath,
    inLineContext,
    intentPayload,
    intentToken,
    liffReady,
    returnPath,
    waitForIdentityReady,
    navigate,
  ])

  useEffect(() => {
    if (!intentToken) {
      setErrorText('待恢复动作无效或已损坏')
      setStatus('error')
      return
    }
    if (!intentPayload) {
      setErrorText('待恢复动作无效或已损坏')
      setStatus('error')
    }
  }, [intentToken, intentPayload])

  useEffect(() => {
    if (inLineContext || liffChecked) {
      setContextWatchElapsed(false)
      return
    }

    const timer = window.setTimeout(() => {
      if (!mountedRef.current) return
      setContextWatchElapsed(true)
    }, EXTERNAL_CONTEXT_SETTLE_MS)

    return () => window.clearTimeout(timer)
  }, [inLineContext, liffChecked])

  useEffect(() => {
    if (!intentToken || !intentPayload || !liffChecked) return

    if (!inLineContext) {
      clientLog('continue_redirect_open_in_line', {
        intent_id: intentPayload.intent_id || '',
        action_type: intentPayload.action || '',
      })
      navigate(openInLinePath, { replace: true })
      return
    }

    if (hitAutoRunCooldown()) {
      return
    }

    setAutoRunLock()
    void runFlow()
  }, [
    hitAutoRunCooldown,
    inLineContext,
    intentPayload,
    intentToken,
    liffChecked,
    openInLinePath,
    navigate,
    runFlow,
    setAutoRunLock,
  ])

  useEffect(() => {
    if (!intentToken || !intentPayload) return
    if (inLineContext || liffChecked || !contextWatchElapsed) return

    clientLog('continue_context_watchdog_open_in_line', {
      intent_id: intentPayload.intent_id || '',
      action_type: intentPayload.action || '',
      elapsed_ms: Date.now() - mountedAtRef.current,
    })
    navigate(openInLinePath, { replace: true })
  }, [
    contextWatchElapsed,
    inLineContext,
    intentPayload,
    intentToken,
    liffChecked,
    navigate,
    openInLinePath,
  ])

  const handleRetry = async () => {
    clearAutoRunLock()
    consumedRef.current = false
    inFlightRef.current = false

    await runFlow()
  }

  if (
    status === 'idle' ||
    status === 'resolving_identity' ||
    status === 'checking_follow' ||
    status === 'consuming'
  ) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', padding: 24 }}>
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', background: '#fff', padding: '28px 24px' }}>
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
          <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>正在继续处理</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginTop: 10 }}>
            系统正在识别当前用户，并判断是否已关注 LINE 官方账号。
          </div>
        </div>
      </div>
    )
  }

  if (status === 'need_line_login') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>请先完成 LINE 登录</div>
          <div style={{ color: '#666', marginBottom: 16 }}>
            当前已进入 LINE，但尚未完成登录。请点击下方按钮登录后继续当前操作。
          </div>
          <button
            onClick={handleExplicitLineLogin}
            style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            使用 LINE 登录继续
          </button>
          <button
            onClick={() => {
              if (internalFailPath && canUseCallbackShellNavigate(internalFailPath)) {
                navigate(internalFailPath, { replace: true })
                return
              }
              window.location.assign(internalFailPath || failPath || returnPath)
            }}
            style={{ width: '100%', height: 44, marginTop: 12, borderRadius: 999, border: '1px solid #d9d9d9', background: '#fff', color: '#222', cursor: 'pointer' }}
          >
            返回当前详情页
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>继续当前操作失败</div>
          <div style={{ color: '#666', marginBottom: 16 }}>{errorText || '当前步骤未能完成，请点击重试。'}</div>
          <button
            onClick={() => void handleRetry()}
            style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            重试
          </button>
          <button
            onClick={() => {
              clearAutoRunLock()
              if (internalFailPath && canUseCallbackShellNavigate(internalFailPath)) {
                navigate(internalFailPath, { replace: true })
                return
              }
              window.location.assign(internalFailPath || failPath || returnPath)
            }}
            style={{ width: '100%', height: 44, marginTop: 12, borderRadius: 999, border: '1px solid #d9d9d9', background: '#fff', color: '#222', cursor: 'pointer' }}
          >
            返回当前详情页
          </button>
        </div>
      </div>
    )
  }

  return null
}
