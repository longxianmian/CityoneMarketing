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

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export interface LiffContextValue {
  liffReady: boolean
  inLineClient: boolean
}

export const LiffContext = createContext<LiffContextValue>({
  liffReady: false,
  inLineClient: false,
})

export function useLiff() {
  return useContext(LiffContext)
}

// 模块级缓存，页面组件可通过 getLiff() 直接调用 LIFF API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _liffInstance: any = null
let _liffInitiated = false

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
    const liffId: string = json?.data?.liffId || ''

    if (!liffId) {
      onReady({ liffReady: false, inLineClient: false })
      return
    }

    // 2. 动态导入 LIFF SDK（避免 SSR/测试环境问题）
    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    _liffInstance = liff
    const isInClient = liff.isInClient()

    // 3. 获取真实 LINE 用户资料
    if (isInClient && liff.isLoggedIn()) {
      const lineProfile = await liff.getProfile()
      if (signal.cancelled) return

      // 4. 检查是否已关注 OA（用于 useFollowGate 快速判断）
      let isFriend: boolean | undefined
      try {
        const friendship = await liff.getFriendship()
        isFriend = friendship.friendFlag
      } catch {
        // getFriendship 需要 chat_message.write scope，不支持时静默忽略
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
    } else if (!isInClient && !liff.isLoggedIn() && import.meta.env.PROD) {
      liff.login()
      return
    }

    if (!signal.cancelled) {
      onReady({ liffReady: true, inLineClient: isInClient })
    }
  } catch (err) {
    console.warn('[LIFF] init failed, falling back to device user:', err)
    onReady({ liffReady: false, inLineClient: false })
  }
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({ liffReady: false, inLineClient: false })

  useEffect(() => {
    const signal = { cancelled: false }
    initLiff(setCtx, signal)
    return () => { signal.cancelled = true }
  }, [])

  return <LiffContext.Provider value={ctx}>{children}</LiffContext.Provider>
}
