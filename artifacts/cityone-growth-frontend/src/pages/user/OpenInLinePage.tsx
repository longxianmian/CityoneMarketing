// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把外部浏览器引导页改回报错页或首页 fallback。
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildContinueLaunchTargets, getRuntimeLineConfig, setRuntimeLineConfig } from '../../lib/line'
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
  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(payload?.return_path || '/welfare')
  const inLineClient = /Line\/\d/i.test(navigator.userAgent)
  const [lineCfg, setLineCfg] = useState(() => getRuntimeLineConfig())
  const { continueLiffUrl, continueLineSchemeUrl, oaAddFriendUrl } = buildContinueLaunchTargets(
    intentToken,
    lineCfg.liffId,
    lineCfg.officialAccountId,
  )
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`

  useEffect(() => {
    if (lineCfg.liffId && lineCfg.officialAccountId) return
    let cancelled = false
    const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

    void fetch(`${API_BASE}/api/growth/line/config`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setRuntimeLineConfig(json?.data || null)
        setLineCfg(getRuntimeLineConfig())
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [lineCfg.liffId, lineCfg.officialAccountId])

  useEffect(() => {
    console.info('[follow-flow] open_in_line_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineClient,
    })
    if (inLineClient) navigate(continuePath, { replace: true })
  }, [continuePath, inLineClient, navigate, payload?.action, payload?.intent_id])

  const handleOpenInLine = () => {
    if (!intentToken) return
    console.info('[follow-flow] open_in_line_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      target: inLineClient ? '/welfare/continue?intent=...' : 'liff:/continue?intent=...',
    })
    if (continueLiffUrl) {
      window.location.assign(continueLiffUrl)
      return
    }
    if (continueLineSchemeUrl) {
      window.location.assign(continueLineSchemeUrl)
    }
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
          <div style={{ fontSize: 22, fontWeight: 800, color: '#172b24', marginBottom: 10, textAlign: 'center' }}>请在 LINE 中继续</div>
          <div style={{ color: '#5f6f68', lineHeight: 1.8, marginBottom: 16, textAlign: 'center' }}>
            系统已为你准备好当前操作，请点击下方按钮继续。
          </div>
          <button
            disabled={(!continueLiffUrl && !continueLineSchemeUrl && !inLineClient) || !intentToken}
            onClick={handleOpenInLine}
            style={{ width: '100%', height: 48, borderRadius: 999, fontWeight: 700, border: 'none', background: ((!continueLiffUrl && !continueLineSchemeUrl && !inLineClient) || !intentToken) ? '#b7ead7' : '#12b981', color: '#fff', cursor: (!continueLiffUrl && !continueLineSchemeUrl && !inLineClient) || !intentToken ? 'not-allowed' : 'pointer' }}
          >
            打开 LINE 继续
          </button>
          {oaAddFriendUrl ? (
            <button
              style={{ marginTop: 12, height: 44, borderRadius: 999, width: '100%', border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}
              onClick={() => window.location.assign(oaAddFriendUrl)}
            >
              关注 OA
            </button>
          ) : null}
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
