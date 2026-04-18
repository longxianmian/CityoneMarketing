import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Spin } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { consumePendingIntent, decodePendingIntentPayload } from '../../lib/pendingIntent'

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
  const successPath = String(intentPayload?.success_path || returnPath)
  const failPath = String(intentPayload?.fail_path || returnPath)
  const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(intentToken)}`

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!intentPayload) return
    console.info('[follow-flow] continue_enter', {
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
        consumed?.result?.nextPath ||
        consumed?.payload?.success_path ||
        successPath ||
        consumed?.payload?.return_path ||
        returnPath

      console.info('[follow-flow] consume_success', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        result_code: consumed?.result?.resultCode || '',
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
    returnPath,
    successPath,
    waitForIdentityReady,
  ])

  useEffect(() => {
    if (!intentToken || !liffChecked) return
    void runFlow()
  }, [intentToken, liffChecked, runFlow])

  const handleFollowContinue = useCallback(async () => {
    const liff = getLiff()
    if (!inLineClient || !liffReady || !liff?.requestFriendship) {
      navigate(openInLinePath, { replace: true })
      return
    }

    try {
      await liff.requestFriendship()
    } catch {
      // keep the user on the same continue page and let the next follow check decide
    }
    await runFlow()
  }, [inLineClient, liffReady, navigate, openInLinePath, runFlow])

  if (status === 'idle' || status === 'resolving_identity' || status === 'checking_follow' || status === 'consuming') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>继续当前操作失败</div>
          <div style={{ color: '#666', marginBottom: 16 }}>{errorText || '请稍后重试，或返回原页面重新发起。'}</div>
          <Button type="primary" block onClick={() => void runFlow()}>
            重试
          </Button>
          <Button style={{ marginTop: 12 }} block onClick={() => navigate(failPath || returnPath, { replace: true })}>
            返回原页面
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fef4', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请先完成 LINE OA 关注确认</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          完成关注后，系统会自动继续当前操作，不需要重新返回首页查找入口。
        </div>
        <Button type="primary" size="large" block onClick={handleFollowContinue}>
          关注 LINE OA 并继续
        </Button>
        <Button style={{ marginTop: 12 }} block onClick={() => navigate(failPath || returnPath, { replace: true })}>
          返回原页面
        </Button>
      </Card>
    </div>
  )
}
