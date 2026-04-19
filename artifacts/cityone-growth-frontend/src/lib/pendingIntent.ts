const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export type PendingIntentAction =
  | 'claim_coupon'
  | 'participate_activity'
  | 'redeem_product'
  | 'use_benefit'

type IssuePendingIntentInput = {
  userId?: string
  lineUserId?: string
  action: PendingIntentAction
  resourceId: string
  returnPath: string
  successPath?: string
  failPath?: string
  backPath: string
  actionName?: string
  source?: Record<string, any>
}

export async function issuePendingIntent(input: IssuePendingIntentInput) {
  const res = await fetch(`${API_BASE}/api/user/pending-intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: input.userId || '',
      line_user_id: input.lineUserId || '',
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
  if (!res.ok || json?.code !== 200) {
    throw new Error(json?.msg || 'pending intent 消费失败')
  }
  return json.data as {
    replayed: boolean
    payload: any
    result: {
      nextPath?: string
      resultCode?: string
      action_result?: any
      // 后端 pending-intent-service 对 status='failed' 的 intent 在 replay 时
      // 会返回 { error: true, code, message }（见 services/pending-intent-service.js 269-275）
      error?: boolean
      code?: string
      message?: string
    }
  }
}

export function decodePendingIntentPayload(token: string) {
  try {
    const [encoded] = String(token || '').trim().split('.')
    if (!encoded) return null
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}
