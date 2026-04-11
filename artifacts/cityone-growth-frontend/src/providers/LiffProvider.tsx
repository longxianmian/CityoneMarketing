/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider
 *
 * 使用非 hook 方式初始化（避免 @line/liff 内置 React 与应用 React 版本冲突）：
 *   - initLiff() 作为普通 async 函数在组件外执行
 *   - 通过 useLineUserStore.getState().setProfile() 更新 store（无需 hook）
 *   - LiffProvider 组件仅作挂载触发，无 hook 调用
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

let _liffInitiated = false

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
      // 未配置 LIFF ID，静默跳过
      onReady({ liffReady: false, inLineClient: false })
      return
    }

    // 2. 动态导入 LIFF SDK（避免 SSR/测试环境问题）
    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    const isInClient = liff.isInClient()

    // 3. 获取真实 LINE 用户资料
    if (isInClient && liff.isLoggedIn()) {
      const lineProfile = await liff.getProfile()
      if (signal.cancelled) return

      // 通过 getState() 更新 store（不使用 hook，避免 React 版本冲突）
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
      })

      // 将 LINE 资料同步到后端（fire and forget）
      fetch(`${API_BASE}/api/user/sync-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineProfile.userId,
          line_display_name: lineProfile.displayName,
          line_picture_url: lineProfile.pictureUrl || '',
        }),
      }).catch(() => {})
    } else if (!isInClient && !liff.isLoggedIn() && import.meta.env.PROD) {
      // 生产环境在外部浏览器触发 LINE 登录
      liff.login()
      return
    }

    if (!signal.cancelled) {
      onReady({ liffReady: true, inLineClient: isInClient })
    }
  } catch (err) {
    // LIFF 初始化失败（不支持的浏览器、未配置等）—— 静默降级
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
