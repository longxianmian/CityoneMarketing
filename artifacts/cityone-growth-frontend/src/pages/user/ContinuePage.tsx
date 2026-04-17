import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Spin, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { getRuntimeLineConfig } from '../../lib/line'
import { consumePendingIntent } from '../../lib/pendingIntent'

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
  const [status, setStatus] = useState<'loading' | 'follow' | 'done' | 'error'>('loading')
  const [errorText, setErrorText] = useState('')

  const intentToken = searchParams.get('intent') || ''
  const effectiveUserId = canonicalUserId || profile?.lineUserId || ''
  const lineUserId = profile?.lineUserId || ''
  const lineConfig = useMemo(() => getRuntimeLineConfig(), [])

  const consume = useCallback(async () => {
    if (!intentToken || !effectiveUserId) return
    const result = await consumePendingIntent({
      token: intentToken,
      userId: effectiveUserId,
      lineUserId,
    })
    const redirectPath = result?.result?.redirect_path || '/welfare'
    setStatus('done')
    navigate(redirectPath, { replace: true, state: { followResumeResult: result.result?.action_result || null } })
  }, [effectiveUserId, intentToken, lineUserId, navigate])

  const reconcile = useCallback(async () => {
    if (!intentToken) {
      setErrorText('缺少待恢复动作')
      setStatus('error')
      return
    }
    if (!liffChecked) return
    if (!effectiveUserId) {
      setErrorText('尚未建立 LINE 身份，请稍后重试')
      setStatus('error')
      return
    }
    try {
      setStatus('loading')
      const followed = await checkFollow(effectiveUserId)
      if (!followed) {
        setStatus('follow')
        return
      }
      await consume()
    } catch (err: any) {
      setErrorText(err?.message || '继续原操作失败')
      setStatus('error')
    }
  }, [consume, effectiveUserId, intentToken, liffChecked])

  useEffect(() => {
    void reconcile()
  }, [reconcile])

  useEffect(() => {
    if (status !== 'follow') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void reconcile()
      }
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reconcile, status])

  const handleFollowContinue = async () => {
    if (liffReady && inLineClient) {
      const liff = getLiff()
      if (liff?.requestFriendship) {
        try {
          await liff.requestFriendship()
        } catch {}
        void reconcile()
        return
      }
    }

    if (lineConfig.officialAccountId) {
      window.location.href = `line://ti/p/${lineConfig.officialAccountId}`
      return
    }

    message.error('LINE OA 未完成正式配置')
  }

  if (status === 'loading') {
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
