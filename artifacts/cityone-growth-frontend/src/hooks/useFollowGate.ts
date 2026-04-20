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
 *   2. 外部浏览器直接进入 LINE `/continue?intent=...`
 *   3. LINE 内统一进入 /welfare/continue?intent=...
 *   4. 仅异常场景才进入 open-in-line 引导页
 *
 * Fast path（仅在以下三者全部成立时绕过 ContinuePage 中转）：
 *   - profile.isFriend === true
 *   - canonicalUserId 已写入
 *   - lineUserId 是真实 LINE UID（U 开头）
 *
 * 三者均由 LiffProvider 在 LIFF init 后调 /api/user/identify 写入 store，是后端真源
 * 的镜像（不是前端推断）。命中后直接串 issue + consume 两次接口，硬跳 successPath，
 * 跳过 ContinuePage 的"正在继续领取"过场。任一不满足 → 回到上面的默认/慢路径。
 *
 * 不在这里直接执行 claim / participate / redeem / use（后端 consume 执行）。
 */
import { useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { message } from 'antd'
import useLineUserStore from '../store/lineUser'
import { issuePendingIntent, consumePendingIntent, type PendingIntentAction } from '../lib/pendingIntent'
import { useLiff } from '../providers/LiffProvider'
import { clientLog } from '../lib/clientLogger'

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

        // ─── FAST PATH ────────────────────────────────────────────────────────
        // 触发条件（必须全部成立，缺一不可）：
        //   - liffChecked && liffReady（本次会话 LIFF init 真的完成了，不是 persist 残留）
        //   - profile.isFriend === true（来自 identify 接口的后端真源）
        //   - canonicalUserId 已写入（identify 接口成功返回过）
        //   - lineUserId 是真实 LINE UID（U 开头）
        //
        // liffReady 门槛是关键：persist store 会保留上一次会话的 isFriend/canonicalUserId，
        // 在 LIFF init 失败/未完成的当前会话中，绝对不能用陈旧数据走 fast path 执行业务动作
        // （共享设备/冷启动/异常网络场景下会变成"用前一个用户身份替当前用户执行"）。
        const lineUidForFast = lineProfile?.lineUserId || ''
        const userIdForFast = canonicalUserId || ''
        const fastPathReady =
          liffChecked &&
          liffReady &&
          isFriendFromStore &&
          !!userIdForFast &&
          /^U/i.test(lineUidForFast)

        if (fastPathReady) {
          clientLog('guard_branch_fast_path', { action: intentAction })
          const issuedFast = await issuePendingIntent({
            userId: userIdForFast,
            lineUserId: lineUidForFast,
            action: intentAction,
            resourceId,
            returnPath: fullReturn,
            successPath: successOrReturn,
            failPath: failPath || fullReturn,
            backPath,
            actionName: label,
            source,
          })
          // consume 失败 → 不能直接 toast 完事，否则用户重试会再 issue 新 token，
          // 失去同 token 幂等 replay 保障。把控制权交给 ContinuePage 做幂等重试。
          try {
            const consumedFast = await consumePendingIntent({
              token: issuedFast.token,
              userId: userIdForFast,
              lineUserId: lineUidForFast,
            })
            const nextPath = String(
              consumedFast?.result?.nextPath ||
                consumedFast?.payload?.success_path ||
                consumedFast?.payload?.return_path ||
                successOrReturn
            )
            clientLog('guard_fast_consume_ok', {
              action: intentAction,
              next_path: nextPath,
            })
            // 关键修复（2026-04-20 真机 LINE 内体验诊断）：
            // 之前这里 window.location.assign(nextPath) → 整页 reload → LiffProvider
            // 在非 /welfare 路径上 init 偶发失败 → catch 块 window.location.replace('/welfare')
            // → 用户被强制踢回首页，看不到 claim 成功的结果，体感"啥都没发生"。
            //
            // useFollowGate 是 main app 入口里的 hook（不在 callback-entry 路由表内），
            // 根本不需要"硬跳出 callback shell"。直接 SPA navigate，目标页根据 query
            // (?owned=1&source=claim_success&up=xxx) 渲染领取成功状态即可。
            // ContinuePage 那条收尾链路因为在 callback-entry 路由表里跑，仍需保留 location.assign。
            navigate(nextPath, { replace: true })
          } catch (consumeErr: any) {
            clientLog('guard_fast_consume_fail_to_continue', {
              action: intentAction,
              error: consumeErr?.message || 'consume failed',
            })
            // 用同一 token 跳 ContinuePage，由其内部重试链路（identity → check-follow → consume）
            // 走幂等 replay。绝不在此处再次发起新 issue。
            navigate(`/welfare/continue?intent=${encodeURIComponent(issuedFast.token)}`)
          }
          return
        }

        // ─── SLOW PATH ────────────────────────────────────────────────────────
        // 关注状态未知 / 身份未就绪 / 在外部浏览器，走原 ContinuePage 收口。
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
          clientLog('guard_branch_slow_in_line', {
            in_line_client: inLineClient,
            in_line_ua: isLineWebView,
            target: continuePath,
          })
          // 在 LINE 内置 WebView 内：进 ContinuePage，由其调用 identity / check-follow
          // 完成"是 OA 粉丝 → 系统用户"识别后再 dispatch 业务路径。
          navigate(continuePath)
          return
        }

        // 外部浏览器：统一走 OpenInLinePage 中转页，让用户先看到"请在 LINE 中继续"
        // 提示再点按钮拉 LINE app（用户预期 / 信任度更高）。
        //
        // 历史上为省 ~270ms 闪屏，prod 域曾直接 window.location.assign(liffUrl)，
        // 但这样用户从详情页点"立即参加"会立刻被甩到外部 LINE app，没有任何视觉
        // 过渡，体感像"网页突然失控"。OpenInLinePage 的过渡虽多一步，但对用户
        // 第一次进入 LIFF 体验更友好（同时支持 https Universal Link 主按钮 +
        // line:// scheme 兜底链接，最大化拉起成功率）。
        // 不再使用 buildRuntimeLiffUrlWithPath/getRuntimeLineConfig 直接跳。
        clientLog('guard_branch_slow_external_open_in_line', { target: openInLinePath })
        navigate(openInLinePath)
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
