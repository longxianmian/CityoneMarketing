// 先读文档再改代码：本页只负责 /welfare 入口分流，禁止把 LIFF 回流再交给首页渲染后补救。
import React, { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import WelfareHomePage from './WelfareHomePage'
import { resolveRuntimeWelfareCallbackTarget } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'
import { clientLog } from '../../lib/clientLogger'
import useLineUserStore from '../../store/lineUser'
import { fetchLatestPendingIntent } from '../../lib/pendingIntent'

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffChecked, inLineContext } = useLiff()
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const lineProfile = useLineUserStore((s) => s.profile)

  const targetPath = useMemo(() => {
    return resolveRuntimeWelfareCallbackTarget(searchParams)
  }, [searchParams])
  const explicitResumeIntent = useMemo(() => {
    return (searchParams.get('resume_intent') || '').trim()
  }, [searchParams])

  const hasLiffCallback = searchParams.has('liff.state')
  const hasExplicitResumeTarget = !!targetPath || !!explicitResumeIntent

  useEffect(() => {
    if (!searchParams.has('code')) return
    if (searchParams.has('liff.state')) return
    navigate('/welfare', { replace: true })
  }, [navigate, searchParams])

  useEffect(() => {
    clientLog('welfare_entry_render', {
      has_intent: searchParams.has('intent'),
      has_liff_state: searchParams.has('liff.state'),
      has_resume_intent: !!explicitResumeIntent,
      target_path: targetPath || '(home)',
      liff_checked: liffChecked,
      will_wait_for_liff: !!(targetPath && hasLiffCallback && !liffChecked),
    })
  }, [searchParams, explicitResumeIntent, targetPath, liffChecked, hasLiffCallback])

  useEffect(() => {
    if (!explicitResumeIntent || !liffChecked || !inLineContext) return
    navigate(`/welfare/continue?intent=${encodeURIComponent(explicitResumeIntent)}&resume=1`, {
      replace: true,
    })
  }, [explicitResumeIntent, inLineContext, liffChecked, navigate])

  useEffect(() => {
    if (!liffChecked || !inLineContext || hasExplicitResumeTarget) return

    const userId = canonicalUserId || lineProfile?.lineUserId || ''
    const lineUserId = lineProfile?.lineUserId || ''
    if (!userId && !lineUserId) return

    let cancelled = false
    void fetchLatestPendingIntent({ userId, lineUserId })
      .then((latest) => {
        if (cancelled || !latest?.token) return
        navigate(`/welfare/continue?intent=${encodeURIComponent(latest.token)}&resume=1`, { replace: true })
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
    navigate,
  ])

  if (targetPath && hasLiffCallback && !liffChecked) {
    // 占位，不渲染首页（避免闪屏），等 LIFF init 完成后再跳
    return null
  }

  if (targetPath) {
    return <Navigate to={targetPath} replace />
  }

  return <WelfareHomePage />
}
