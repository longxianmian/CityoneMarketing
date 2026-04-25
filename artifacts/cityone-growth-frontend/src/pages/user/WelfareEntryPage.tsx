// 先读文档再改代码：本页只负责 /welfare 入口分流，禁止把 LIFF 回流再交给首页渲染后补救。
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import WelfareHomePage from './WelfareHomePage'
import {
  buildRuntimeContinueTargetFromResume,
  extractRuntimeResumeTarget,
  resolveRuntimeWelfareCallbackTarget,
} from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'
import useLineUserStore from '../../store/lineUser'
import {
  fetchLatestPendingIntent,
  readPendingIntentResume,
  readPendingIntentResumeKey,
} from '../../lib/pendingIntent'

/**
 * 强约束：
 * - /welfare 只承担首页展示与 LIFF 回流入口分流
 * - 当 URL 已携带 liff.state / intent 时，必须先进入 continue/follow-confirm
 * - 不允许先渲染首页再靠后续 effect 抢救式跳转
 *
 * LIFF OAuth 死循环防御（2026-04 nginx 日志诊断后修复）：
 *   LINE 内置 WebView 进入 /welfare?liff.state=...&code=XXX 时，LIFF SDK 正在用
 *   URL 上的 ?code=... 兑换 access token。如果 React 立刻 <Navigate> 改 URL，
 *   SDK OAuth 流程被打断 → 又触发 liff.login() → LINE 回调新 code → 反复 9+
 *   次拉新 code（生产 nginx 日志实证）。所以有 liff.state 时必须等 liffChecked
 *   = true 再 navigate，让 LIFF SDK 先把 OAuth 处理完。
 */
export default function WelfareEntryPage() {
  const DEBUG_REDIRECT_DELAY_MS = 2000
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffChecked, inLineContext } = useLiff()
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const lineProfile = useLineUserStore((s) => s.profile)
  const redirectingRef = useRef(false)

  const targetPath = useMemo(() => {
    return resolveRuntimeWelfareCallbackTarget(searchParams)
  }, [searchParams])
  const explicitResumeIntent = useMemo(() => {
    return (searchParams.get('resume_intent') || '').trim()
  }, [searchParams])
  const explicitResumeKey = useMemo(() => {
    return (searchParams.get('resume_key') || searchParams.get('resume') || '').trim()
  }, [searchParams])
  const parsedResumeTarget = useMemo(() => {
    return extractRuntimeResumeTarget(searchParams)
  }, [searchParams])
  const persistedResumeIntent = useMemo(() => {
    return explicitResumeIntent || explicitResumeKey || parsedResumeTarget.intentToken || parsedResumeTarget.resumeKey
      ? ''
      : readPendingIntentResume()
  }, [explicitResumeIntent, explicitResumeKey, parsedResumeTarget.intentToken, parsedResumeTarget.resumeKey])
  const persistedResumeKey = useMemo(() => {
    return explicitResumeIntent || explicitResumeKey || parsedResumeTarget.intentToken || parsedResumeTarget.resumeKey
      ? ''
      : readPendingIntentResumeKey()
  }, [explicitResumeIntent, explicitResumeKey, parsedResumeTarget.intentToken, parsedResumeTarget.resumeKey])
  const effectiveResumeIntent = explicitResumeIntent || parsedResumeTarget.intentToken || persistedResumeIntent
  const effectiveResumeKey = explicitResumeKey || parsedResumeTarget.resumeKey || persistedResumeKey
  const effectiveResumeTarget = useMemo(() => (
    buildRuntimeContinueTargetFromResume({
      resumeKey: effectiveResumeKey,
      intentToken: effectiveResumeIntent,
    })
  ), [effectiveResumeIntent, effectiveResumeKey])
  const hasExternalLoginCallback = useMemo(() => {
    return (
      searchParams.has('code') &&
      (searchParams.has('state') || searchParams.has('liffClientId') || searchParams.has('liffRedirectUri'))
    )
  }, [searchParams])

  const hasLiffCallback = searchParams.has('liff.state')
  const hasExplicitResumeTarget = !!targetPath || !!effectiveResumeTarget

  const scheduleReplace = useCallback((target: string, reason: string) => {
    if (!target || redirectingRef.current) return
    redirectingRef.current = true
    console.log('龙码调试：进入校验逻辑', {
      page: 'WelfareEntryPage',
      reason,
      target,
      search: window.location.search,
      liffChecked,
    })
    window.setTimeout(() => {
      navigate(target, { replace: true })
    }, DEBUG_REDIRECT_DELAY_MS)
  }, [liffChecked, navigate])

  useEffect(() => {
    if (!searchParams.has('code')) return
    if (searchParams.has('liff.state')) return
    if (hasExternalLoginCallback) return
    scheduleReplace('/welfare', 'strip_unknown_code_callback')
  }, [hasExternalLoginCallback, scheduleReplace, searchParams])

  useEffect(() => {
    clientLog('welfare_entry_render', {
      has_intent: searchParams.has('intent'),
      has_liff_state: searchParams.has('liff.state'),
      has_resume_intent: !!effectiveResumeIntent,
      has_resume_key: !!effectiveResumeKey,
      persisted_resume_intent: !!persistedResumeIntent,
      persisted_resume_key: !!persistedResumeKey,
      has_external_login_callback: hasExternalLoginCallback,
      target_path: targetPath || '(home)',
      liff_checked: liffChecked,
      will_wait_for_liff: !!(targetPath && hasLiffCallback && !liffChecked),
    })
  }, [searchParams, effectiveResumeIntent, effectiveResumeKey, persistedResumeIntent, persistedResumeKey, targetPath, liffChecked, hasLiffCallback, hasExternalLoginCallback])

  useEffect(() => {
    if (!effectiveResumeTarget || !liffChecked) return
    scheduleReplace(effectiveResumeTarget, 'resume_target_continue')
  }, [effectiveResumeTarget, liffChecked, scheduleReplace])

  useEffect(() => {
    if (!liffChecked || hasExplicitResumeTarget) return

    const userId = canonicalUserId || lineProfile?.lineUserId || ''
    const lineUserId = lineProfile?.lineUserId || ''
    if (!userId && !lineUserId) return

    let cancelled = false
    void fetchLatestPendingIntent({ userId, lineUserId })
      .then((latest) => {
        if (cancelled || !latest?.token) return
        scheduleReplace(
          `/welfare/continue?intent=${encodeURIComponent(latest.token)}&resume=1`,
          'latest_pending_continue'
        )
      })
      .catch(() => {
        // ignore: no resumable pending intent is a normal case
      })

    return () => {
      cancelled = true
    }
  }, [
    canonicalUserId,
    hasExplicitResumeTarget,
    inLineContext,
    liffChecked,
    lineProfile?.lineUserId,
    scheduleReplace,
  ])

  useEffect(() => {
    if (!targetPath) return
    scheduleReplace(targetPath, 'target_path_callback')
  }, [scheduleReplace, targetPath])

  if (
    (targetPath && hasLiffCallback && !liffChecked) ||
    (hasExternalLoginCallback && !liffChecked) ||
    (!!effectiveResumeTarget && !liffChecked)
  ) {
    // 占位，不渲染首页（避免闪屏），等 LIFF init 完成后再跳
    return null
  }

  if (targetPath) {
    return null
  }

  return <WelfareHomePage />
}
