// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止在 continue 页复活首页/个人中心 fallback 或页面自执行业务动作。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { consumePendingIntent, decodePendingIntentPayload } from '../../lib/pendingIntent'

/**
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - ContinuePage 只负责：identity -> check-follow -> consume
 * - 不允许在这里自行计算业务身份等级
 * - 不允许失败时自动跳首页或个人中心
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const AUTO_RUN_PREFIX = 'continue:auto-run:'
const AUTO_REENTRY_COOLDOWN_MS = 4000

type ContinueStatus =
  | 'idle'
  | 'resolving_identity'
  | 'checking_follow'
  | 'waiting_follow_or_ready'
  | 'consuming'
  | 'done'
  | 'need_liff_reopen'
  | 'error'

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

function buildClaimSuccessPath(intentPayload: any, actionResult: any) {
  const rawReturnPath = String(intentPayload?.return_path || '/welfare')
  const [pathname, search = ''] = rawReturnPath.split('?')
  const params = new URLSearchParams(search)
  const userProductId = String(actionResult?.user_product?.id || actionResult?.user_product_id || '').trim()

  params.set('owned', '1')
  params.set('source', 'claim_success')
  if (userProductId) params.set('up', userProductId)

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function ContinuePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, liffChecked, inLineClient } = useLiff()
  const isLineWebView = /Line\/\d/i.test(navigator.userAgent)
  const isLiffBrowser = /LIFF/i.test(navigator.userAgent)
  const inLineContext = inLineClient || isLineWebView

  const [status, setStatus] = useState<ContinueStatus>('idle')
  const [errorText, setErrorText] = useState('')

  const inFlightRef = useRef(false)
  const consumedRef = useRef(false)
  const mountedRef = useRef(true)

  const intentToken = searchParams.get('intent') || ''
  const intentPayload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])

  const returnPath = String(intentPayload?.return_path || '/welfare')
  const failPath = String(intentPayload?.fail_path || returnPath)
  const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(intentToken)}`
  const followConfirmPath = `/welfare/follow-confirm?intent=${encodeURIComponent(intentToken)}`
  const autoRunKey = `${AUTO_RUN_PREFIX}${intentToken}`

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!intentPayload) return
    console.info('[follow-flow] continue_processing_enter', {
      intent_id: intentPayload.intent_id || '',
      action_type: intentPayload.action || '',
    })
  }, [intentPayload])

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
    const deadline = Date.now() + 1500
    while (Date.now() < deadline) {
      const state = useLineUserStore.getState()
      const canonicalUserId = state.canonicalUserId || state.profile?.lineUserId || ''
      const lineUserId = state.profile?.lineUserId || ''
      if (canonicalUserId && lineUserId) {
        return { canonicalUserId, lineUserId }
      }
      await sleep(60)
    }

    const state = useLineUserStore.getState()
    return {
      canonicalUserId: state.canonicalUserId || state.profile?.lineUserId || '',
      lineUserId: state.profile?.lineUserId || '',
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
      navigate(openInLinePath, { replace: true })
      return
    }

    if (!liffReady) {
      if (isLiffBrowser) {
        setErrorText('LINE 初始化失败，请重新在 LINE 中打开福利中心')
        setStatus('need_liff_reopen')
        return
      }
      setErrorText('请先完成 LINE 登录，再继续当前操作')
      setStatus('error')
      return
    }

    inFlightRef.current = true

    try {
      setStatus('resolving_identity')
      const identity = await waitForIdentityReady()
      if (!mountedRef.current) return

      if (!identity.canonicalUserId || !identity.lineUserId) {
        if (isLiffBrowser) {
          setErrorText('LINE 初始化失败，请重新在 LINE 中打开福利中心')
          setStatus('need_liff_reopen')
          return
        }
        setErrorText('当前 LINE 身份尚未建立')
        setStatus('error')
        return
      }

      setStatus('checking_follow')
      const followed = await checkFollow(identity.canonicalUserId)
      if (!mountedRef.current) return

      if (!followed) {
        setStatus('waiting_follow_or_ready')
        const liff = getLiff()
        const canTryRequest = liff && typeof liff.requestFriendship === 'function'
        if (!canTryRequest) {
          clearAutoRunLock()
          navigate(followConfirmPath, { replace: true })
          return
        }

        let userAccepted = false
        try {
          await liff.requestFriendship()
          userAccepted = true
        } catch {}

        if (!userAccepted) {
          clearAutoRunLock()
          navigate(followConfirmPath, { replace: true })
          return
        }

        try {
          const friendship = await liff.getFriendship()
          if (friendship?.friendFlag === true) {
            useLineUserStore.getState().setIsFriend(true)
          }
        } catch {}

        const delays = [200, 600, 1500]
        let backendFollowed = false
        for (const ms of delays) {
          await sleep(ms)
          if (!mountedRef.current) return
          try {
            if (await checkFollow(identity.canonicalUserId)) {
              backendFollowed = true
              break
            }
          } catch {}
        }

        if (!backendFollowed) {
          clearAutoRunLock()
          navigate(followConfirmPath, { replace: true })
          return
        }
      }

      consumedRef.current = true
      setStatus('consuming')

      const consumed = await consumePendingIntent({
        token: intentToken,
        userId: identity.canonicalUserId,
        lineUserId: identity.lineUserId,
      })
      if (!mountedRef.current) return

      const nextPath =
        consumed?.payload?.action === 'claim_coupon'
          ? buildClaimSuccessPath(consumed?.payload || intentPayload, consumed?.result?.action_result)
          : String(consumed?.result?.nextPath || consumed?.payload?.success_path || consumed?.payload?.return_path || returnPath)

      console.info('[follow-flow] consume_success', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        result_code: consumed?.result?.resultCode || '',
        next_path: nextPath,
      })

      clearAutoRunLock()
      setStatus('done')
      window.location.assign(nextPath)
    } catch (err: any) {
      if (!mountedRef.current) return
      consumedRef.current = false
      console.info('[follow-flow] consume_fail', {
        intent_id: intentPayload?.intent_id || '',
        action_type: intentPayload?.action || '',
        error: err?.message || '继续当前操作失败',
      })
      setErrorText(err?.message || '继续原操作失败')
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [
    clearAutoRunLock,
    followConfirmPath,
    inLineContext,
    intentPayload,
    intentToken,
    isLiffBrowser,
    liffReady,
    navigate,
    openInLinePath,
    returnPath,
    waitForIdentityReady,
  ])

  useEffect(() => {
    if (!intentToken || !intentPayload || !liffChecked) return
    if (hitAutoRunCooldown()) return
    setAutoRunLock()
    void runFlow()
  }, [hitAutoRunCooldown, intentPayload, intentToken, liffChecked, runFlow, setAutoRunLock])

  const handleRetry = async () => {
    clearAutoRunLock()
    consumedRef.current = false
    inFlightRef.current = false
    await runFlow()
  }

  if (status === 'idle' || status === 'resolving_identity' || status === 'checking_follow' || status === 'waiting_follow_or_ready' || status === 'consuming') {
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
            系统正在确认 LINE 身份、关注状态，并自动继续当前操作。
          </div>
        </div>
      </div>
    )
  }

  if (status === 'need_liff_reopen') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>请重新在 LINE 中打开</div>
          <div style={{ color: '#666', marginBottom: 16 }}>当前 LINE 初始化失败，请重新在 LINE 中打开福利中心后继续当前操作。</div>
          <button
            onClick={() => window.location.assign(openInLinePath)}
            style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            重新在 LINE 中打开
          </button>
          <button
            onClick={() => window.location.assign(failPath || returnPath)}
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
              window.location.assign(failPath || returnPath)
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
