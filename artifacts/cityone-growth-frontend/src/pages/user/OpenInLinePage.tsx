// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useMemo } from 'react'
import { Button, Card } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { resetCurrentIdentitySession } from '../../lib/identitySession'

/**
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - 外部浏览器是进入 LINE 的前置引导层，不是失败页
 * - 不允许把“当前会话未识别到 LINE 身份”表达成“未注册/请先注册”
 * - 不允许在此页自动跳 /welfare 或 /mine
 */

export default function OpenInLinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  useLiff()
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, getRuntimeLineConfig().liffId)

  React.useEffect(() => {
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [payload?.action, payload?.intent_id])

  const handleOpenInLine = () => {
    if (!liffUrl || !intentToken) return
    console.info('[follow-flow] open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: '/welfare/continue',
    })
    window.location.href = liffUrl
  }

  const handleResetIdentity = () => {
    resetCurrentIdentitySession()
    const target = returnPath || '/welfare'
    window.location.assign(target)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请在 LINE 内继续完成身份识别</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          当前操作需要在 LINE 内继续完成，返回原详情页后可重新发起。
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
        <Button style={{ marginTop: 12 }} block onClick={handleResetIdentity}>
          重新识别 LINE 身份
        </Button>
      </Card>
    </div>
  )
}
