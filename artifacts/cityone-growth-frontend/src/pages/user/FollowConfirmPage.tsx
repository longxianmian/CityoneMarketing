// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把关注确认页改回首页 fallback 或技术报错页。
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { syncLiffFriendshipIdentity, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import {
  buildContinueLaunchTargets,
  buildOaAddFriendUrl,
  getRuntimeLineConfig,
  isRuntimeSchemePreferredBrowser,
} from '../../lib/line'
import { clientLog } from '../../lib/clientLogger'
import useLineUserStore from '../../store/lineUser'

const FOLLOW_GATE_VERSION = '20260423_follow_gate_v2'
const FOLLOW_GATE_PENDING_RESET_MS = 1800
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

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
  const [checkingFollow, setCheckingFollow] = useState(false)

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const isLineWebView = /Line\/\d/i.test(navigator.userAgent)
  const inLineContext = inLineClient || isLineWebView
  const lineCfg = getRuntimeLineConfig()
  const oaAddFriendUrl = buildOaAddFriendUrl(lineCfg.officialAccountId)
  const { continueLiffUrl, continueLineSchemeUrl } = useMemo(
    () => buildContinueLaunchTargets(intentToken, lineCfg.liffId),
    [intentToken, lineCfg.liffId],
  )
  const needsLineContinue = !inLineContext
  const preferSchemeLaunch = needsLineContinue && isRuntimeSchemePreferredBrowser()
  const primaryHref = needsLineContinue
    ? ''
    : ''

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
      stage: needsLineContinue ? 'line_continue' : 'follow_confirm',
      in_line_client: inLineContext,
      has_liff_url: !!continueLiffUrl,
      version: FOLLOW_GATE_VERSION,
    })
    console.info('[follow-flow] follow_gate_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: needsLineContinue ? 'line_continue' : 'follow_confirm',
      in_line_client: inLineContext,
      version: FOLLOW_GATE_VERSION,
    })
  }, [continueLiffUrl, inLineContext, needsLineContinue, payload?.action, payload?.intent_id])

  useEffect(() => {
    if (needsLineContinue) return
    let cancelled = false

    const tryResumeIfFollowed = async () => {
      if (!inLineContext || !liffReady || checkingFollow) return
      setCheckingFollow(true)
      try {
        const followState = await revalidateFollowState()
        if (!cancelled && followState.followed) {
          console.info('[follow-flow] follow_confirm_auto_resume', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            source: followState.source,
          })
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tryResumeIfFollowed()
      }
    }
    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkingFollow, continuePath, inLineContext, liffReady, navigate, needsLineContinue, payload?.action, payload?.intent_id])

  const handleConfirm = async () => {
    clientLog('follow_gate_primary_click', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
      stage: needsLineContinue ? 'line_continue' : 'follow_confirm',
      in_line_client: inLineContext,
      has_oa_url: !!oaAddFriendUrl,
      has_liff_url: !!continueLiffUrl,
      version: FOLLOW_GATE_VERSION,
    })
    setSubmitting(true)
    try {
      if (needsLineContinue) {
        if (!intentToken) {
          setSubmitting(false)
          return
        }

        if (preferSchemeLaunch && continueLineSchemeUrl) {
          clientLog('follow_gate_continue_click', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            branch: 'external',
            target: 'line_scheme_primary',
          })

          let pageLeft = false
          const clearWatchers = () => {
            window.clearTimeout(fallbackTimer)
            window.removeEventListener('blur', handlePageLeave)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('pagehide', handlePageLeave)
          }
          const handlePageLeave = () => {
            pageLeft = true
            clearWatchers()
          }
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
              handlePageLeave()
            }
          }

          window.addEventListener('blur', handlePageLeave, { once: true })
          document.addEventListener('visibilitychange', handleVisibilityChange)
          window.addEventListener('pagehide', handlePageLeave, { once: true })

          const fallbackTimer = window.setTimeout(() => {
            if (pageLeft) return
            clearWatchers()
            if (continueLiffUrl) {
              window.location.assign(continueLiffUrl)
              return
            }
            setSubmitting(false)
          }, 1200)

          window.location.assign(continueLineSchemeUrl)
          return
        }

        if (continueLiffUrl) {
          clientLog('follow_gate_continue_click', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            branch: 'external',
            target: 'continue_liff_url',
          })
          window.location.assign(continueLiffUrl)
          return
        }

        setSubmitting(false)
        return
      }

      const followState = await revalidateFollowState()
      if (followState.followed) {
        console.info('[follow-flow] follow_confirm_click_resume', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          source: followState.source,
        })
        navigate(continuePath, { replace: true })
        return
      }

      if (oaAddFriendUrl) {
        clientLog('follow_confirm_open_oa', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          branch: inLineContext ? 'in_line' : 'external',
          source: followState.source,
        })
        console.info('[follow-flow] follow_confirm_open_oa', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          in_line_client: inLineContext,
          source: followState.source,
        })
        window.location.assign(oaAddFriendUrl)
        return
      }

      setSubmitting(false)
    } catch (e: any) {
      console.info('[follow-flow] follow_confirm_failed', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        error: e?.message || 'unknown',
      })

      if (oaAddFriendUrl) {
        window.location.assign(oaAddFriendUrl)
        return
      }

      setSubmitting(false)
    }
  }

  const title = needsLineContinue ? '请在 LINE 中继续' : '请先关注官方账号'
  const description = needsLineContinue
    ? '当前操作需要在 LINE 内继续完成。进入 LINE 后，系统会自动识别身份并继续当前业务流程。'
    : '当前操作需要先完成官方账号关注确认。关注完成后，系统会自动继续当前步骤，不需要重新返回详情页再次点击。'
  const primaryLabel = needsLineContinue
    ? (submitting ? '打开中...' : '打开 LINE 继续')
    : (submitting ? '打开中...' : '打开官方账号并关注')
  const primaryDisabled = submitting || (!needsLineContinue && checkingFollow)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{title}</div>
        <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 18 }}>
          {description}
        </div>
        {checkingFollow ? (
          <div style={{ color: '#10b981', fontSize: 13, marginBottom: 12 }}>
            正在确认当前账号是否已完成关注...
          </div>
        ) : null}
        <button
          onClick={() => void handleConfirm()}
          data-clog="follow-confirm-primary"
          disabled={primaryDisabled}
          style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: primaryDisabled ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 700, cursor: primaryDisabled ? 'not-allowed' : 'pointer' }}
        >
          {primaryLabel}
        </button>
        {needsLineContinue ? (
          <div style={{ color: '#666', fontSize: 13, marginTop: 12 }}>
            若未自动跳转，请点击按钮继续。
          </div>
        ) : null}
        {needsLineContinue && continueLineSchemeUrl ? (
          <div style={{ marginTop: 10 }}>
            <a
              href={continueLineSchemeUrl}
              onClick={() => {
                clientLog('follow_gate_scheme_click', {
                  intent_id: payload?.intent_id || '',
                  action_type: payload?.action || '',
                  branch: 'external',
                  target: 'line_scheme',
                })
              }}
              style={{ fontSize: 13, color: '#10b981', textDecoration: 'underline' }}
            >
              如未自动跳转，点这里在 LINE 中打开
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
