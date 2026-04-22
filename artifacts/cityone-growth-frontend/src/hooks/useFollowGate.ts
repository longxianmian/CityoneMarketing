// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止前端自行推断身份、直接执行业务动作或复活 fallback。
/**
 * useFollowGate — 唯一主链入口
 *
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束（慢路径/默认路径）：
 * - 执行型动作只创建 pending intent，不在页面侧推断用户身份等级
 * - 不允许根据本地头像昵称、points 账户、客户端缓存推断 fan/customer/member
 * - 当前用户身份与关注状态只认后端真源
 *
 * 执行型动作统一流程（默认/慢路径）：
 *   1. 创建 pending intent
 *   2. 外部浏览器直接进入 LINE `/welfare/continue?intent=...`
 *   3. LINE 内统一进入 /welfare/continue?intent=...
 *   4. 仅异常场景才进入 open-in-line 引导页
 *
 * 不保留任何 fast path。所有执行动作一律经过同一条 pending-intent 主链：
 * identify -> check-follow -> consume -> 落业务结果页。
 */
import { useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import useLineUserStore from '../store/lineUser'
import { issuePendingIntent, type PendingIntentAction } from '../lib/pendingIntent'
import { useLiff } from '../providers/LiffProvider'
import { clientLog } from '../lib/clientLogger'
import { getRuntimeLineConfig, buildRuntimeLiffUrlWithPath, buildRuntimeLineSchemeUrlWithPath } from '../lib/line'

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

export function useFollowGate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lineProfile = useLineUserStore((s) => s.profile)
  const canonicalUserId = useLineUserStore((s) => s.canonicalUserId)
  const { inLineClient, liffReady, liffChecked } = useLiff()
  const isFriendFromStore = lineProfile?.isFriend === true
  const [checking, setChecking] = useState(false)
  // 防双击：guard 调用是异步的，setChecking 跨 React render 不可靠，必须用 ref 同步锁
  const inFlightRef = useRef(false)

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

      // 防双击同步锁：连续点击在 React state 更新前重入会发出多次 issue
      if (inFlightRef.current) {
        clientLog('guard_reentry_blocked', { action: intentAction, resource_id: resourceId })
        return
      }
      inFlightRef.current = true
      setChecking(true)
      clientLog('guard_enter', {
        action: intentAction,
        resource_id: resourceId,
        in_line_client: inLineClient,
        in_line_ua: /Line\/\d/i.test(navigator.userAgent),
        liff_checked: liffChecked,
        liff_ready: liffReady,
        is_friend: isFriendFromStore,
        has_canonical_uid: !!canonicalUserId,
      })
      try {
        const fullReturn = buildReturnPath(returnPath)
        const backPath = back ?? returnPath.split('?')[0]
        const successOrReturn = successPath || fullReturn

        // ─── 唯一主路径 ────────────────────────────────────────────────────────
        // 所有执行动作先发 pending intent，再进入 ContinuePage 统一完成：
        // identify -> check-follow -> consume。
        const issued = await issuePendingIntent({
          userId: canonicalUserId || lineProfile?.lineUserId || '',
          lineUserId: lineProfile?.lineUserId || '',
          action: intentAction,
          resourceId,
          returnPath: fullReturn,
          successPath: successOrReturn,
          failPath: failPath || fullReturn,
          backPath,
          actionName: label,
          source,
        })
        const continuePath = `/welfare/continue?intent=${encodeURIComponent(issued.token)}`
        const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(issued.token)}`

        // UA 兜底（2026-04 nginx 死循环诊断后加）：
        //   `inLineClient` 来自 LIFF SDK，必须 LIFF init 完成后才会 true。
        //   LINE 内冷启动时 init 异步，用户若在 init 完成前点击，inLineClient 仍为 false，
        //   会被误判为外部 UA → window.location.assign(liffUrl) → LINE 服务器 redirect 回
        //   /welfare?liff.state=... → LIFF SDK 又触发 OAuth → 死循环。
        //   navigator.userAgent 是同步的，可立即可靠识别 LINE 内置 WebView (Line/x.x)。
        const isLineWebView = /Line\/\d/i.test(navigator.userAgent)
        if (inLineClient || isLineWebView) {
          clientLog('guard_branch_in_line_continue', {
            in_line_client: inLineClient,
            in_line_ua: isLineWebView,
            target: continuePath,
          })
          // 在 LINE 内置 WebView 内：进 ContinuePage，由其调用 identity / check-follow
          // 完成"是 OA 粉丝 → 系统用户"识别后再 dispatch 业务路径。
          navigate(continuePath)
          return
        }

        // 外部浏览器：点击强互动按钮时，直接尝试拉起 LINE。
        // 只有没配 LIFF，或浏览器没能拉起 LINE 时，才回退到 OpenInLinePage。
        const lineCfg = getRuntimeLineConfig()
        const continueLiffUrl = buildRuntimeLiffUrlWithPath(
          `/welfare/continue?intent=${encodeURIComponent(issued.token)}`,
          lineCfg.liffId
        )
        const continueLineSchemeUrl = buildRuntimeLineSchemeUrlWithPath(
          `/welfare/continue?intent=${encodeURIComponent(issued.token)}`,
          lineCfg.liffId
        )

        if (!continueLiffUrl) {
          clientLog('guard_branch_external_no_liff_fallback', {
            action: intentAction,
            target: openInLinePath,
          })
          navigate(openInLinePath)
          return
        }

        clientLog('guard_branch_external_direct_open_line', {
          action: intentAction,
          continue_path: continuePath,
          has_scheme_fallback: !!continueLineSchemeUrl,
        })

        let fallbackTriggered = false
        let pageLeft = false

        const clearAll = () => {
          window.clearTimeout(fallbackTimer)
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

        const fallbackTimer = window.setTimeout(() => {
          if (pageLeft || fallbackTriggered) return
          fallbackTriggered = true
          clearAll()
          navigate(openInLinePath)
        }, 1500)

        window.location.assign(continueLiffUrl)

        return
      } catch (err: any) {
        clientLog('guard_error', { message: err?.message || 'unknown' })
        message.error(err?.message || '创建待恢复动作失败')
      } finally {
        inFlightRef.current = false
        setChecking(false)
      }
    },
    [
      buildReturnPath,
      canonicalUserId,
      inLineClient,
      isFriendFromStore,
      liffChecked,
      liffReady,
      lineProfile?.lineUserId,
      navigate,
    ]
  )

  return { guard, checking }
}
