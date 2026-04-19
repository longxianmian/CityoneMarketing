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
import { buildRuntimeLiffUrlWithPath, getRuntimeLineConfig } from '../lib/line'
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
      if (inFlightRef.current) return
      inFlightRef.current = true
      setChecking(true)
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
            console.info('[follow-flow] fast_path_consume_success', {
              intent_id:
                consumedFast?.payload?.intent_id || issuedFast.payload?.intent_id || '',
              action_type: intentAction,
              next_path: nextPath,
            })
            // 硬跳出 callback shell，让浏览器重新走 main 入口（同 ContinuePage 收尾）
            window.location.assign(nextPath)
          } catch (consumeErr: any) {
            console.info('[follow-flow] fast_path_consume_fail_handoff_to_continue', {
              intent_id: issuedFast.payload?.intent_id || '',
              action_type: intentAction,
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
        if (inLineClient) {
          navigate(continuePath)
          return
        }

        // dev / 测试环境保护：当前 hostname 不是 LIFF endpoint 配置的生产域时，
        // 走 LIFF URL 会被 LINE 服务器 redirect 到生产 endpoint（growth.cityone.app），
        // 整页跳出 dev 域后再也回不来，dev 链路完全断掉。
        // 这种情况下直接走本地 /welfare/continue，由 ContinuePage 内部识别 identity 缺失
        // 后跳 /welfare/open-in-line，至少保证 dev 链路可以端到端验证。
        const isProductionHost = /(^|\.)growth\.cityone\.app$/i.test(window.location.hostname)
        if (!isProductionHost) {
          navigate(continuePath)
          return
        }

        const liffUrl = buildRuntimeLiffUrlWithPath(`/continue?intent=${encodeURIComponent(issued.token)}`, getRuntimeLineConfig().liffId)
        if (liffUrl) {
          window.location.assign(liffUrl)
          return
        }

        navigate(`/welfare/open-in-line?intent=${encodeURIComponent(issued.token)}`)
      } catch (err: any) {
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
