// 先读文档再改代码：关注门控页只负责“未关注 -> 发起官方关注 -> 复核 -> 继续业务”，禁止再承担外部浏览器跳 LINE 的职责。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLiff, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import { buildOaAddFriendUrl, getRuntimeLineConfig, setRuntimeLineConfig } from '../../lib/line'
import { clientLog } from '../../lib/clientLogger'
import useLineUserStore from '../../store/lineUser'

const FOLLOW_GATE_VERSION = '20260423_follow_gate_v4'
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const DEBUG_REDIRECT_DELAY_MS = 2000

type FollowGateStage = 'checking' | 'ready' | 'submitting' | 'error'

async function registerFanTruth(params: {
  userId: string
  lineUserId: string
  displayName?: string
  pictureUrl?: string
}) {
  const { userId, lineUserId, displayName = '', pictureUrl = '' } = params
  if (!userId || !lineUserId) return false

  const res = await fetch(`${API_BASE}/api/user/set-fan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_picture_url: pictureUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok && json?.code === 200
}

export default function FollowConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, inLineContext } = useLiff()
  const [stage, setStage] = useState<FollowGateStage>('checking')
  const [hintText, setHintText] = useState('')
  const [runtimeCfg, setRuntimeCfgState] = useState(() => getRuntimeLineConfig())
  const [isProcessing, setIsProcessing] = useState(false)
  const redirectingRef = useRef(false)
  const probeKeyRef = useRef('')

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const tokenValid = !!intentToken && !!payload
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const oaAddFriendUrl = buildOaAddFriendUrl(runtimeCfg.officialAccountId)
  const submitting = stage === 'submitting' || isProcessing

  const scheduleContinueRedirect = useCallback((reason: string) => {
    if (!tokenValid || redirectingRef.current) return
    redirectingRef.current = true
    setIsProcessing(true)
    console.log('龙码调试：进入校验逻辑', {
      page: 'FollowConfirmPage',
      reason,
      target: continuePath,
      in_line_context: inLineContext,
      liff_ready: liffReady,
      stage,
      search: window.location.search,
    })
    window.setTimeout(() => {
      navigate(continuePath, { replace: true })
    }, DEBUG_REDIRECT_DELAY_MS)
  }, [continuePath, inLineContext, liffReady, navigate, stage, tokenValid])

  useEffect(() => {
    if (!tokenValid) return
    clientLog('follow_gate_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: 'follow_confirm',
      token_valid: tokenValid,
      in_line_context: inLineContext,
      version: FOLLOW_GATE_VERSION,
    })
  }, [inLineContext, payload?.action, payload?.intent_id, tokenValid])

  useEffect(() => {
    if (!tokenValid) return
    if (!inLineContext || !liffReady) {
      setStage('checking')
      return
    }

    const probeKey = `${intentToken}:friendship-probe`
    if (probeKeyRef.current === probeKey || redirectingRef.current || isProcessing) return

    let cancelled = false
    probeKeyRef.current = probeKey
    setIsProcessing(true)
    void (async () => {
      try {
        const liff = getLiff()
        if (!liff || typeof liff.getFriendship !== 'function') {
          if (!cancelled) {
            setStage('ready')
            setIsProcessing(false)
          }
          return
        }

        const friendship = await liff.getFriendship()
        if (cancelled) return
        if (friendship?.friendFlag === true) {
          clientLog('follow_confirm_already_friend', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            version: FOLLOW_GATE_VERSION,
          })
          scheduleContinueRedirect('friendship_probe_true')
          return
        }
        setStage('ready')
        setIsProcessing(false)
      } catch (e: any) {
        if (cancelled) return
        clientLog('follow_confirm_friendship_probe_failed', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          error: e?.message || 'unknown',
          version: FOLLOW_GATE_VERSION,
        })
        setStage('ready')
        setIsProcessing(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [inLineContext, intentToken, isProcessing, liffReady, payload?.action, payload?.intent_id, scheduleContinueRedirect, tokenValid])

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

  const handleConfirm = async () => {
    if (isProcessing || redirectingRef.current) return
    clientLog('follow_gate_primary_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: 'follow_confirm',
      in_line_context: inLineContext,
      version: FOLLOW_GATE_VERSION,
    })

    setStage('submitting')
    setHintText('')
    setIsProcessing(true)

    try {
      const liff = getLiff()
      if (liff && typeof liff.requestFriendship === 'function' && liffReady) {
        await liff.requestFriendship()
        let friendFlag = false
        try {
          const friendship = await liff.getFriendship?.()
          friendFlag = friendship?.friendFlag === true
        } catch {
          friendFlag = false
        }

        if (friendFlag) {
          let displayName = ''
          let pictureUrl = ''
          let lineUserId = useLineUserStore.getState().profile?.lineUserId || ''

          try {
            const profile = await liff.getProfile?.()
            displayName = profile?.displayName || ''
            pictureUrl = profile?.pictureUrl || ''
            lineUserId = profile?.userId || lineUserId
          } catch {
            // ignore
          }

          const state = useLineUserStore.getState()
          const canonicalUserId = state.canonicalUserId || lineUserId
          const synced = await registerFanTruth({
            userId: canonicalUserId,
            lineUserId,
            displayName: displayName || state.profile?.lineDisplayName || '',
            pictureUrl: pictureUrl || state.profile?.linePictureUrl || '',
          }).catch(() => false)

          if (lineUserId) {
            state.mergeProfile({
              lineUserId,
              lineDisplayName: displayName || state.profile?.lineDisplayName || '',
              linePictureUrl: pictureUrl || state.profile?.linePictureUrl || '',
              isFriend: true,
            })
            if (canonicalUserId) {
              state.setCanonicalUserId(canonicalUserId)
            }
          }

          clientLog('follow_confirm_friendship_confirmed', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            line_user_id: lineUserId,
            canonical_user_id: canonicalUserId,
            synced,
            version: FOLLOW_GATE_VERSION,
          })
          setStage('checking')
          scheduleContinueRedirect('friendship_confirmed')
          return
        }
        setHintText('尚未确认关注成功，请完成关注后再继续。')
        setStage('ready')
        setIsProcessing(false)
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
      setStage('error')
      setIsProcessing(false)
    } catch (e: any) {
      clientLog('follow_confirm_request_friendship_failed', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        error: e?.message || 'unknown',
        version: FOLLOW_GATE_VERSION,
      })
      setHintText('关注确认没有完成，请重试。')
      setStage('ready')
      setIsProcessing(false)
    }
  }

  const title = '请先关注官方账号'
  const description = '当前操作需要先完成官方账号关注确认。关注完成后，系统会自动继续当前业务流程，不需要重新返回详情页再次点击。'
  const primaryLabel = submitting ? '处理中...' : '关注并继续'

  if (!tokenValid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>当前操作已失效</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 20 }}>
            当前继续令牌无效或已过期，请返回福利中心重新发起操作。
          </div>
          <button
            onClick={() => navigate('/welfare', { replace: true })}
            style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            返回福利中心
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{title}</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>{description}</div>
        {stage === 'checking' ? (
          <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
            正在确认当前 LINE 身份和关注状态，请稍候。
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
          disabled={submitting || stage === 'checking'}
          style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: submitting || stage === 'checking' ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 700, cursor: submitting || stage === 'checking' ? 'not-allowed' : 'pointer' }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}
