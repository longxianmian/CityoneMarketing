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

/**
 * 构造 LINE OA 加好友直链。
 * 外部浏览器场景下，"关注 OA" 必须用 https://line.me/R/ti/p/{basicId} 拉起 LINE app
 * 直接进入 OA 加好友页 —— 不能再用 LIFF URL（LIFF 在外部浏览器里会 redirect 回 LIFF
 * endpoint，反而触发 ContinuePage→OpenInLinePage 死循环，见 README-外部浏览器…）。
 *
 * basicId 形如 "@cityone_th"。本函数对 @ 做 URL 编码（%40），并对前后空格容错。
 * 配置里没填 OA basic id 时返回空串，调用方需做降级。
 */
export function buildOaAddFriendUrl(value?: string | null) {
  const raw = String(value ?? runtimeLineConfig.officialAccountId ?? '').trim()
  if (!raw) return ''
  // 去掉前置 @，统一编码后拼回
  const id = raw.replace(/^@+/, '')
  if (!id) return ''
  return `https://line.me/R/ti/p/%40${encodeURIComponent(id)}`
}

export function isRuntimeFollowGateReady() {
  if (!runtimeLineConfig.requireFollow) return true
  return !!runtimeLineConfig.officialAccountId && !!runtimeLineConfig.liffId
}
