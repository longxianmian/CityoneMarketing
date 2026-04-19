// 先读文档再改代码：本页只负责 /welfare 入口分流，禁止把 LIFF 回流再交给首页渲染后补救。
import React, { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import WelfareHomePage from './WelfareHomePage'
import { normalizeRuntimeLiffExtraPath } from '../../lib/line'
import { useLiff } from '../../providers/LiffProvider'

/**
 * 强约束：
 * - /welfare 只承担首页展示与 LIFF 回流入口分流
 * - 当 URL 已携带 liff.state / intent 时，必须先进入 continue/open-in-line/follow-confirm
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
  const [searchParams] = useSearchParams()
  const { liffChecked } = useLiff()

  const targetPath = useMemo(() => {
    const intent = searchParams.get('intent') || ''
    if (intent) {
      return `/welfare/continue?intent=${encodeURIComponent(intent)}`
    }

    const liffState = searchParams.get('liff.state') || ''
    if (!liffState) return ''

    const decoded = decodeURIComponent(liffState)
    const normalized = normalizeRuntimeLiffExtraPath(decoded)
    if (!normalized) return ''

    if (
      normalized.startsWith('/continue?') ||
      normalized.startsWith('/open-in-line?') ||
      normalized.startsWith('/follow-confirm?')
    ) {
      return `/welfare${normalized}`
    }

    return ''
  }, [searchParams])

  // 有 LIFF 回流参数（liff.state / code）时，必须等 LiffProvider 完成 OAuth
  // 兑换（liffChecked=true）后再 navigate，否则 LIFF SDK 会被打断进入死循环。
  // 普通 intent 直跳无此约束（intent 走自家 ContinuePage 链路，与 LIFF SDK 无关）。
  const hasLiffCallback =
    searchParams.has('liff.state') || searchParams.has('code')

  if (targetPath && hasLiffCallback && !liffChecked) {
    // 占位，不渲染首页（避免闪屏），等 LIFF init 完成后再跳
    return null
  }

  if (targetPath) {
    return <Navigate to={targetPath} replace />
  }

  return <WelfareHomePage />
}
