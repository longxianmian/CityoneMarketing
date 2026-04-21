// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止前端自行推断身份、直接执行业务动作或复活 fallback。
/**
 * useFollowGate — 唯一主链入口
 *
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - 执行型动作只创建 pending intent，不在页面侧推断用户身份等级
 * - 不允许根据本地头像昵称、points 账户、客户端缓存推断 fan/customer/member
 * - 当前用户身份与关注状态只认后端真源
 *
 * 执行型动作统一流程：
 *   1. 创建 pending intent
 *   2. 外部浏览器直接进入 LINE `/continue?intent=...`
 *   3. LINE 内统一进入 /welfare/continue?intent=...
 *   4. 仅异常场景才进入 open-in-line 引导页
 *
 * 不在这里直接执行 claim / participate / redeem / use。
 */
import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import useLineUserStore from '../store/lineUser'
import { issuePendingIntent, type PendingIntentAction } from '../lib/pendingIntent'
import {
  buildContinueLaunchTargets,
  detectTerminal,
  getRuntimeLineConfig,
  isDesktopBrowser,
} from '../lib/line'
import { useLiff } from '../providers/LiffProvider'

interface GuardOptions {
  label?: string
  returnPath: string
  successPath?: string
  failPath?: string
  back?: string
  intentAction?: PendingIntentAction
  resourceId?: string
  source?: Record<string, any>
}

export function hasFreshResumePending() {
  return false
}

export function writeResumeKeys() {
  return
}

const SCHEME_FALLBACK_WAIT_MS = 1500
const OPEN_IN_LINE_WAIT_MS = 1500

export function useFollowGate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lineProfile = useLineUserStore((s) => s.profile)
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const { inLineContext } = useLiff()
  const [checking, setChecking] = useState(false)

  const buildReturnPath = useCallback(
    (base: string) => {
      const entryCode = searchParams.get('entry_code') || ''
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
      const utmParts = utmKeys
        .filter((k) => searchParams.get(k))
        .map((k) => `${k}=${encodeURIComponent(searchParams.get(k)!)}`)
      const attrParts = [
        entryCode ? `entry_code=${encodeURIComponent(entryCode)}` : '',
        ...utmParts,
      ].filter(Boolean)
      if (!attrParts.length) return base
      return `${base}${base.includes('?') ? '&' : '?'}${attrParts.join('&')}`
    },
    [searchParams]
  )

  const guard = useCallback(
    async (opts: GuardOptions) => {
      const {
        label = '',
        returnPath,
        successPath,
        failPath,
        back,
        intentAction,
        resourceId,
        source = {},
      } = opts

      if (!intentAction || !resourceId) {
        message.error('缺少待恢复动作定义，无法继续')
        return
      }

      setChecking(true)
      try {
        const terminal = detectTerminal()
        const fullReturn = buildReturnPath(returnPath)
        const backPath = back ?? returnPath.split('?')[0]
        const issued = await issuePendingIntent({
          userId: canonicalUserId || lineProfile?.lineUserId || '',
          lineUserId: lineProfile?.lineUserId || '',
          action: intentAction,
          resourceId,
          returnPath: fullReturn,
          successPath: successPath || fullReturn,
          failPath: failPath || fullReturn,
          backPath,
          actionName: label,
          source,
          terminal,
        })
        const continuePath = `/welfare/continue?intent=${encodeURIComponent(issued.token)}`
        const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(issued.token)}`
        if (inLineContext) {
          navigate(continuePath)
          return
        }

        if (isDesktopBrowser()) {
          navigate(openInLinePath)
          return
        }

        const lineCfg = getRuntimeLineConfig()
        const { continueLiffUrl, continueLineSchemeUrl } = buildContinueLaunchTargets(
          issued.token,
          lineCfg.liffId,
          lineCfg.officialAccountId,
        )

        if (!continueLiffUrl) {
          navigate(openInLinePath)
          return
        }

        let pageLeft = false
        let stage: 'liff' | 'scheme' | 'done' = 'liff'
        let stageTimer = 0

        const clearAll = () => {
          window.clearTimeout(stageTimer)
          window.removeEventListener('blur', handleBlur)
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          window.removeEventListener('pagehide', handlePageHide)
        }

        const handleBlur = () => {
          pageLeft = true
          clearAll()
        }

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
            pageLeft = true
            clearAll()
          }
        }

        const handlePageHide = () => {
          pageLeft = true
          clearAll()
        }

        window.addEventListener('blur', handleBlur, { once: true })
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('pagehide', handlePageHide, { once: true })

        const tryFinalFallback = () => {
          if (pageLeft || stage === 'done') return
          stage = 'done'
          clearAll()
          navigate(openInLinePath)
        }

        const tryScheme = () => {
          if (pageLeft || stage !== 'liff') return
          stage = 'scheme'
          if (!continueLineSchemeUrl) {
            tryFinalFallback()
            return
          }
          stageTimer = window.setTimeout(tryFinalFallback, OPEN_IN_LINE_WAIT_MS)
          window.location.assign(continueLineSchemeUrl)
        }

        if (continueLiffUrl) {
          stageTimer = window.setTimeout(tryScheme, SCHEME_FALLBACK_WAIT_MS)
          window.location.assign(continueLiffUrl)
        } else {
          tryScheme()
        }
      } catch (err: any) {
        message.error(err?.message || '创建待恢复动作失败')
      } finally {
        setChecking(false)
      }
    },
    [buildReturnPath, canonicalUserId, inLineContext, lineProfile?.lineUserId, navigate]
  )

  return { guard, checking }
}
