import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Spin, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { getRuntimeLineConfig, resolveRuntimeLiffUrl } from '../../lib/line'
import { consumePendingIntent, decodePendingIntentPayload } from '../../lib/pendingIntent'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

export default function ContinuePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, liffChecked, inLineClient } = useLiff()
  const profile = useLineUserStore((s) => s.profile)
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const [status, setStatus] = useState<'idle' | 'resolving_identity' | 'checking_follow' | 'waiting_follow_or_ready' | 'consuming' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const startedRef = useRef(false)
  const singleFlightRef = useRef(false)
  const followRetryRef = useRef(false)

  const intentToken = searchParams.get('intent') || ''
  const effectiveUserId = canonicalUserId || profile?.lineUserId || ''
  const lineUserId = profile?.lineUserId || ''
  const lineConfig = useMemo(() => getRuntimeLineConfig(), [])
  const intentPayload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(intentPayload?.return_path || '/welfare')
  const fallbackPath = String(intentPayload?.back_path || returnPath || '/welfare')

  const consume = useCallback(async () => {
    if (!intentToken || !effectiveUserId) return
    setStatus('consuming')
    const result = await consumePendingIntent({
      token: intentToken,
      userId: effectiveUserId,
      lineUserId,
    })
    const redirectPath =
      result?.result?.next_path ||
      result?.result?.redirect_path ||
      result?.payload?.return_path ||
      returnPath ||
      fallbackPath ||
      '/welfare'
    setStatus('done')
    navigate(redirectPath, { replace: true, state: { followResumeResult: result.result?.action_result || null } })
  }, [effectiveUserId, fallbackPath, intentToken, lineUserId, navigate, returnPath])

  const runFlow = useCallback(async () => {
    if (singleFlightRef.current) return
    singleFlightRef.current = true
    if (!intentToken) {
      setErrorText('缺少待恢复动作')
      setStatus('error')
      singleFlightRef.current = false
      return
    }
    if (!liffChecked) return
    if (!effectiveUserId) {
      setStatus('resolving_identity')
      setErrorText('尚未建立 LINE 身份，请稍后重试')
      setStatus('error')
      singleFlightRef.current = false
      return
    }
    try {
      setStatus('checking_follow')
      const followed = await checkFollow(effectiveUserId)
      if (!followed) {
        setStatus('waiting_follow_or_ready')
        return
      }
      await consume()
    } catch (err: any) {
      setErrorText(err?.message || '继续原操作失败')
      setStatus('error')
    } finally {
      singleFlightRef.current = false
    }
  }, [consume, effectiveUserId, intentToken, liffChecked])

  useEffect(() => {
    if (!liffChecked || startedRef.current) return
    startedRef.current = true
    void runFlow()
  }, [liffChecked, runFlow])

  const handleFollowContinue = async () => {
    if (liffReady && inLineClient) {
      const liff = getLiff()
      if (liff?.requestFriendship) {
        try {
          await liff.requestFriendship()
        } catch {}
        if (!followRetryRef.current) {
          followRetryRef.current = true
          await runFlow()
        }
        return
      }
    }

    const liffUrl = resolveRuntimeLiffUrl(lineConfig.liffId)
    if (liffUrl) {
      window.location.href = `${liffUrl}/welfare/continue?intent=${encodeURIComponent(intentToken)}`
      return
    }

    if (lineConfig.officialAccountId) {
      window.location.href = `line://ti/p/${lineConfig.officialAccountId}`
      return
    }

    message.error('LINE OA 未完成正式配置')
  }

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
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>恢复原操作失败</div>
          <div style={{ color: '#666', marginBottom: 16 }}>{errorText || '请返回福利中心重试'}</div>
          <Button type="primary" onClick={() => navigate('/welfare', { replace: true })}>返回福利中心</Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fef4', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>需先关注 CityOne LINE OA</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          关注后系统会自动继续刚才的操作。
        </div>
        <Button type="primary" size="large" block onClick={handleFollowContinue}>
          关注 LINE OA 并继续
        </Button>
        <Button style={{ marginTop: 12 }} block onClick={() => navigate('/welfare', { replace: true })}>
          稍后再说
        </Button>
      </Card>
    </div>
  )
}
