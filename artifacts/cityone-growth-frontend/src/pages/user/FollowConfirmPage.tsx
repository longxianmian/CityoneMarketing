// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止把关注确认页改回首页 fallback 或技术报错页。
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { syncLiffFriendshipIdentity, useLiff } from '../../providers/LiffProvider'
import { decodePendingIntentPayload } from '../../lib/pendingIntent'
import {
  buildContinueLaunchTargets,
  buildOaAddFriendUrl,
  getRuntimeLineConfig,
} from '../../lib/line'
import { clientLog } from '../../lib/clientLogger'

/**
 * 强约束：
 * - 仅未关注用户进入此页
 * - 完成关注后，必须自动回到 /welfare/continue?intent=...
 * - 不允许从这里回首页或个人中心
 */

export default function FollowConfirmPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, inLineClient } = useLiff()
  const [submitting, setSubmitting] = useState(false)
  const [checkingFollow, setCheckingFollow] = useState(false)

  const intentToken = searchParams.get('intent') || ''
  const payload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const continuePath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  const isOpenInLineMode = location.pathname === '/welfare/open-in-line'
  const lineCfg = getRuntimeLineConfig()
  const oaAddFriendUrl = buildOaAddFriendUrl(lineCfg.officialAccountId)
  const { continueLiffUrl, continueLineSchemeUrl } = useMemo(
    () => buildContinueLaunchTargets(intentToken, lineCfg.liffId),
    [intentToken, lineCfg.liffId],
  )

  useEffect(() => {
    if (isOpenInLineMode) {
      clientLog('open_in_line_view', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        in_line_client: inLineClient,
        branch: inLineClient ? 'in_line' : 'external',
        has_liff_url: !!continueLiffUrl,
      })
      console.info('[follow-flow] open_in_line_view', {
        intent_id: payload?.intent_id || '',
        action_type: payload?.action || '',
        in_line_client: inLineClient,
      })
      return
    }

    console.info('[follow-flow] follow_confirm_view', {
      intent_id: payload?.intent_id || '',
      action_type: payload?.action || '',
    })
  }, [continueLiffUrl, inLineClient, isOpenInLineMode, payload?.action, payload?.intent_id])

  useEffect(() => {
    if (isOpenInLineMode) return
    let cancelled = false

    const tryResumeIfFollowed = async () => {
      if (!inLineClient || !liffReady || checkingFollow) return
      setCheckingFollow(true)
      try {
        const refreshed = await syncLiffFriendshipIdentity()
        if (!cancelled && refreshed?.isFriend === true) {
          console.info('[follow-flow] follow_confirm_auto_resume', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
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
  }, [checkingFollow, continuePath, inLineClient, isOpenInLineMode, liffReady, navigate, payload?.action, payload?.intent_id])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      if (isOpenInLineMode) {
        if (!intentToken) {
          setSubmitting(false)
          return
        }

        if (inLineClient) {
          clientLog('open_in_line_continue_click', {
            intent_id: payload?.intent_id || '',
            action_type: payload?.action || '',
            branch: 'in_line',
            target: continuePath,
          })
          navigate(continuePath, { replace: true })
          return
        }

        if (continueLiffUrl) {
          clientLog('open_in_line_continue_click', {
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

      if (oaAddFriendUrl) {
        clientLog('follow_confirm_open_oa', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          branch: inLineClient ? 'in_line' : 'external',
        })
        console.info('[follow-flow] follow_confirm_open_oa', {
          intent_id: payload?.intent_id || '',
          action_type: payload?.action || '',
          in_line_client: inLineClient,
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

  const title = isOpenInLineMode ? '请在 LINE 中继续' : '请先关注官方账号'
  const description = isOpenInLineMode
    ? '当前操作需要在 LINE 内继续完成。进入 LINE 后，系统会自动识别身份并继续当前业务流程。'
    : '当前操作需要先完成官方账号关注确认。关注完成后，系统会自动继续当前步骤，不需要重新返回详情页再次点击。'
  const primaryLabel = isOpenInLineMode
    ? (submitting ? '打开中...' : '打开 LINE 继续')
    : (submitting ? '打开中...' : '打开官方账号并关注')
  const primaryDisabled = submitting || (!isOpenInLineMode && checkingFollow)

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
          disabled={primaryDisabled}
          style={{ width: '100%', height: 48, borderRadius: 999, border: 'none', background: primaryDisabled ? '#b7ead7' : '#12b981', color: '#fff', fontWeight: 700, cursor: primaryDisabled ? 'not-allowed' : 'pointer' }}
        >
          {primaryLabel}
        </button>
        {isOpenInLineMode ? (
          <div style={{ color: '#666', fontSize: 13, marginTop: 12 }}>
            若未自动跳转，请点击按钮继续。
          </div>
        ) : null}
        {isOpenInLineMode && !inLineClient && continueLineSchemeUrl ? (
          <div style={{ marginTop: 10 }}>
            <a
              href={continueLineSchemeUrl}
              onClick={() => {
                clientLog('open_in_line_scheme_click', {
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
