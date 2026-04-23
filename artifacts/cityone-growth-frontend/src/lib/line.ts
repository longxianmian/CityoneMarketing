type RuntimeLineConfig = {
  channelId: string
  officialAccountId: string
  liffId: string
  requireFollow: boolean
}

export type Terminal =
  | 'chrome'
  | 'safari'
  | 'line_client'
  | 'wechat_webview'
  | 'gsa_shell'
  | 'huawei_browser'
  | 'other'

const RUNTIME_WELFARE_CALLBACK_PATHS = [
  '/welfare',
  '/welfare/continue',
  '/welfare/follow-confirm',
] as const

const LEGACY_WELFARE_CALLBACK_PATH_ALIASES: Record<string, Extract<(typeof RUNTIME_WELFARE_CALLBACK_PATHS)[number], '/welfare/continue'>> = {
  '/continue': '/welfare/continue',
}

const runtimeLineConfig: RuntimeLineConfig = {
  channelId: '',
  officialAccountId: '',
  liffId: '',
  requireFollow: false,
}

function normalizeRuntimePath(value?: string | null, fallback = '') {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  let normalized = raw
  if (normalized.startsWith(window.location.origin)) {
    normalized = normalized.slice(window.location.origin.length)
  }

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  return normalized.replace(/^\/+/, '/')
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
  if (raw.startsWith('?')) {
    return `/welfare${raw}`
  }

  const normalizedRaw = normalizeRuntimePath(raw, '')
  if (!normalizedRaw) return ''

  let normalized = normalizedRaw
  if (normalized === '/welfare') return ''
  if (LEGACY_WELFARE_CALLBACK_PATH_ALIASES[normalized]) {
    return LEGACY_WELFARE_CALLBACK_PATH_ALIASES[normalized]
  }
  return normalized
}

export function isRuntimeWelfareCallbackExtraPath(value?: string | null) {
  const normalized = normalizeRuntimeLiffExtraPath(value)
  if (!normalized) return false
  return RUNTIME_WELFARE_CALLBACK_PATHS.some((basePath) => (
    normalized === basePath || normalized.startsWith(`${basePath}?`)
  ))
}

export function resolveRuntimeWelfareCallbackTarget(searchParams: URLSearchParams) {
  const explicitResumeIntent = (searchParams.get('resume_intent') || '').trim()
  if (explicitResumeIntent) return ''

  const intent = searchParams.get('intent') || ''
  if (intent) {
    if (isRuntimeLineClientUserAgent()) {
      return `/welfare/continue?intent=${encodeURIComponent(intent)}`
    }
    return `/welfare?resume_intent=${encodeURIComponent(intent)}`
  }

  const liffState = searchParams.get('liff.state') || ''
  if (!liffState) return ''

  const decoded = decodeURIComponent(liffState)
  const normalized = normalizeRuntimeLiffExtraPath(decoded)
  if (!isRuntimeWelfareCallbackExtraPath(normalized)) return ''

   if (normalized.startsWith('/welfare?')) {
    return normalized
  }

  if (!isRuntimeLineClientUserAgent() && isRuntimeContinuePath(normalized)) {
    try {
      const url = new URL(normalized, window.location.origin)
      const callbackIntent = url.searchParams.get('intent') || ''
      return callbackIntent
        ? `/welfare?resume_intent=${encodeURIComponent(callbackIntent)}&handoff=returned`
        : '/welfare?handoff=returned'
    } catch {
      return '/welfare?handoff=returned'
    }
  }

  return normalized
}

export function isRuntimeCallbackBootPath(pathname: string, search: string) {
  const params = new URLSearchParams(search || '')
  const hasCallbackPayload = params.has('intent') || params.has('liff.state')

  return (
    ((pathname === '/' || pathname === '/welfare') && hasCallbackPayload) ||
    pathname === '/welfare/continue' ||
    pathname === '/welfare/follow-confirm'
  )
}

export function isRuntimeHomeBootPath(pathname: string, search: string) {
  const params = new URLSearchParams(search || '')
  return pathname === '/welfare' && !params.has('intent') && !params.has('liff.state')
}

