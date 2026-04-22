import type { PendingIntentAction } from './pendingIntent'

type PendingIntentPayloadLike = {
  action?: PendingIntentAction | string
  return_path?: string
  success_path?: string
}

type PendingIntentResultLike = {
  nextPath?: string
  resultCode?: string
  action_result?: any
}

function resolveBasePath(
  payload: PendingIntentPayloadLike | null | undefined,
  result: PendingIntentResultLike | null | undefined,
  fallbackPath?: string
) {
  return String(
    result?.nextPath ||
      payload?.success_path ||
      payload?.return_path ||
      fallbackPath ||
      '/welfare'
  ).trim()
}

function updateInternalPathQuery(
  rawPath: string,
  update: (params: URLSearchParams) => void
) {
  const basePath = String(rawPath || '').trim()
  if (!basePath) return '/welfare'

  try {
    const url = new URL(basePath, window.location.origin)
    if (url.origin !== window.location.origin) return basePath
    update(url.searchParams)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return basePath
  }
}

function buildClaimSuccessPath(
  payload: PendingIntentPayloadLike | null | undefined,
  result: PendingIntentResultLike | null | undefined,
  fallbackPath?: string
) {
  const basePath = resolveBasePath(payload, result, fallbackPath)
  const actionResult = result?.action_result
  const userProductId = String(
    actionResult?.user_product?.id || actionResult?.user_product_id || ''
  ).trim()

  return updateInternalPathQuery(basePath, (params) => {
    params.set('owned', '1')
    params.set('source', 'claim_success')
    if (userProductId) {
      params.set('up', userProductId)
    }
  })
}

function buildActivitySuccessPath(
  payload: PendingIntentPayloadLike | null | undefined,
  result: PendingIntentResultLike | null | undefined,
  fallbackPath?: string
) {
  const basePath = resolveBasePath(payload, result, fallbackPath)
  const actionResult = result?.action_result || {}
  const resultCode = String(
    result?.resultCode ||
      (actionResult?.already_joined || actionResult?.alreadyJoined
        ? 'already_joined'
        : 'joined')
  ).trim()
  const pointsAwarded = Number(
    actionResult?.points_awarded ?? actionResult?.pointsAwarded ?? 0
  )

  return updateInternalPathQuery(basePath, (params) => {
    params.set('joined', '1')
    params.set('source', 'participate_success')
    params.set('result', resultCode || 'joined')
    if (pointsAwarded > 0) {
      params.set('points_awarded', String(pointsAwarded))
    } else {
      params.delete('points_awarded')
    }
  })
}

export function resolvePendingIntentNextPath({
  payload,
  result,
  fallbackPath,
}: {
  payload?: PendingIntentPayloadLike | null
  result?: PendingIntentResultLike | null
  fallbackPath?: string
}) {
  const action = String(payload?.action || '').trim()

  if (action === 'claim_coupon') {
    return buildClaimSuccessPath(payload, result, fallbackPath)
  }

  if (action === 'participate_activity') {
    return buildActivitySuccessPath(payload, result, fallbackPath)
  }

  return resolveBasePath(payload, result, fallbackPath)
}
