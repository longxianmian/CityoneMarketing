// 先读文档再改代码：本页只负责 /welfare 入口分流，禁止把 LIFF 回流再交给首页渲染后补救。
import React, { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import WelfareHomePage from './WelfareHomePage'
import { normalizeRuntimeLiffExtraPath } from '../../lib/line'

/**
 * 强约束：
 * - /welfare 只承担首页展示与 LIFF 回流入口分流
 * - 当 URL 已携带 liff.state / intent 时，必须先进入 continue/open-in-line/follow-confirm
 * - 不允许先渲染首页再靠后续 effect 抢救式跳转
 */
export default function WelfareEntryPage() {
  const [searchParams] = useSearchParams()

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

  if (targetPath) {
    return <Navigate to={targetPath} replace />
  }

  return <WelfareHomePage />
}
