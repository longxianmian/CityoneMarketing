// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把关注确认页改回首页 fallback 或技术报错页。
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildOaAddFriendUrl, getRuntimeLineConfig } from '../../lib/line'

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
  const lineCfg = getRuntimeLineConfig()
  const oaAddFriendUrl = buildOaAddFriendUrl(lineCfg.officialAccountId)

  useEffect(() => {
    console.info('[follow-flow] follow_confirm_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [payload?.action, payload?.intent_id])

  const handleConfirm = async () => {
    const liff = getLiff()
    if (submitting) return
    setSubmitting(true)

    try {
      if (inLineClient && liffReady && liff?.requestFriendship) {
        await liff.requestFriendship()
        navigate(continuePath, { replace: true })
        return
      }

      if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      }

      setSubmitting(false)
    } catch {
      if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      }
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>请先关注 LINE OA</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          当前领取操作需要先完成 LINE OA 关注确认。关注完成后，系统会自动继续当前领取步骤，不需要重新返回详情页再次点击。
        </div>
        <button
          onClick={() => void handleConfirm()}
          disabled={submitting}
          style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: submitting ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          关注 LINE OA 并继续
        </button>
        <button
          style={{ marginTop: 12, width: '100%', height: 44, borderRadius: 999, border: '1px solid #d9d9d9', background: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}
          disabled={submitting}
          onClick={() => navigate(returnPath, { replace: true })}
        >
          返回当前详情页
        </button>
      </div>
    </div>
  )
}
