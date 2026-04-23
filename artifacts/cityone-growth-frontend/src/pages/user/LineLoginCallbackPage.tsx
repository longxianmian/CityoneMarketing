import React, { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  buildContinueLaunchTargets,
  buildRuntimeLineLoginAuthorizeUrl,
  decodeRuntimeLineLoginState,
  getRuntimeLineConfig,
  setRuntimeLineConfig,
} from '../../lib/line'
import { clientLog } from '../../lib/clientLogger'

export default function LineLoginCallbackPage() {
  const [searchParams] = useSearchParams()
  const [runtimeCfg, setRuntimeCfgState] = React.useState(() => getRuntimeLineConfig())

  const statePayload = useMemo(
    () => decodeRuntimeLineLoginState(searchParams.get('state')),
    [searchParams]
  )
  const intentToken = String(statePayload?.intentToken || '').trim()
  const { continueLiffUrl, continueLineSchemeUrl } = useMemo(
    () => buildContinueLaunchTargets(intentToken, runtimeCfg.liffId),
    [intentToken, runtimeCfg.liffId],
  )
  const retryLoginUrl = useMemo(
    () => buildRuntimeLineLoginAuthorizeUrl(intentToken),
    [intentToken, runtimeCfg.channelId, runtimeCfg.lineLoginRedirectPath],
  )
  const friendshipChanged = searchParams.get('friendship_status_changed') || ''
  const launchTarget = continueLiffUrl || continueLineSchemeUrl || ''

  useEffect(() => {
    clientLog('line_login_callback_view', {
      intent_token_present: !!intentToken,
      friendship_status_changed: friendshipChanged || '',
      has_continue_liff_url: !!continueLiffUrl,
      has_continue_scheme_url: !!continueLineSchemeUrl,
    })
  }, [continueLiffUrl, continueLineSchemeUrl, friendshipChanged, intentToken])

  useEffect(() => {
    if (runtimeCfg.channelId && runtimeCfg.liffId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/growth/line/config`)
        const json = await res.json()
        if (cancelled) return
        setRuntimeLineConfig(json?.data || null)
        setRuntimeCfgState(getRuntimeLineConfig())
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runtimeCfg.channelId, runtimeCfg.liffId])

  useEffect(() => {
    if (!launchTarget) return
    const timer = window.setTimeout(() => {
      window.location.replace(launchTarget)
    }, 60)
    return () => window.clearTimeout(timer)
  }, [launchTarget])

  if (!intentToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>登录回调无效</div>
          <div style={{ color: '#666', lineHeight: 1.8 }}>
            当前登录回调缺少业务恢复参数，请返回福利中心重新发起操作。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>正在打开 LINE</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          系统已完成官方登录回调，正在进入 LINE 内继续当前业务流程。
        </div>
        {launchTarget ? (
          <a
            href={launchTarget}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, borderRadius: 999, background: '#12b981', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
          >
            打开 LINE 继续
          </a>
        ) : retryLoginUrl ? (
          <a
            href={retryLoginUrl}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, borderRadius: 999, background: '#12b981', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
          >
            重新发起 LINE 登录
          </a>
        ) : null}
      </div>
    </div>
  )
}
