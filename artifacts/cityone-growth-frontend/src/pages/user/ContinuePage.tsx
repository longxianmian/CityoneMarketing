// 先读文档再改代码：先阅读 src/pages/user/README.md 与两份唯一身份 / LINE 继续链路规范，禁止在 continue 页复活首页/个人中心 fallback 或页面自执行业务动作。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiff, getLiff } from '../../providers/LiffProvider'
import useLineUserStore from '../../store/lineUser'
import { consumePendingIntent, decodePendingIntentPayload } from '../../lib/pendingIntent'

/**
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - ContinuePage 只负责：identity -> check-follow -> consume
 * - 不允许在这里自行计算业务身份等级
 * - 不允许失败时自动跳首页或个人中心
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

type ContinueStatus =
  | 'idle'
  | 'resolving_identity'
  | 'checking_follow'
  | 'waiting_follow_or_ready'
  | 'consuming'
  | 'done'
  | 'error'

async function checkFollow(userId: string) {
  const res = await fetch(`${API_BASE}/api/user/check-follow?user_id=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || '关注状态校验失败')
  }
  return json?.data?.is_fan === true
}

function buildClaimSuccessPath(
  intentPayload: any,
  actionResult: any
) {
  const rawReturnPath = String(intentPayload?.return_path || '/welfare')
  const [pathname, search = ''] = rawReturnPath.split('?')
  const params = new URLSearchParams(search)
  const userProductId = String(
    actionResult?.user_product?.id ||
      actionResult?.user_product_id ||
      ''
  ).trim()

  params.set('owned', '1')
  params.set('source', 'claim_success')
  if (userProductId) params.set('up', userProductId)

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function ContinuePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { liffReady, liffChecked, inLineClient } = useLiff()
  const isLineWebView = /Line\/\d/i.test(navigator.userAgent)
  const inLineContext = inLineClient || isLineWebView
  const [status, setStatus] = useState<ContinueStatus>('idle')
  const [errorText, setErrorText] = useState('')
  const inFlightRef = useRef(false)
  const consumedRef = useRef(false)
  const mountedRef = useRef(true)

  const intentToken = searchParams.get('intent') || ''
  const intentPayload = useMemo(() => decodePendingIntentPayload(intentToken), [intentToken])
  const returnPath = String(intentPayload?.return_path || '/welfare')
  const failPath = String(intentPayload?.fail_path || returnPath)
  const openInLinePath = `/welfare/open-in-line?intent=${encodeURIComponent(intentToken)}`
  const followConfirmPath = `/welfare/follow-confirm?intent=${encodeURIComponent(intentToken)}`

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!intentPayload) return
    console.info('[follow-flow] continue_processing_enter', {
      intent_id: intentPayload.intent_id || '',
      action_type: intentPayload.action || '',
    })
  }, [intentPayload])

  const waitForIdentityReady = useCallback(async () => {
    // 缩短到 600ms：LIFF init 完成后 identity 应当已同步注入 store。继续等只对
    // setProfile / setCanonicalUserId 之间的 React batch 微秒级时序差有意义。
    // 真正的"无 identity"场景（外部浏览器/未登录）由调用方的 liffReady 快速分支处理，不进这里。
    const deadline = Date.now() + 1800
    while (Date.now() < deadline) {
      const state = useLineUserStore.getState()
      const canonicalUserId = state.canonicalUserId || state.profile?.lineUserId || ''
      const lineUserId = state.profile?.lineUserId || ''
      if (canonicalUserId && lineUserId) {
        return { canonicalUserId, lineUserId }
      }
      await sleep(60)
    }
    const state = useLineUserStore.getState()
    return {
      canonicalUserId: state.canonicalUserId || state.profile?.lineUserId || '',
      lineUserId: state.profile?.lineUserId || '',
    }
  }, [])

  const runFlow = useCallback(async () => {
    if (!intentToken || inFlightRef.current || consumedRef.current || !mountedRef.current) return
    inFlightRef.current = true
    try {
      if (!intentPayload) {
        setErrorText('待恢复动作无效或已损坏')
        setStatus('error')
        return
      }

      // 快速分支：LIFF 已检查但未 ready（外部浏览器/未登录场景），identity 永远不会自动就绪，
      // 不需要再花 600ms 轮询 store，直接跳 OpenInLinePage 让用户在 LINE 内打开。
      if (!liffReady) {
        if (inLineClient || isLineWebView) {
          setStatus('resolving_identity')
          return
        }
        navigate(openInLinePath, { replace: true })
        return
      }

      setStatus('resolving_identity')
      const identity = await waitForIdentityReady()
      if (!mountedRef.current) return

      if (!identity.canonicalUserId || !identity.lineUserId) {
        if (inLineContext) {
          setErrorText('LINE 身份初始化超时，请点击重试')
          setStatus('error')
          return
        }
        navigate(openInLinePath, { replace: true })
        return
      }

      setStatus('checking_follow')
      const followed = await checkFollow(identity.canonicalUserId)
      if (!mountedRef.current) return

      if (!followed) {
        if (!inLineContext && !liffReady) {
          navigate(openInLinePath, { replace: true })
          return
        }
        setStatus('waiting_follow_or_ready')
        // 先尝试 LIFF SDK 原生 requestFriendship() 弹关注 UI（2024+ 新增方法）。
        // 用户在 LIFF 里点接受 → friendFlag 变 true → 重新 check-follow → 直接 consume。
        // 失败/拒绝/SDK 不支持 → fallback 到 FollowConfirmPage 显式引导加好友。
        //
        // 后端 check-follow 依赖 LINE bot 的 follow webhook 写入 line_followers 表，
        // 用户接受加好友后 webhook 可能有几百 ms 延迟，所以接受后做最多 3 次轮询
        // (200ms / 600ms / 1500ms)，任一次拿到 followed=true 就 consume。
        const liff = getLiff()
        const canTryRequest = liff && typeof liff.requestFriendship === 'function'
        if (canTryRequest) {
          console.info('[follow-flow] request_friendship_start', {
            intent_id: intentPayload.intent_id || '',
            action_type: intentPayload.action || '',
          })
          let userAccepted = false
          try {
            await liff.requestFriendship()
            userAccepted = true
          } catch (e: any) {
            console.info('[follow-flow] request_friendship_rejected_or_failed', {
              intent_id: intentPayload.intent_id || '',
              error: e?.message || 'unknown',
            })
          }
          if (userAccepted && mountedRef.current) {
            // 信任 LIFF 的 friendFlag，把 store 也同步一下（让其他页面立即看到 isFriend）
            try {
              const fr = await liff.getFriendship()
              if (fr?.friendFlag === true) {
                useLineUserStore.getState().setIsFriend(true)
              }
            } catch {
              // getFriendship 失败不影响后续 check-follow 主链
            }
            // 后端 check-follow 重试（webhook 写库可能有延迟）
            const delays = [200, 600, 1500]
            let backendFollowed = false
            for (const ms of delays) {
              await sleep(ms)
              if (!mountedRef.current) return
              try {
                if (await checkFollow(identity.canonicalUserId)) {
                  backendFollowed = true
                  break
                }
              } catch {
                // 单次失败继续重试
              }
            }
            if (backendFollowed) {
              console.info('[follow-flow] request_friendship_consume_continue', {
                intent_id: intentPayload.intent_id || '',
              })
              // followed=true 落定，跳出本块走主链 consume
            } else {
              // 后端仍未识别 → 走 FollowConfirmPage 让用户显式确认
              navigate(followConfirmPath, { replace: true })
              return
            }
          } else {
            // 用户拒绝/接口失败 → fallback FollowConfirmPage
            navigate(followConfirmPath, { replace: true })
            return
          }
        } else {
          // SDK 不支持 requestFriendship（旧版 LIFF / 非 LINE 内）→ 直接 fallback
          navigate(followConfirmPath, { replace: true })
          return
        }
      }

      consumedRef.current = true
      setStatus('consuming')
      const consumed = await consumePendingIntent({
        token: intentToken,
        userId: identity.canonicalUserId,
        lineUserId: identity.lineUserId,
      })
      if (!mountedRef.current) return

      // 后端 pending-intent-service 对 status='failed' 的 intent 在 replay 时会返回
      // HTTP 200 + { replayed: true, result: { error: true, code, message } }
      // （见 services/pending-intent-service.js 269-275）。这里必须显式识别错误回放，
      // 否则会 fallback 到 success_path 误跳成功页。
      if (consumed?.result?.error === true) {
        consumedRef.current = false
        const errMsg = String(
          (consumed.result as any)?.message || '原操作此前已执行失败，无法继续'
        )
        console.info('[follow-flow] consume_replay_error', {
          intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
          action_type: consumed?.payload?.action || intentPayload.action || '',
          error_code: (consumed.result as any)?.code || '',
          replayed: consumed?.replayed === true,
        })
        setErrorText(errMsg)
        setStatus('error')
        return
      }

      const nextPath =
        consumed?.payload?.action === 'claim_coupon'
          ? buildClaimSuccessPath(
              consumed?.payload || intentPayload,
              consumed?.result?.action_result
            )
          : String(
              consumed?.result?.nextPath ||
                consumed?.payload?.success_path ||
                consumed?.payload?.return_path ||
                returnPath
            )

      console.info('[follow-flow] consume_success', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        result_code: consumed?.result?.resultCode || '',
        next_path: nextPath,
      })
      console.info('[follow-flow] claim_success_route', {
        intent_id: consumed?.payload?.intent_id || intentPayload.intent_id || '',
        action_type: consumed?.payload?.action || intentPayload.action || '',
        next_path: nextPath,
      })

      setStatus('done')
      // 续接成功后跳出 callback shell，必须用硬跳转让浏览器重新走 main 入口（callback-entry 路由表只含 callback 三件套）
      window.location.assign(nextPath)
    } catch (err: any) {
      if (!mountedRef.current) return
      consumedRef.current = false
      console.info('[follow-flow] consume_fail', {
        intent_id: intentPayload?.intent_id || '',
        action_type: intentPayload?.action || '',
        error: err?.message || '继续当前操作失败',
      })
      setErrorText(err?.message || '继续原操作失败')
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [
    inLineClient,
    intentPayload,
    intentToken,
    liffReady,
    navigate,
    openInLinePath,
    waitForIdentityReady,
  ])

  // 缺失/非法 intent 立即进入 error，避免在 idle/loading 上无限转圈。
  // 注意：runFlow 内部也会判断 intentPayload 缺失，但 runFlow 必须等 liffChecked=true 才跑，
  // 这里前置判断让用户立即看到 error 不必等 LIFF init。
  useEffect(() => {
    if (!intentToken) {
      setErrorText('待恢复动作无效或已损坏')
      setStatus('error')
      return
    }
    if (!intentPayload) {
      setErrorText('待恢复动作无效或已损坏')
      setStatus('error')
    }
  }, [intentToken, intentPayload])

  // 外部浏览器预判：UA 不含 "Line/" 时 LIFF 永远不会 ready，
  // 不必等 LiffProvider init（冷启动 ~800ms：fetch line/config + 动态 import @line/liff + liff.init），
  // 立即跳 OpenInLinePage，避免用户看到无意义的"正在继续处理"过场页。
  // LINE 内 UA 走原慢路径，由 liffChecked 闸门控制。
  // ⚠️ 必须 intentPayload 有效才跳：非法 intent 必须停在前置 error，不能被重定向覆盖。
  useEffect(() => {
    if (!intentToken || !intentPayload) return
    const isLineUA = /Line\/\d/i.test(navigator.userAgent)
    if (!isLineUA) {
      navigate(openInLinePath, { replace: true })
    }
  }, [intentToken, intentPayload, navigate, openInLinePath])

  useEffect(() => {
    if (!intentToken || !liffChecked) return
    void runFlow()
  }, [intentToken, liffChecked, runFlow])

  useEffect(() => {
    if (!intentToken || !liffChecked || liffReady || !inLineContext) return
    const timer = window.setTimeout(() => {
      setErrorText('LINE 登录初始化超时，请点击重试')
      setStatus((prev) => (prev === 'done' ? prev : 'error'))
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [intentToken, liffChecked, liffReady, inLineContext])

  if (status === 'idle' || status === 'resolving_identity' || status === 'checking_follow' || status === 'consuming') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', padding: 24 }}>
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', background: '#fff', padding: '28px 24px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto',
              borderRadius: '50%',
              border: '3px solid rgba(44, 219, 206, 0.18)',
              borderTopColor: '#2cdbce',
              animation: 'boot-spin 0.8s linear infinite',
            }}
          />
          <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700 }}>正在继续处理</div>
          <div style={{ color: '#666', lineHeight: 1.8, marginTop: 10 }}>
            系统正在确认 LINE 身份、关注状态，并自动继续当前操作。
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 20, background: '#fff', padding: 24, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>继续当前操作失败</div>
          <div style={{ color: '#666', marginBottom: 16 }}>{errorText || '当前步骤未能完成，你可以重试，或返回当前详情页重新发起。'}</div>
          <button
            onClick={() => void runFlow()}
            style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: '#12b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            重试
          </button>
          <button
            onClick={() => window.location.assign(failPath || returnPath)}
            style={{ width: '100%', height: 44, marginTop: 12, borderRadius: 999, border: '1px solid #d9d9d9', background: '#fff', color: '#222', cursor: 'pointer' }}
          >
            返回当前详情页
          </button>
        </div>
      </div>
    )
  }

  return null
}
