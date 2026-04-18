import React, { useMemo } from 'react'
import { Button, Card } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { getRuntimeLineConfig, resolveRuntimeLiffUrl } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { resetCurrentIdentitySession } from '../../lib/identitySession'

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

  const handleResetIdentity = () => {
    resetCurrentIdentitySession()
    const target = returnPath || '/welfare'
    window.location.assign(target)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前会话尚未识别到 LINE 身份</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          请在 LINE 内继续完成身份识别。
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
        <Button style={{ marginTop: 12 }} block onClick={handleResetIdentity}>
          重新识别 LINE 身份
        </Button>
        <Button style={{ marginTop: 12 }} block onClick={() => navigate(returnPath, { replace: true })}>
          返回原详情页
        </Button>
      </Card>
    </div>
  )
}
