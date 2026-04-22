// 先读文档再改代码：关注门控页只负责“未关注 -> 发起官方关注 -> 复核 -> 继续业务”，禁止再承担外部浏览器跳 LINE 的职责。
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, syncLiffFriendshipIdentity, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildOaAddFriendUrl, buildRuntimeLineLoginAuthorizeUrl, getRuntimeLineConfig, setRuntimeLineConfig } from '../../lib/line'
import { clientLog } from '../../lib/clientLogger'
import useLineUserStore from '../../store/lineUser'

const FOLLOW_GATE_VERSION = '20260423_follow_gate_v3'
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

export default function FollowConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, inLineClient } = useLiff()
  const [submitting, setSubmitting] = useState(false)
  const [checkingFollow, setCheckingFollow] = useState(false)
  const [hintText, setHintText] = useState('')
  const [runtimeCfg, setRuntimeCfgState] = useState(() => getRuntimeLineConfig())

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const isLineWebView = /Line\/\d/i.test(navigator.userAgent)
  const inLineContext = inLineClient || isLineWebView
  const oaAddFriendUrl = buildOaAddFriendUrl(runtimeCfg.officialAccountId)
  const lineLoginUrl = useMemo(
    () => buildRuntimeLineLoginAuthorizeUrl(intentToken, { redirectPath: '/line/login/callback' }),
    [intentToken, runtimeCfg.channelId],
  )

  const revalidateFollowState = async () => {
    let effectiveUserId = ''
    let lineUserId = ''
    let followed = false
    let source: 'liff_friendship' | 'backend_check_follow' | 'none' = 'none'

    const current = useLineUserStore.getState()
    effectiveUserId = current.canonicalUserId || current.profile?.lineUserId || ''
    lineUserId = current.profile?.lineUserId || ''

    if (inLineContext && liffReady) {
      try {
        const refreshed = await syncLiffFriendshipIdentity()
        if (refreshed?.canonicalUserId) effectiveUserId = refreshed.canonicalUserId
        if (refreshed?.lineUserId) lineUserId = refreshed.lineUserId
        if (refreshed?.isFriend === true) {
          followed = true
          source = 'liff_friendship'
        }
      } catch (err: any) {
        clientLog('follow_confirm_refresh_failed', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          error: err?.message || 'unknown',
          version: FOLLOW_GATE_VERSION,
        })
      }
    }

    if (!followed && effectiveUserId) {
      try {
        followed = await checkFollow(effectiveUserId)
        if (followed) source = 'backend_check_follow'
      } catch (err: any) {
        clientLog('follow_confirm_check_follow_failed', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          canonical_user_id: effectiveUserId,
          error: err?.message || 'unknown',
          version: FOLLOW_GATE_VERSION,
        })
      }
    }

    clientLog('follow_confirm_revalidate', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      in_line_client: inLineContext,
      canonical_user_id: effectiveUserId,
      line_user_id: lineUserId,
      followed,
      source,
      version: FOLLOW_GATE_VERSION,
    })

    return { followed, effectiveUserId, lineUserId, source }
  }

  useEffect(() => {
    clientLog('follow_gate_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: 'follow_confirm',
      in_line_client: inLineContext,
      version: FOLLOW_GATE_VERSION,
    })
  }, [inLineContext, payload?.action, payload?.intent_id])

  useEffect(() => {
    if (runtimeCfg.channelId && runtimeCfg.officialAccountId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/growth/line/config`)
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
  }, [runtimeCfg.channelId, runtimeCfg.officialAccountId])

  useEffect(() => {
    if (inLineContext) return
    if (!lineLoginUrl) return
    const timer = window.setTimeout(() => {
      window.location.replace(lineLoginUrl)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [inLineContext, lineLoginUrl])

  useEffect(() => {
    if (!inLineContext) return
    let cancelled = false

    const tryResumeIfFollowed = async () => {
      if (!liffReady || checkingFollow) return
      setCheckingFollow(true)
      try {
        const followState = await revalidateFollowState()
        if (!cancelled && followState.followed) {
          navigate(continuePath, { replace: true })
          return
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setCheckingFollow(false)
      }
    }

    void tryResumeIfFollowed()

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void tryResumeIfFollowed()
      }
    }

    window.addEventListener('focus', handleVisible)
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleVisible)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [checkingFollow, continuePath, inLineContext, liffReady, navigate])

  const handleConfirm = async () => {
    clientLog('follow_gate_primary_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: 'follow_confirm',
      in_line_client: inLineContext,
      version: FOLLOW_GATE_VERSION,
    })

    if (!inLineContext) {
      if (lineLoginUrl) {
        window.location.assign(lineLoginUrl)
      }
      return
    }

    setSubmitting(true)
    setHintText('')

    try {
      const followState = await revalidateFollowState()
      if (followState.followed) {
        navigate(continuePath, { replace: true })
        return
      }

      const liff = getLiff()
      if (liff && typeof liff.requestFriendship === 'function' && liffReady) {
        clientLog('follow_confirm_request_friendship', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          version: FOLLOW_GATE_VERSION,
        })
        await liff.requestFriendship()
        setHintText('请完成关注后返回此页，系统会自动继续当前操作。')
        return
      }

      if (oaAddFriendUrl) {
        clientLog('follow_confirm_open_oa', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          version: FOLLOW_GATE_VERSION,
        })
        window.location.assign(oaAddFriendUrl)
        return
      }

      setHintText('当前未检测到可用的关注入口，请联系管理员检查 LINE 配置。')
    } catch (e: any) {
      clientLog('follow_confirm_failed', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        error: e?.message || 'unknown',
        version: FOLLOW_GATE_VERSION,
      })
      if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      }
      setHintText(e?.message || '关注确认失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const title = inLineContext ? '请先关注官方账号' : '正在打开 LINE 登录'
  const description = inLineContext
    ? '当前操作需要先完成官方账号关注确认。关注完成后，系统会自动继续当前业务流程，不需要重新返回详情页再次点击。'
    : '系统正在为当前操作拉起官方 LINE 登录。进入 LINE 后，会继续完成身份确认与后续业务步骤。'
  const primaryLabel = inLineContext
    ? (submitting ? '处理中...' : '关注并继续')
    : '打开 LINE 登录'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{title}</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>{description}</div>
        {checkingFollow ? (
          <div style={{ color: '#10b981', fontSize: 13, marginBottom: 12 }}>
            正在确认当前账号是否已完成关注...
          </div>
        ) : null}
        {hintText ? (
          <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
            {hintText}
          </div>
        ) : null}
        <button
          onClick={() => void handleConfirm()}
          data-clog="follow-confirm-primary"
          disabled={submitting || checkingFollow}
          style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: submitting || checkingFollow ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 700, cursor: submitting || checkingFollow ? 'not-allowed' : 'pointer' }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}
