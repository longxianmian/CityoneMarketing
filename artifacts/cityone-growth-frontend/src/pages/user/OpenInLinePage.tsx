import React, { useMemo } from 'react'
import { Button, Card } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { getRuntimeLineConfig, resolveRuntimeLiffUrl } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'

export default function OpenInLinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  useLiff()
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const liffUrl = resolveRuntimeLiffUrl(getRuntimeLineConfig().liffId)

  const handleOpenInLine = () => {
    if (!liffUrl || !intentToken) return
    window.location.href = `${liffUrl}/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前操作需要在 LINE 内继续</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          请使用 LINE 打开当前流程，系统会继续刚才的操作。
        </div>
        <Button
          type="primary"
          size="large"
          block
          disabled={!liffUrl || !intentToken}
          onClick={handleOpenInLine}
        >
          在 LINE 内继续
        </Button>
        <Button style={{ marginTop: 12 }} block onClick={() => navigate(returnPath, { replace: true })}>
          返回原详情页
        </Button>
      </Card>
    </div>
  )
}
