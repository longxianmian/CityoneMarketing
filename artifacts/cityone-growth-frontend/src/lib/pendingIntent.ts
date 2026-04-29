import { buildLiffContinueUrl } from './line'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export type PendingIntentAction =
  | 'claim_coupon'
  | 'participate_activity'
  | 'redeem_product'
  | 'use_benefit'

export type PendingIntentTargetType = 'coupon' | 'activity' | 'product' | 'benefit'

export type PendingIntentStatus =
  | 'pending'
  | 'identified'
  | 'waiting_follow'
  | 'executing'
  | 'consumed'
  | 'expired'
  | 'failed'

type CreatePendingIntentInput = {
  actionType: PendingIntentAction
  targetType: PendingIntentTargetType
  targetId: string
  sourceUrl: string
  attributionParams?: Record<string, any>
  terminalSource?: string
  returnPath?: string
  successPath?: string
  failPath?: string
  backPath?: string
  actionName?: string
  userId?: string
  lineUserId?: string
}

export type PendingIntentRecord = {
  intent_id: string
  action_type: PendingIntentAction
  target_type: PendingIntentTargetType | string
  target_id: string
  source_url?: string
  attribution_params?: Record<string, any>
  terminal_source?: string
  status: PendingIntentStatus
  expires_at?: string
  consumed_at?: string | null
  result?: any
  last_error?: string | null
}

export async function createPendingIntentAndContinue(input: CreatePendingIntentInput) {
  const res = await fetch(`${API_BASE}/api/user/pending-intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: input.userId || '',
      line_user_id: input.lineUserId || '',
      action_type: input.actionType,
      action: input.actionType,
      target_type: input.targetType,
      target_id: input.targetId,
      resource_id: input.targetId,
      source_url: input.sourceUrl,
      attribution_params: input.attributionParams || {},
      terminal_source: input.terminalSource || '',
      terminal: input.terminalSource || '',
      return_path: input.returnPath || input.sourceUrl,
      success_path: input.successPath || input.sourceUrl,
      fail_path: input.failPath || input.sourceUrl,
      back_path: input.backPath || input.sourceUrl,
      action_name: input.actionName || '',
      source: input.attributionParams || {},
    }),
  })
  const json = await res.json()
  const data = json?.data || {}
  const intentId = String(data.intent_id || data?.payload?.intent_id || '').trim()
  if (!res.ok || json?.code !== 200 || !intentId) {
    throw new Error(json?.msg || 'pending intent 创建失败')
  }
  return {
    intent_id: intentId,
    continue_url: data.continue_url || `/welfare/continue?intent=${encodeURIComponent(intentId)}`,
    liff_continue_url: data.liff_continue_url || buildLiffContinueUrl(intentId),
    expires_at: data.expires_at || data?.payload?.expires_at || '',
  }
}

export async function fetchPendingIntent(intentId: string) {
  const normalized = String(intentId || '').trim()
  if (!normalized) throw new Error('缺少 intent_id')

  const res = await fetch(`${API_BASE}/api/user/pending-intents/${encodeURIComponent(normalized)}`)
  const json = await res.json()
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || 'pending intent 查询失败')
  }
  return json.data as PendingIntentRecord
}

export async function consumePendingIntent({
  token,
  intentId,
  consumeKey,
  userId,
  lineUserId,
}: {
  token?: string
  intentId?: string
  consumeKey?: string
  userId?: string
  lineUserId?: string
}) {
  const normalizedIntentId = String(intentId || '').trim()
  const endpoint = normalizedIntentId
    ? `${API_BASE}/api/user/pending-intents/${encodeURIComponent(normalizedIntentId)}/consume`
    : `${API_BASE}/api/user/pending-intents/consume`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token || '',
      intent_id: normalizedIntentId,
      consume_key: consumeKey || '',
      idempotency_key: consumeKey || '',
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
