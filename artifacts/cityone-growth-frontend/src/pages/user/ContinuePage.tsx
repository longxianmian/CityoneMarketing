// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止在 continue 页复活首页/个人中心 fallback 或页面自执行业务动作。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Spin } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiff } from '../../providers/LiffProvider'
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

type ContinueStatus =
  | 'idle'
  | 'resolving_identity'
  | 'checking_follow'
  | 'waiting_follow_or_ready'
  | 'consuming'
  | 'done'
  | 'error'

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

function buildClaimSuccessPath(
  intentPayload: any,
  actionResult: any
) {
  const rawReturnPath = String(intentPayload?.return_path || '/welfare')
  const [pathname, search = ''] = rawReturnPath.split('?')
  const params = new URLSearchParams(search)
  const userProductId = String(
    actionResult?.user_product?.id ||
      actionResult?.user_product_id ||
      ''
  ).trim()

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

  const waitForIdentityReady = useCallback(async () => {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const state = useLineUserStore.getState()
      const canonicalUserId = state.canonicalUserId || state.profile?.lineUserId || ''
      const lineUserId = state.profile?.lineUserId || ''
      if (canonicalUserId && lineUserId) {
        return { canonicalUserId, lineUserId }
      }
      await sleep(120)
    }
    const state = useLineUserStore.getState()
    return {
      canonicalUserId: state.canonicalUserId || state.profile?.lineUserId || '',
      lineUserId: state.profile?.lineUserId || '',
    }
  }, [])

  const runFlow = useCallback(async () => {
    if (!intentToken || inFlightRef.current || consumedRef.current || !mountedRef.current) return
    inFlightRef.current = true
    try {
      if (!intentPayload) {
        setErrorText('待恢复动作无效或已损坏')
        setStatus('error')
        return
      }

      setStatus('resolving_identity')
      const identity = await waitForIdentityReady()
      if (!mountedRef.current) return

      if (!identity.canonicalUserId || !identity.lineUserId) {
        navigate(openInLinePath, { replace: true })
        return
      }

      setStatus('checking_follow')
      const followed = await checkFollow(identity.canonicalUserId)
      if (!mountedRef.current) return

      if (!followed) {
        if (!inLineClient || !liffReady) {
          navigate(openInLinePath, { replace: true })
          return
        }
        setStatus('waiting_follow_or_ready')
        navigate(followConfirmPath, { replace: true })
        return
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
          ? buildClaimSuccessPath(
              consumed?.payload || intentPayload,
              consumed?.result?.action_result
            )
          : String(
              consumed?.result?.nextPath ||
                consumed?.payload?.success_path ||
                consumed?.payload?.return_path ||
                returnPath
            )

      console.info('[follow-flow] consume_success', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        result_code: consumed?.result?.resultCode || '',
        next_path: nextPath,
      })
      console.info('[follow-flow] claim_success_route', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        next_path: nextPath,
      })

      setStatus('done')
      navigate(nextPath, {
        replace: true,
        state: { followResumeResult: consumed?.result?.action_result || null },
      })
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
    inLineClient,
    intentPayload,
    intentToken,
    liffReady,
    navigate,
    openInLinePath,
    waitForIdentityReady,
  ])

  useEffect(() => {
    if (!intentToken || !liffChecked) return
    void runFlow()
  }, [intentToken, liffChecked, runFlow])

  if (status === 'idle' || status === 'resolving_identity' || status === 'checking_follow' || status === 'consuming') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', padding: 24 }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
          <Spin size="large" />
          <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>正在继续当前领取操作</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginTop: 10 }}>
            系统正在确认 LINE 身份并继续后续步骤，请稍候。
          </div>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>继续当前操作失败</div>
          <div style={{ color: '#666', marginBottom: 16 }}>{errorText || '当前步骤未能完成，你可以重试，或返回当前详情页重新发起。'}</div>
          <Button type="primary" block onClick={() => void runFlow()}>
            重试
          </Button>
          <Button style={{ marginTop: 12 }} block onClick={() => navigate(failPath || returnPath, { replace: true })}>
            返回当前详情页
          </Button>
        </Card>
      </div>
    )
  }

  return null
}
