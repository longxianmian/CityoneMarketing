type RuntimeLineConfig = {
  channelId: string
  officialAccountId: string
  liffId: string
  requireFollow: boolean
}

const runtimeLineConfig: RuntimeLineConfig = {
  channelId: '',
  officialAccountId: '',
  liffId: '',
  requireFollow: false,
}

export function setRuntimeLineConfig(value?: Partial<RuntimeLineConfig> | null) {
  runtimeLineConfig.channelId = String(value?.channelId || '').trim()
  runtimeLineConfig.officialAccountId = String(value?.officialAccountId || '').trim()
  runtimeLineConfig.liffId = String(value?.liffId || '').trim()
  runtimeLineConfig.requireFollow = value?.requireFollow === true
}

export function getRuntimeLineConfig() {
  return { ...runtimeLineConfig }
}

export function resolveRuntimeLiffId(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed || runtimeLineConfig.liffId
}

export function resolveRuntimeLiffUrl(value?: string | null) {
  const liffId = resolveRuntimeLiffId(value)
  return liffId ? `https://liff.line.me/${liffId}` : ''
}

export function normalizeRuntimeLiffExtraPath(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  let normalized = raw
  if (normalized.startsWith(window.location.origin)) {
    normalized = normalized.slice(window.location.origin.length)
  }

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (normalized === '/welfare') return ''
  if (normalized.startsWith('/welfare/')) {
    normalized = normalized.slice('/welfare'.length)
  }

  normalized = normalized.replace(/^\/+/, '/')
  return normalized
}

export function buildRuntimeLiffUrlWithPath(extraPath?: string | null, value?: string | null) {
  const liffUrl = resolveRuntimeLiffUrl(value)
  if (!liffUrl) return ''
  const normalized = normalizeRuntimeLiffExtraPath(extraPath)
  return `${liffUrl}${normalized}`
}

export function buildRuntimeLineSchemeUrlWithPath(extraPath?: string | null, value?: string | null) {
  const liffId = resolveRuntimeLiffId(value)
  if (!liffId) return ''
  const normalized = normalizeRuntimeLiffExtraPath(extraPath)
  return `line://app/${liffId}${normalized}`
}

export function buildOaAddFriendUrl(value?: string | null) {
  const raw = String(value || runtimeLineConfig.officialAccountId || '').trim()
  if (!raw) return ''
  const officialAccountId = raw.startsWith('@') ? raw.slice(1) : raw
  if (!officialAccountId) return ''
  return `https://line.me/R/ti/p/@${encodeURIComponent(officialAccountId)}`
}

export function buildContinueLaunchTargets(
  intentToken: string,
  liffId?: string | null,
  officialAccountId?: string | null,
) {
  const continueExtraPath = `/continue?intent=${encodeURIComponent(intentToken)}`
  return {
    continueLiffUrl: buildRuntimeLiffUrlWithPath(continueExtraPath, liffId),
    continueLineSchemeUrl: buildRuntimeLineSchemeUrlWithPath(continueExtraPath, liffId),
    oaAddFriendUrl: buildOaAddFriendUrl(officialAccountId),
  }
}

export function isRuntimeFollowGateReady() {
  if (!runtimeLineConfig.requireFollow) return true
  return !!runtimeLineConfig.officialAccountId && !!runtimeLineConfig.liffId
}
