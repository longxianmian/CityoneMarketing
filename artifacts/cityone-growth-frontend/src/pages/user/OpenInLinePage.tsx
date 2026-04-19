// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useMemo } from 'react'
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
  const { inLineClient } = useLiff()
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const actionName = String(payload?.action_name || payload?.action || '当前操作')
  const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(intentToken)}`, getRuntimeLineConfig().liffId)
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`

  React.useEffect(() => {
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [payload?.action, payload?.intent_id])

  const handleOpenInLine = () => {
    if (!intentToken) return
    console.info('[follow-flow] open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: inLineClient ? '/welfare/continue?intent=...' : 'liff:/continue?intent=...',
    })
    if (inLineClient) {
      navigate(continuePath, { replace: true })
      return
    }
    if (!liffUrl) return
    window.location.href = liffUrl
  }

  const handleResetIdentity = () => {
    resetCurrentIdentitySession()
    const target = returnPath || '/welfare'
    window.location.assign(target)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f2fbf8 0%, #ffffff 100%)', padding: 20 }}>
      <div style={{ maxWidth: 420, width: '100%', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 50px rgba(15, 111, 86, 0.12)', background: '#fff' }}>
        <div style={{ background: 'linear-gradient(135deg, #13c267 0%, #12b981 100%)', color: '#fff', padding: '30px 24px 28px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            💬
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.2 }}>CityOne</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ display: 'inline-block', color: '#fff', border: 'none', padding: '0 12px', lineHeight: '24px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
              官方认证账号
            </span>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#172b24', marginBottom: 10, textAlign: 'center' }}>关注 LINE OA</div>
          <div style={{ color: '#5f6f68', lineHeight: 1.8, marginBottom: 16, textAlign: 'center' }}>
            点击下方按钮后，系统会先判断你是否已经关注 CityOne LINE OA。
            <br />
            已是粉丝会直接继续{actionName}；未关注用户会先进入关注确认，完成后自动继续后续步骤。
          </div>
          <div style={{ borderRadius: 18, background: '#fff8ef', border: '1px solid #fde4be', padding: '14px 16px', color: '#a45b10', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>继续后你会获得什么</div>
            <div>完成关注后即可继续领取卡券、参与活动、兑换权益或进入下一业务流程。</div>
          </div>
          <div style={{ borderRadius: 18, background: '#f4fff9', border: '1px solid #d7f4e5', padding: '14px 16px', color: '#2f5c45', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>操作步骤</div>
            <div>1. 点击“关注 LINE OA 并继续”</div>
            <div>2. 系统判断当前会话是否已是 OA 粉丝</div>
            <div>3. 粉丝直接继续业务，非粉丝先关注后再自动继续</div>
          </div>
          <button
            disabled={(!liffUrl && !inLineClient) || !intentToken}
            onClick={handleOpenInLine}
            style={{ width: '100%', height: 48, borderRadius: 999, fontWeight: 700, border: 'none', background: ((!liffUrl && !inLineClient) || !intentToken) ? '#b7ead7' : '#12b981', color: '#fff', cursor: (!liffUrl && !inLineClient) || !intentToken ? 'not-allowed' : 'pointer' }}
          >
            关注 LINE OA 并继续
          </button>
          <button
            style={{ marginTop: 12, height: 44, borderRadius: 999, width: '100%', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
            onClick={() => navigate(returnPath, { replace: true })}
          >
            返回当前详情页
          </button>
          <button
            style={{ marginTop: 12, height: 44, borderRadius: 999, width: '100%', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
            onClick={handleResetIdentity}
          >
            重新识别 LINE 身份
          </button>
        </div>
      </div>
    </div>
  )
}
