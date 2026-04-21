/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider（重写版）
 *
 * 目标：
 * 1. 同一路径 + 同一 query 的 LIFF 初始化只做一次
 * 2. 防止 continue 页在 LINE 内反复重进时不断重复 fetch /api/growth/line/config
 * 3. 失败时只解锁 ctx，不再做额外 redirect / replace
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import useLineUserStore from '../store/lineUser'
import { resolveRuntimeLiffId, setRuntimeLineConfig } from '../lib/line'
import { clientLog } from '../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const LIFF_INIT_TIMEOUT_MS = 5000
const INIT_COOLDOWN_MS = 4000

export interface LiffContextValue {
  liffReady: boolean
  inLineClient: boolean
  liffChecked: boolean
}

function detectLineAppUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Line\/\d/i.test(navigator.userAgent)
}

export const LiffContext = createContext<LiffContextValue>({
  liffReady: false,
  inLineClient: false,
  liffChecked: false,
})

export function useLiff() {
  return useContext(LiffContext)
}

// 模块级缓存，只缓存已成功 import/init 的实例
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _liffInstance: any = null

export function getLiff() {
  return _liffInstance
}

function buildInitKey() {
  return `${window.location.pathname}${window.location.search}`
}

function getInitAttemptKey(initKey: string) {
  return `_liff_init_attempted:${initKey}`
}

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
  } catch {
    // ignore
  }
}

function clearInitAttempt(initKey: string) {
  try {
    sessionStorage.removeItem(getInitAttemptKey(initKey))
  } catch {
    // ignore
  }
}

async function initLiffOnce(
  onReady: (ctx: LiffContextValue) => void,
  signal: { cancelled: boolean },
  initKey: string
) {
  const inLineUA = detectLineAppUA()

  clientLog('liff_init_start', {
    pathname: window.location.pathname,
    search: window.location.search,
    in_line_ua: inLineUA,
  })

  if (shouldBlockInitByCooldown(initKey)) {
    clientLog('liff_init_blocked_by_cooldown', {
      pathname: window.location.pathname,
      search: window.location.search,
    })
    onReady({ liffReady: false, inLineClient: inLineUA, liffChecked: true })
    return
  }

  markInitAttempt(initKey)

  try {
    const res = await fetch(`${API_BASE}/api/growth/line/config`)
    const json = await res.json()
    setRuntimeLineConfig(json?.data || null)

    const liffId: string = resolveRuntimeLiffId(json?.data?.liffId)
    if (!liffId) {
      clientLog('liff_init_no_liff_id', {})
      onReady({ liffReady: false, inLineClient: false, liffChecked: true })
      return
    }

    const liff = (await import('@line/liff')).default
    await liff.init({ liffId })
    if (signal.cancelled) return

    _liffInstance = liff

    const isInClientSdk = (() => {
      try {
        return liff.isInClient()
      } catch {
        return false
      }
    })()
    const inLineClient = isInClientSdk || inLineUA

    clientLog('liff_init_done', {
      in_client_sdk: isInClientSdk,
      in_line_ua: inLineUA,
      in_line_client: inLineClient,
      logged_in: (() => {
        try {
          return liff.isLoggedIn()
        } catch {
          return false
        }
      })(),
    })

    if (!liff.isLoggedIn()) {
      clientLog('liff_not_logged_in_unlock', {
        pathname: window.location.pathname,
        search: window.location.search,
        in_line_client: inLineClient,
      })
      onReady({ liffReady: false, inLineClient, liffChecked: true })
      return
    }

    const lineProfile = await liff.getProfile()
    if (signal.cancelled) return

    try {
      const u = new URL(window.location.href)
      const STRIP_KEYS = [
        'code',
        'state',
        'liffClientId',
        'liffRedirectUri',
        'liffReferer',
        'liff.state',
        'error',
        'error_description',
      ]
      let touched = false
      for (const k of STRIP_KEYS) {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k)
          touched = true
        }
      }
      if (touched) {
        const cleanQs = u.searchParams.toString()
        const cleanUrl = u.pathname + (cleanQs ? `?${cleanQs}` : '') + u.hash
        window.history.replaceState(window.history.state, '', cleanUrl)
        clientLog('liff_url_cleaned', { pathname: u.pathname })
      }
    } catch {
      // ignore
    }

    let isFriend: boolean | undefined
    if (isInClientSdk) {
      try {
        const friendship = await liff.getFriendship()
        isFriend = friendship.friendFlag
      } catch {
        // ignore
      }
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
      isFriend,
    })

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
      } else {
        useLineUserStore.getState().setCanonicalUserId(lineProfile.userId)
      }
      const identityLevel = idData.identity_level || idData.identity_tag
      if (identityLevel) {
        useLineUserStore.getState().setIdentityTag(identityLevel)
      }
      if (typeof idData.is_fan === 'boolean') {
        useLineUserStore.getState().setIsFriend(idData.is_fan)
      }
    } catch {
      useLineUserStore.getState().setCanonicalUserId(lineProfile.userId)
    }

    clearInitAttempt(initKey)
    onReady({ liffReady: true, inLineClient, liffChecked: true })
  } catch (err) {
    console.warn('[LIFF] init failed:', err)
    onReady({ liffReady: false, inLineClient: inLineUA, liffChecked: true })
  }
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({
    liffReady: false,
    inLineClient: false,
    liffChecked: false,
  })

  const initStartedRef = useRef(false)
  const initResolvedRef = useRef(false)
  const initKeyRef = useRef('')

  useEffect(() => {
    const signal = { cancelled: false }
    const initKey = buildInitKey()

    if (initStartedRef.current && initKeyRef.current === initKey) {
      return
    }

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
      console.warn('[LIFF] init timeout after', LIFF_INIT_TIMEOUT_MS, 'ms')
      safeSetCtx({
        liffReady: false,
        inLineClient: detectLineAppUA(),
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
