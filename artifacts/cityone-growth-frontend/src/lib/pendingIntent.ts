const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const PERSISTED_RESUME_INTENT_KEY = '_cityone_resume_pending_v1'
const PERSISTED_RESUME_INTENT_TTL_MS = 30 * 60 * 1000

export type PendingIntentAction =
  | 'claim_coupon'
  | 'participate_activity'
  | 'redeem_product'
  | 'use_benefit'

type IssuePendingIntentInput = {
  userId?: string
  lineUserId?: string
  terminal?: string
  action: PendingIntentAction
  resourceId: string
  returnPath: string
  successPath?: string
  failPath?: string
  backPath: string
  actionName?: string
  source?: Record<string, any>
}

type PersistedResumeIntent = {
  token: string
  ts: number
}

function readRawResumeIntent(storage: Storage | undefined | null) {
  if (!storage) return null
  try {
    const raw = storage.getItem(PERSISTED_RESUME_INTENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedResumeIntent
    if (!parsed?.token || !parsed?.ts) {
      storage.removeItem(PERSISTED_RESUME_INTENT_KEY)
      return null
    }
    if (Date.now() - Number(parsed.ts) > PERSISTED_RESUME_INTENT_TTL_MS) {
      storage.removeItem(PERSISTED_RESUME_INTENT_KEY)
      return null
    }
    return parsed
  } catch {
    try {
      storage.removeItem(PERSISTED_RESUME_INTENT_KEY)
    } catch {
      // ignore
    }
    return null
  }
}

function writeRawResumeIntent(storage: Storage | undefined | null, value: PersistedResumeIntent) {
  if (!storage) return
  try {
    storage.setItem(PERSISTED_RESUME_INTENT_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function clearRawResumeIntent(storage: Storage | undefined | null) {
  if (!storage) return
  try {
    storage.removeItem(PERSISTED_RESUME_INTENT_KEY)
  } catch {
    // ignore
  }
}

export function writePendingIntentResume(token: string) {
  const normalized = String(token || '').trim()
  if (!normalized) return
  const payload = { token: normalized, ts: Date.now() }
  writeRawResumeIntent(typeof sessionStorage !== 'undefined' ? sessionStorage : null, payload)
  writeRawResumeIntent(typeof localStorage !== 'undefined' ? localStorage : null, payload)
}

export function readPendingIntentResume() {
  const sessionValue = readRawResumeIntent(
    typeof sessionStorage !== 'undefined' ? sessionStorage : null
  )
  if (sessionValue?.token) return sessionValue.token

  const localValue = readRawResumeIntent(
    typeof localStorage !== 'undefined' ? localStorage : null
  )
  if (localValue?.token) {
    writeRawResumeIntent(typeof sessionStorage !== 'undefined' ? sessionStorage : null, localValue)
    return localValue.token
  }
  return ''
}

export function clearPendingIntentResume(token?: string) {
  const expected = String(token || '').trim()
  const sessionValue = readRawResumeIntent(
    typeof sessionStorage !== 'undefined' ? sessionStorage : null
  )
  const localValue = readRawResumeIntent(
    typeof localStorage !== 'undefined' ? localStorage : null
  )
  const shouldClearSession = !expected || sessionValue?.token === expected
  const shouldClearLocal = !expected || localValue?.token === expected
  if (shouldClearSession) {
    clearRawResumeIntent(typeof sessionStorage !== 'undefined' ? sessionStorage : null)
  }
  if (shouldClearLocal) {
    clearRawResumeIntent(typeof localStorage !== 'undefined' ? localStorage : null)
  }
}

export async function issuePendingIntent(input: IssuePendingIntentInput) {
  const res = await fetch(`${API_BASE}/api/user/pending-intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: input.userId || '',
      line_user_id: input.lineUserId || '',
      terminal: input.terminal || '',
      action: input.action,
      resource_id: input.resourceId,
      return_path: input.returnPath,
      success_path: input.successPath || input.returnPath,
      fail_path: input.failPath || input.returnPath,
      back_path: input.backPath,
      action_name: input.actionName || '',
      source: input.source || {},
    }),
  })
  const json = await res.json()
  if (!res.ok || json?.code !== 200 || !json?.data?.token) {
    throw new Error(json?.msg || 'pending intent 创建失败')
  }
  return json.data as { token: string; payload: any }
}

export async function consumePendingIntent({
  token,
  userId,
  lineUserId,
}: {
  token: string
  userId?: string
  lineUserId?: string
}) {
  const res = await fetch(`${API_BASE}/api/user/pending-intents/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      user_id: userId || '',
      line_user_id: lineUserId || '',
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.msg || 'pending intent 消费失败')
  }
  if (json?.code === 200) {
    return json.data as {
      replayed: boolean
      payload: any
      result: {
        nextPath?: string
        resultCode?: string
        action_result?: any
        error?: boolean
        code?: string
        message?: string
      }
    }
  }
  if (json?.code === 4090) {
    return {
      replayed: true,
      payload: json?.data?.payload,
      result: {
        ...(json?.data?.result || {}),
        error: true,
        message: json?.msg || json?.data?.result?.message || 'pending intent 已失败',
      },
    } as {
      replayed: boolean
      payload: any
      result: {
        nextPath?: string
        resultCode?: string
        action_result?: any
        error?: boolean
        code?: string
        message?: string
      }
    }
  }
  throw new Error(json?.msg || 'pending intent 消费失败')
}

export async function fetchLatestPendingIntent({
  userId,
  lineUserId,
}: {
  userId?: string
  lineUserId?: string
}) {
  const params = new URLSearchParams()
  if (userId) params.set('user_id', userId)
  if (lineUserId) params.set('line_user_id', lineUserId)
  if (!params.toString()) return null

  const res = await fetch(`${API_BASE}/api/user/pending-intents/latest?${params.toString()}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || 'pending intent 查询失败')
  }

  if (!json?.data?.token) return null
  return json.data as { token: string; payload: any }
}

export function decodePendingIntentPayload(token: string) {
  try {
    const [encoded] = String(token || '').trim().split('.')
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const json = new TextDecoder('utf-8').decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}
