/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider
 *
 * 使用非 hook 方式初始化（避免 @line/liff 内置 React 与应用 React 版本冲突）：
 *   - initLiff() 作为普通 async 函数在组件外执行
 *   - 通过 useLineUserStore.getState().setProfile() 更新 store（无需 hook）
 *   - 暴露 getLiff() 让页面可以直接调用 liff.getFriendship() 等 API
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import useLineUserStore from '../store/lineUser'
import { resolveRuntimeLiffId, setRuntimeLineConfig } from '../lib/line'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export interface LiffContextValue {
  liffReady: boolean
  inLineClient: boolean
  /** initLiff() 已完成（无论成功/失败），可安全读取 isFriend */
  liffChecked: boolean
}

export const LiffContext = createContext<LiffContextValue>({
  liffReady: false,
  inLineClient: false,
  liffChecked: false,
})

export function useLiff() {
  return useContext(LiffContext)
}

// 模块级缓存，页面组件可通过 getLiff() 直接调用 LIFF API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _liffInstance: any = null
let _liffInitiated = false
let _liffId = ''  // 缓存已拉取的 LIFF ID，catch 块中也可访问

/** 获取已初始化的 liff 实例（可能为 null，需判断）*/
export function getLiff() {
  return _liffInstance
}

async function initLiff(
  onReady: (ctx: LiffContextValue) => void,
  signal: { cancelled: boolean }
) {
  if (_liffInitiated) return
  _liffInitiated = true

  try {
    // 1. 从后端拉取 LIFF ID
    const res = await fetch(`${API_BASE}/api/growth/line/config`)
    const json = await res.json()
    setRuntimeLineConfig(json?.data || null)
    const liffId: string = resolveRuntimeLiffId(json?.data?.liffId)
    _liffId = liffId  // 供 catch 块使用

    if (!liffId) {
      onReady({ liffReady: false, inLineClient: false, liffChecked: true })
      return
    }

    // 2. 动态导入 LIFF SDK（避免 SSR/测试环境问题）
    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    _liffInstance = liff
    const isInClient = liff.isInClient()

    // 3. 获取真实 LINE 用户资料
    // 生产级流程要求：首页允许先浏览，只做静默识别。
    // 但当 URL 已携带动作恢复参数（rp / liff.state）时，说明用户刚从“关注并继续”回流，
    // 这时必须确保完成 LIFF 登录，否则 identify/check-follow/动作恢复都不会发生。
    if (!liff.isLoggedIn()) {
      const sp = new URLSearchParams(window.location.search)
      const hasResumeHint =
        Boolean(sp.get('rp') || sp.get('resume_return') || sp.get('liff.state') || sp.get('intent'))

      if (hasResumeHint) {
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}${window.location.search || ''}`
          liff.login({ redirectUri })
          return
        } catch {
          // login 调起失败时降级为未登录态，不阻塞页面浏览
        }
      }

      if (!signal.cancelled) {
        onReady({ liffReady: false, inLineClient: isInClient, liffChecked: true })
      }
      return
    }

    // 已完成 LIFF 登录后，无论是在 LINE 内还是外部浏览器，都要建立真实 LINE 身份。
    // 生产链路要求外部浏览器中的 LIFF 回流也能完成 identify / follow 校验，
    // 否则会出现“关注并继续 -> 回到 /welfare -> 又弹关注”的循环。
    const lineProfile = await liff.getProfile()
    if (signal.cancelled) return

    // 4. 检查是否已关注 OA（用于 useFollowGate 快速判断）
    let isFriend: boolean | undefined
    if (isInClient) {
      try {
        const friendship = await liff.getFriendship()
        isFriend = friendship.friendFlag
      } catch {
        // getFriendship 在 LINE 外部浏览器里会打 friendship/v1/status 并返回 400，
        // 这里仅在 LINE 内置浏览器中调用；外部浏览器统一交给后端 check-follow 收口。
      }
    }

    // 写入 store（不使用 hook，避免 React 版本冲突）
    useLineUserStore.getState().setProfile({
      lineUserId: lineProfile.userId,
      lineDisplayName: lineProfile.displayName,
      linePictureUrl: lineProfile.pictureUrl || '',
      identityTag: undefined,
      memberLevel: 'standard',
      points: 0,
      couponCount: 0,
      deposit: 0,
      depositPaid: false,
      isFriend,
    })

    // 调用 identify 接口：写入 users 表，获取 canonical user_id 和身份标签
    try {
      const idRes = await fetch(`${API_BASE}/api/user/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
          picture_url: lineProfile.pictureUrl || '',
          is_fan: isFriend === true,
        }),
      })
      const idJson = await idRes.json()
      const idData = idJson?.data || {}
      if (idData.user_id) {
        useLineUserStore.getState().setCanonicalUserId(idData.user_id)
      }
      if (idData.identity_tag) {
        useLineUserStore.getState().setIdentityTag(idData.identity_tag)
      }
      if (typeof idData.is_fan === 'boolean') {
        useLineUserStore.getState().setIsFriend(idData.is_fan)
      }
    } catch {
      // identify 失败不阻塞用户，降级使用 LINE User ID 作为 canonical ID
      useLineUserStore.getState().setCanonicalUserId(lineProfile.userId)
    }

    if (window.location.pathname === '/welfare') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('intent')) {
        window.location.replace(`/welfare/continue?${sp.toString()}`)
        return
      }
    }

    if (!signal.cancelled) {
      onReady({ liffReady: true, inLineClient: isInClient, liffChecked: true })
    }
  } catch (err) {
    // 若在 LINE 内置浏览器但当前 URL 不在 LIFF 端点 (/welfare) 下，重定向到正确端点
    // 这解决了同事从根链接 / 或其他路径进入时 LIFF 初始化失败的问题
    const isInLineApp = /Line\/\d/i.test(navigator.userAgent)
    const notAtEndpoint = !window.location.pathname.startsWith('/welfare')
    if (isInLineApp && notAtEndpoint && _liffId) {
      const current = window.location.pathname + window.location.search + window.location.hash
      sessionStorage.setItem('liff_redirect', current)
      window.location.replace('/welfare')
      return
    }
    console.warn('[LIFF] init failed, production LINE identity is unavailable:', err)
    onReady({ liffReady: false, inLineClient: false, liffChecked: true })
  }
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({ liffReady: false, inLineClient: false, liffChecked: false })

  useEffect(() => {
    const signal = { cancelled: false }
    initLiff(setCtx, signal)
    return () => { signal.cancelled = true }
  }, [])

  return <LiffContext.Provider value={ctx}>{children}</LiffContext.Provider>
}
