/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider
 *
 * 先读规范再改代码：
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-identity-and-business-levels.md
 * - /Users/lxtx/Documents/New project/CityoneMarketing/docs/specs/marketing-external-browser-line-continue-flow.md
 *
 * 强约束：
 * - 这里负责 LINE 身份建立，不负责前端自行推断业务身份等级
 * - 不允许根据头像、昵称、points 账户等本地/历史数据推断 fan/customer/member
 * - 用户端业务身份只能以后端 /api/user/profile/me 与 /api/user/check-follow 为真源
 *
 * 使用非 hook 方式初始化（避免 @line/liff 内置 React 与应用 React 版本冲突）：
 *   - initLiff() 作为普通 async 函数在组件外执行
 *   - 通过 useLineUserStore.getState().setProfile() 更新 store（无需 hook）
 *   - 暴露 getLiff() 让页面可以直接调用 liff.getFriendship() 等 API
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import useLineUserStore from '../store/lineUser'
import { resolveRuntimeLiffId, setRuntimeLineConfig } from '../lib/line'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const LIFF_INIT_TIMEOUT_MS = 5000
const INIT_COOLDOWN_MS = 4000

export interface LiffContextValue {
  liffReady: boolean
  inLineContext: boolean
  needLineLogin: boolean
  liffChecked: boolean
}

export const LiffContext = createContext<LiffContextValue>({
  liffReady: false,
  inLineContext: false,
  needLineLogin: false,
  liffChecked: false,
})

export function useLiff() {
  return useContext(LiffContext)
}

// 模块级缓存，页面组件可通过 getLiff() 直接调用 LIFF API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _liffInstance: any = null

/** 获取已初始化的 liff 实例（可能为 null，需判断）*/
export function getLiff() {
  return _liffInstance
}

function detectLineAppUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Line\/\d/i.test(navigator.userAgent)
}

function buildInitKey() {
  return `${window.location.pathname}${window.location.search}`
}

function getInitAttemptKey(initKey: string) {
  return `_liff_init_attempted:${initKey}`
}

function shouldBlockInitByCooldown(initKey: string) {
  try {
    const raw = sessionStorage.getItem(getInitAttemptKey(initKey))
    const ts = Number(raw || 0)
    if (!ts) return false
    return Date.now() - ts < INIT_COOLDOWN_MS
  } catch {
    return false
  }
}

function markInitAttempt(initKey: string) {
  try {
    sessionStorage.setItem(getInitAttemptKey(initKey), String(Date.now()))
  } catch {}
}

function clearInitAttempt(initKey: string) {
  try {
    sessionStorage.removeItem(getInitAttemptKey(initKey))
  } catch {}
}

async function initLiffOnce(
  onReady: (ctx: LiffContextValue) => void,
  signal: { cancelled: boolean },
  initKey: string,
) {
  const inLineUA = detectLineAppUA()

  if (shouldBlockInitByCooldown(initKey)) {
    onReady({
      liffReady: false,
      inLineContext: inLineUA,
      needLineLogin: false,
      liffChecked: true,
    })
    return
  }

  markInitAttempt(initKey)

  try {
    const res = await fetch(`${API_BASE}/api/growth/line/config`)
    const json = await res.json()
    setRuntimeLineConfig(json?.data || null)

    const liffId = resolveRuntimeLiffId(json?.data?.liffId)
    if (!liffId) {
      clearInitAttempt(initKey)
      onReady({
        liffReady: false,
        inLineContext: inLineUA,
        needLineLogin: false,
        liffChecked: true,
      })
      return
    }

    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    _liffInstance = liff
    const inLineContext =
      (typeof liff.isInClient === 'function' ? liff.isInClient() : false) || inLineUA

    if (!liff.isLoggedIn()) {
      clearInitAttempt(initKey)
      onReady({
        liffReady: false,
        inLineContext,
        needLineLogin: true,
        liffChecked: true,
      })
      return
    }

    const lineProfile = await liff.getProfile()
    if (signal.cancelled) return

    try {
      const url = new URL(window.location.href)
      const stripKeys = ['code', 'state', 'liffClientId', 'liffRedirectUri', 'liffReferer', 'liff.state', 'error', 'error_description']
      let touched = false
      for (const key of stripKeys) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key)
          touched = true
        }
      }
      if (touched) {
        const cleanQs = url.searchParams.toString()
        const cleanUrl = url.pathname + (cleanQs ? `?${cleanQs}` : '') + url.hash
        window.history.replaceState(window.history.state, '', cleanUrl)
      }
    } catch {}

    let localFriendHint: boolean | undefined
    if (typeof liff.isInClient === 'function' && liff.isInClient()) {
      try {
        const friendship = await liff.getFriendship()
        localFriendHint = friendship.friendFlag
      } catch {}
    }

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
      isFriend: localFriendHint,
    })

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
      useLineUserStore.getState().setCanonicalUserId(idData.user_id || lineProfile.userId)
      if (idData.identity_level || idData.identity_tag) {
        useLineUserStore.getState().setIdentityTag(idData.identity_level || idData.identity_tag)
      }
      if (typeof idData.is_fan === 'boolean') {
        useLineUserStore.getState().setIsFriend(idData.is_fan)
      }
    } catch {
      useLineUserStore.getState().setCanonicalUserId(lineProfile.userId)
    }

    clearInitAttempt(initKey)
    onReady({
      liffReady: true,
      inLineContext,
      needLineLogin: false,
      liffChecked: true,
    })
  } catch (err) {
    console.warn('[LIFF] init failed, production LINE identity is unavailable:', err)
    clearInitAttempt(initKey)
    onReady({
      liffReady: false,
      inLineContext: inLineUA,
      needLineLogin: false,
      liffChecked: true,
    })
  }
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({
    liffReady: false,
    inLineContext: false,
    needLineLogin: false,
    liffChecked: false,
  })
  const initStartedRef = useRef(false)
  const initResolvedRef = useRef(false)
  const initKeyRef = useRef('')

  useEffect(() => {
    const signal = { cancelled: false }
    const initKey = buildInitKey()

    if (initStartedRef.current && initKeyRef.current === initKey) return

    initStartedRef.current = true
    initResolvedRef.current = false
    initKeyRef.current = initKey

    let timer = 0
    const safeSetCtx = (next: LiffContextValue) => {
      if (signal.cancelled || initResolvedRef.current) return
      initResolvedRef.current = true
      window.clearTimeout(timer)
      setCtx(next)
    }

    timer = window.setTimeout(() => {
      if (signal.cancelled || initResolvedRef.current) return
      safeSetCtx({
        liffReady: false,
        inLineContext: detectLineAppUA(),
        needLineLogin: false,
        liffChecked: true,
      })
    }, LIFF_INIT_TIMEOUT_MS)

    void initLiffOnce(safeSetCtx, signal, initKey)

    return () => {
      signal.cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return <LiffContext.Provider value={ctx}>{children}</LiffContext.Provider>
}
