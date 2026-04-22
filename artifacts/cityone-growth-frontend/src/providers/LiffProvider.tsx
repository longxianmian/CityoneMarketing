/**
 * LiffProvider — LINE LIFF SDK 初始化 Provider（重写版）
 *
 * 目标：
 * 1. 同一路径 + 同一 query 的 LIFF 初始化只做一次
 * 2. 防止 continue 页在 LINE 内反复重进时不断重复 fetch /api/growth/line/config
 * 3. 失败时只解锁 ctx，不再做额外 redirect / replace
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import useLineUserStore, { type IdentityTag, type LineUserProfile } from '../store/lineUser'
import { resolveRuntimeLiffId, setRuntimeLineConfig } from '../lib/line'
import { clientLog } from '../lib/clientLogger'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const LIFF_INIT_TIMEOUT_MS = 5000
const INIT_COOLDOWN_MS = 4000
const PERSISTED_READY_CTX_KEY = '_cityone_liff_ready_ctx_v1'
const PERSISTED_READY_CTX_TTL_MS = 2 * 60 * 1000
const PERSISTED_LINE_CONFIG_KEY = '_cityone_line_config_v1'
const PERSISTED_LINE_CONFIG_TTL_MS = 10 * 60 * 1000
const INIT_COOLDOWN_BYPASS_PATHS = new Set([
  '/welfare/continue',
  '/welfare/follow-confirm',
])

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
let _liffReadyCache:
  | {
      ctx: LiffContextValue
      profile: LineUserProfile | null
      canonicalUserId: string | null
    }
  | null = null

function readPersistedJson<T>(key: string, ttlMs: number) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts?: number; data?: T }
    const ts = Number(parsed?.ts || 0)
    if (!ts || Date.now() - ts > ttlMs) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed?.data ?? null
  } catch {
    return null
  }
}

function writePersistedJson<T>(key: string, data: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // ignore
  }
}

function readPersistedLineConfig() {
  return readPersistedJson<{
    channelId?: string
    officialAccountId?: string
    liffId?: string
    requireFollow?: boolean
  }>(PERSISTED_LINE_CONFIG_KEY, PERSISTED_LINE_CONFIG_TTL_MS)
}

function writePersistedLineConfig(value?: {
  channelId?: string
  officialAccountId?: string
  liffId?: string
  requireFollow?: boolean
} | null) {
  if (!value) return
  writePersistedJson(PERSISTED_LINE_CONFIG_KEY, value)
}

export function getLiff() {
  return _liffInstance
}

async function readLiffFriendship(liff: any, inLineContext: boolean) {
  if (!inLineContext || !liff || typeof liff.getFriendship !== 'function') {
    return undefined
  }

  try {
    const friendship = await liff.getFriendship()
    if (typeof friendship?.friendFlag === 'boolean') {
      return friendship.friendFlag
    }
  } catch {
    // ignore
  }

  return undefined
}

async function syncIdentifyFromLineProfile(
  lineProfile: { userId: string; displayName: string; pictureUrl?: string },
  isFriend?: boolean
) {
  let canonicalUserId = lineProfile.userId
  let resolvedIsFan = isFriend === true
  let identityLevel: string | undefined
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
    canonicalUserId = idData.user_id || lineProfile.userId
    if (typeof idData.is_fan === 'boolean') {
      resolvedIsFan = idData.is_fan
    }
    identityLevel = idData.identity_level || idData.identity_tag
  } catch {
    canonicalUserId = lineProfile.userId
  }

  const store = useLineUserStore.getState()
  store.clearProfile()
  store.setCanonicalUserId(canonicalUserId)

  const normalizedIdentityTag = (() => {
    const value = String(identityLevel || '').trim().toLowerCase()
    if (
      value === 'visitor' ||
      value === 'fan' ||
      value === 'customer' ||
      value === 'member' ||
      value === 'user'
    ) {
      return value as IdentityTag
    }
    return undefined
  })()

  if (resolvedIsFan) {
    store.setProfile({
      lineUserId: lineProfile.userId,
      lineDisplayName: lineProfile.displayName,
      linePictureUrl: lineProfile.pictureUrl || '',
      identityTag: normalizedIdentityTag,
      memberLevel: 'standard',
      points: 0,
      couponCount: 0,
      deposit: 0,
      depositPaid: false,
      isFriend: true,
    })
  }

  return {
    canonicalUserId,
    lineUserId: lineProfile.userId,
    isFriend: resolvedIsFan,
  }
}

function updateReadyCacheFromStore(
  lineProfile: { userId: string; displayName: string; pictureUrl?: string },
  inLineClient: boolean
) {
  _liffReadyCache = {
    ctx: { liffReady: true, inLineClient, liffChecked: true },
    profile: useLineUserStore.getState().profile || null,
    canonicalUserId: useLineUserStore.getState().canonicalUserId || lineProfile.userId,
  }
  writePersistedJson(PERSISTED_READY_CTX_KEY, _liffReadyCache)
}

export async function syncLiffFriendshipIdentity() {
  const liff = getLiff()
  if (!liff || typeof liff.getProfile !== 'function') {
    return { lineUserId: '', canonicalUserId: '', isFriend: undefined as boolean | undefined }
  }

  const inLineClient = (() => {
    try {
      return liff.isInClient?.() === true || detectLineAppUA()
    } catch {
      return detectLineAppUA()
    }
  })()

  const lineProfile = await liff.getProfile()
  const isFriend = await readLiffFriendship(liff, inLineClient)
  const synced = await syncIdentifyFromLineProfile(lineProfile, isFriend)
  updateReadyCacheFromStore(lineProfile, inLineClient)

  return {
    lineUserId: synced.lineUserId || lineProfile.userId,
    canonicalUserId: synced.canonicalUserId || lineProfile.userId,
    isFriend: synced.isFriend,
  }
}

function buildInitKey() {
  return `${window.location.pathname}${window.location.search}`
}

function getInitAttemptKey(initKey: string) {
  return `_liff_init_attempted:${initKey}`
}

function getInitCooldownRemainingMs(initKey: string) {
  try {
    const raw = sessionStorage.getItem(getInitAttemptKey(initKey))
    const ts = Number(raw || 0)
    if (!ts) return 0
    return Math.max(0, INIT_COOLDOWN_MS - (Date.now() - ts))
  } catch {
    return 0
  }
}

function shouldBypassInitCooldown() {
  const pathname = window.location.pathname || ''
  const search = window.location.search || ''
  return (
    INIT_COOLDOWN_BYPASS_PATHS.has(pathname) ||
    search.includes('code=') ||
    search.includes('liff.state=') ||
    search.includes('liff.hback=')
  )
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

function getReusableReadyCtx() {
  if (_liffInstance && _liffReadyCache?.ctx?.liffReady) {
    try {
      if (!_liffInstance.isLoggedIn()) return null
    } catch {
      return null
    }

    const inLineClient = _liffReadyCache.ctx.inLineClient || detectLineAppUA()
    return {
      ctx: {
        liffReady: true,
        inLineClient,
        liffChecked: true,
      } as LiffContextValue,
      profile: _liffReadyCache.profile || null,
      canonicalUserId: _liffReadyCache.canonicalUserId,
    }
  }

  const persistedReady = readPersistedJson<NonNullable<typeof _liffReadyCache>>(
    PERSISTED_READY_CTX_KEY,
    PERSISTED_READY_CTX_TTL_MS
  )
  if (!persistedReady?.ctx?.liffReady) return null

  _liffReadyCache = persistedReady
  const inLineClient = persistedReady.ctx.inLineClient || detectLineAppUA()
  return {
    ctx: {
      liffReady: true,
      inLineClient,
      liffChecked: true,
    } as LiffContextValue,
    profile: persistedReady.profile || null,
    canonicalUserId: persistedReady.canonicalUserId,
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

  const reusableReady = getReusableReadyCtx()
  if (reusableReady) {
    if (reusableReady.profile) {
      useLineUserStore.getState().mergeProfile(reusableReady.profile)
    } else {
      useLineUserStore.getState().clearProfile()
    }
    if (reusableReady.canonicalUserId) {
      useLineUserStore.getState().setCanonicalUserId(reusableReady.canonicalUserId)
    }
    clientLog('liff_init_reused_ready_ctx', {
      pathname: window.location.pathname,
      search: window.location.search,
      in_line_client: reusableReady.ctx.inLineClient,
    })
    onReady(reusableReady.ctx)
    return
  }

  const cooldownRemainingMs = getInitCooldownRemainingMs(initKey)
  if (cooldownRemainingMs > 0) {
    if (shouldBypassInitCooldown()) {
      clientLog('liff_init_cooldown_bypassed', {
        pathname: window.location.pathname,
        search: window.location.search,
        remaining_ms: cooldownRemainingMs,
      })
    } else {
      clientLog('liff_init_delayed_by_cooldown', {
        pathname: window.location.pathname,
        search: window.location.search,
        remaining_ms: cooldownRemainingMs,
      })
      await new Promise((resolve) => window.setTimeout(resolve, cooldownRemainingMs))
      if (signal.cancelled) return
    }
  }

  markInitAttempt(initKey)

  try {
    let lineConfig = readPersistedLineConfig()
    if (!lineConfig) {
      const res = await fetch(`${API_BASE}/api/growth/line/config`)
      const json = await res.json()
      lineConfig = json?.data || null
      writePersistedLineConfig(lineConfig)
    }
    setRuntimeLineConfig(lineConfig || null)

    const liffId: string = resolveRuntimeLiffId(lineConfig?.liffId)
    if (!liffId) {
      clearInitAttempt(initKey)
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
      clearInitAttempt(initKey)
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

    const isFriend = await readLiffFriendship(liff, inLineClient)
    await syncIdentifyFromLineProfile(lineProfile, isFriend)

    clearInitAttempt(initKey)
    updateReadyCacheFromStore(lineProfile, inLineClient)
    onReady({ liffReady: true, inLineClient, liffChecked: true })
  } catch (err) {
    clearInitAttempt(initKey)
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
      clearInitAttempt(initKey)
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
