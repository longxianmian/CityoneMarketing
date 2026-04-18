// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把关注确认页改回首页 fallback 或技术报错页。
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'

/**
 * 强约束：
 * - 仅未关注用户进入此页
 * - 完成关注后，必须自动回到 /welfare/continue?intent=...
 * - 不允许从这里回首页或个人中心
 */

export default function FollowConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, inLineClient } = useLiff()
  const [submitting, setSubmitting] = useState(false)

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`

  useEffect(() => {
    console.info('[follow-flow] follow_confirm_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [payload?.action, payload?.intent_id])

  const handleConfirm = async () => {
    const liff = getLiff()
    setSubmitting(true)
    try {
      if (inLineClient && liffReady && liff?.requestFriendship) {
        await liff.requestFriendship()
      }
      console.info('[follow-flow] follow_confirm_success', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
      })
      navigate(continuePath, { replace: true })
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请先关注 LINE OA</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          当前领取操作需要先完成 LINE OA 关注确认。关注完成后，系统会自动继续当前领取步骤，不需要重新返回详情页再次点击。
        </div>
        <Button type="primary" size="large" block loading={submitting} onClick={handleConfirm}>
          关注 LINE OA 并继续
        </Button>
        <Button style={{ marginTop: 12 }} block disabled={submitting} onClick={() => navigate(returnPath, { replace: true })}>
          返回当前详情页
        </Button>
      </Card>
    </div>
  )
}