function toRuntimeLiffEndpointExtraPath(value?: string | null) {
  const normalized = normalizeRuntimeLiffExtraPath(value)
  if (!normalized) return ''

  if (normalized.startsWith('/welfare?')) {
    return normalized.slice('/welfare'.length)
  }

  for (const [legacyPath, canonicalPath] of Object.entries(LEGACY_WELFARE_CALLBACK_PATH_ALIASES)) {
    if (normalized === canonicalPath) return legacyPath
    if (normalized.startsWith(`${canonicalPath}?`)) {
      return `${legacyPath}${normalized.slice(canonicalPath.length)}`
    }
  }

  return normalized
}

export function buildRuntimeLiffUrlWithPath(extraPath?: string | null, value?: string | null) {
  const liffUrl = resolveRuntimeLiffUrl(value)
  if (!liffUrl) return ''
  const normalized = toRuntimeLiffEndpointExtraPath(extraPath)
  return `${liffUrl}${normalized}`
}

/**
 * 构造 LINE OA 加好友直链。
 * 外部浏览器场景下，"关注 OA" 必须用 https://line.me/R/ti/p/{basicId} 拉起 LINE app
 * 直接进入 OA 加好友页 —— 不能再用 LIFF URL（LIFF 在外部浏览器里会 redirect 回 LIFF
 * endpoint，反而触发 ContinuePage→follow-confirm 门控页循环，见 README-外部浏览器…）。
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

export function buildContinueLaunchTargets(
  intentToken: string,
  liffId?: string | null,
  officialAccountId?: string | null,
) {
  const continueExtraPath = `/welfare/continue?intent=${encodeURIComponent(intentToken)}`
  return {
    continueLiffUrl: buildRuntimeLiffUrlWithPath(continueExtraPath, liffId),
    oaAddFriendUrl: buildOaAddFriendUrl(officialAccountId),
  }
}

export function buildResumeLaunchTargets(
  intentToken: string,
  liffId?: string | null,
  officialAccountId?: string | null,
) {
  const resumeExtraPath = `?resume_intent=${encodeURIComponent(intentToken)}`
  return {
    resumeLiffUrl: buildRuntimeLiffUrlWithPath(resumeExtraPath, liffId),
    oaAddFriendUrl: buildOaAddFriendUrl(officialAccountId),
  }
}

export function isRuntimeFollowGateReady() {
  if (!runtimeLineConfig.requireFollow) return true
  return !!runtimeLineConfig.officialAccountId && !!runtimeLineConfig.liffId
}

export function isRuntimeSchemePreferredBrowser(ua?: string | null) {
  const raw = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).trim()
  if (!raw) return false
  return false
}

export function isRuntimeWeChatBrowser(ua?: string | null) {
  const raw = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).trim()
  if (!raw) return false
  return /MicroMessenger|XWEB/i.test(raw)
}

export function isRuntimeLineClientUserAgent(ua?: string | null) {
  const raw = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).trim()
  if (!raw) return false
  return /Line\/\d/i.test(raw)
}

export function isRuntimeGsaShell(ua?: string | null) {
  const raw = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).trim()
  if (!raw) return false
  return /GSA\//i.test(raw)
}

export function isRuntimeHuaweiBrowser(ua?: string | null) {
  const raw = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).trim()
  if (!raw) return false
  return /HuaweiBrowser/i.test(raw)
}

export function detectTerminal(userAgent: string = navigator.userAgent): Terminal {
  if (isRuntimeLineClientUserAgent(userAgent)) return 'line_client'
  if (isRuntimeWeChatBrowser(userAgent)) return 'wechat_webview'
  if (/GSA\//i.test(userAgent)) return 'gsa_shell'
  if (isRuntimeHuaweiBrowser(userAgent)) return 'huawei_browser'
  if (/CriOS|Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return 'chrome'
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'safari'
  return 'other'
}

export function isDesktopBrowser(userAgent: string = navigator.userAgent): boolean {
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)) return false
  if (isRuntimeLineClientUserAgent(userAgent)) return false
  return true
}

function isRuntimeContinuePath(value?: string | null) {
  const normalized = normalizeRuntimeLiffExtraPath(value)
  if (!normalized) return false
  return normalized === '/welfare/continue' || normalized.startsWith('/welfare/continue?')
}
