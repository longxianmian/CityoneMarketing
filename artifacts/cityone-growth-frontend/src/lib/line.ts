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

function extractRuntimePathFromRedirectUri(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const decoded = decodeURIComponent(raw)
    const url = new URL(decoded, window.location.origin)
    if (url.origin !== window.location.origin) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    try {
      const url = new URL(raw, window.location.origin)
      if (url.origin !== window.location.origin) return ''
      return `${url.pathname}${url.search}${url.hash}`
    } catch {
      return ''
    }
  }
}

function parseRuntimeUrl(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    return new URL(raw, window.location.origin)
  } catch {
    try {
      return new URL(decodeURIComponent(raw), window.location.origin)
    } catch {
      return null
    }
  }
}

function readResumeTargetFromUrl(url: URL, depth = 0): { resumeKey: string; intentToken: string } {
  if (depth > 4) return { resumeKey: '', intentToken: '' }

  const resumeKey = (url.searchParams.get('resume_key') || url.searchParams.get('resume') || '').trim()
  if (resumeKey) return { resumeKey, intentToken: '' }

  const intentToken = (url.searchParams.get('resume_intent') || url.searchParams.get('intent') || '').trim()
  if (intentToken) return { resumeKey: '', intentToken }

  const liffState = url.searchParams.get('liff.state') || ''
  if (liffState) {
    const stateUrl = parseRuntimeUrl(liffState)
    if (stateUrl) {
      const nested = readResumeTargetFromUrl(stateUrl, depth + 1)
      if (nested.resumeKey || nested.intentToken) return nested
    }
  }

  const redirectUri = url.searchParams.get('liffRedirectUri') || ''
  if (redirectUri) {
    const redirectPath = extractRuntimePathFromRedirectUri(redirectUri)
    const redirectUrl = parseRuntimeUrl(redirectPath)
    if (redirectUrl) {
      const nested = readResumeTargetFromUrl(redirectUrl, depth + 1)
      if (nested.resumeKey || nested.intentToken) return nested
    }
  }

  return { resumeKey: '', intentToken: '' }
}

export function extractRuntimeResumeTarget(searchParams: URLSearchParams) {
  const url = new URL('/welfare', window.location.origin)
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.append(key, value)
  }
  return readResumeTargetFromUrl(url)
}

export function buildRuntimeContinueTargetFromResume(params: {
  resumeKey?: string
  intentToken?: string
}) {
  const resumeKey = String(params.resumeKey || '').trim()
  if (resumeKey) {
    return `/welfare/continue?resume_key=${encodeURIComponent(resumeKey)}&resume=1`
  }

  const intentToken = String(params.intentToken || '').trim()
  if (intentToken) {
    return `/welfare/continue?intent=${encodeURIComponent(intentToken)}&resume=1`
  }

  return ''
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
  const hasExternalLoginCallback = searchParams.has('code') && (
    searchParams.has('state') ||
    searchParams.has('liffClientId') ||
    searchParams.has('liffRedirectUri')
  )
  const hasLiffState = searchParams.has('liff.state')
  const hasDirectResume = searchParams.has('resume_key') ||
    searchParams.has('resume') ||
    searchParams.has('resume_intent')

  // `/welfare?resume_key=...` 是外部浏览器的登录启动页，不能马上改到
  // ContinuePage；必须先让 LiffProvider 完成外部 LIFF 登录。
  if (hasDirectResume && !hasExternalLoginCallback && !hasLiffState) return ''

  const resumeTarget = extractRuntimeResumeTarget(searchParams)
  const resumeContinueTarget = buildRuntimeContinueTargetFromResume(resumeTarget)
  if (resumeContinueTarget) return resumeContinueTarget

  if (hasExternalLoginCallback) {
    const redirectPath = extractRuntimePathFromRedirectUri(searchParams.get('liffRedirectUri'))
    if (redirectPath) {
      const redirectUrl = new URL(redirectPath, window.location.origin)
      const redirectResumeIntent = (redirectUrl.searchParams.get('resume_intent') || '').trim()
      if (redirectResumeIntent) {
        return `/welfare/continue?intent=${encodeURIComponent(redirectResumeIntent)}&resume=1`
      }
      const redirectIntent = (redirectUrl.searchParams.get('intent') || '').trim()
      if (redirectIntent) {
        if (isRuntimeLineClientUserAgent()) {
          return `/welfare/continue?intent=${encodeURIComponent(redirectIntent)}`
        }
        return `/welfare?resume_intent=${encodeURIComponent(redirectIntent)}&handoff=returned`
      }

      const normalizedRedirectPath = normalizeRuntimeLiffExtraPath(redirectPath)
      if (normalizedRedirectPath.startsWith('/welfare?')) {
        return normalizedRedirectPath
      }
      if (normalizedRedirectPath) {
        return normalizedRedirectPath
      }
    }
  }

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

export function isRuntimeExternalLiffLoginCallback(searchParams: URLSearchParams) {
  return searchParams.has('code') && (
    searchParams.has('state') ||
    searchParams.has('liffClientId') ||
    searchParams.has('liffRedirectUri')
  )
}

export function isRuntimeCallbackBootPath(pathname: string, search: string) {
  const params = new URLSearchParams(search || '')
  const hasCallbackPayload = params.has('intent') ||
    params.has('liff.state') ||
    isRuntimeExternalLiffLoginCallback(params)

  return (
    ((pathname === '/' || pathname === '/welfare') && hasCallbackPayload) ||
    pathname === '/welfare/continue' ||
    pathname === '/welfare/follow-confirm'
  )
}

export function isRuntimeHomeBootPath(pathname: string, search: string) {
  const params = new URLSearchParams(search || '')
  return pathname === '/welfare' &&
    !params.has('intent') &&
    !params.has('liff.state') &&
    !isRuntimeExternalLiffLoginCallback(params)
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

export function buildRuntimeLineSchemeUrlWithPath(extraPath?: string | null, value?: string | null) {
  const liffId = resolveRuntimeLiffId(value)
  if (!liffId) return ''
  const normalized = toRuntimeLiffEndpointExtraPath(extraPath)
  return `line://app/${liffId}${normalized}`
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
    continueLineSchemeUrl: buildRuntimeLineSchemeUrlWithPath(continueExtraPath, liffId),
    oaAddFriendUrl: buildOaAddFriendUrl(officialAccountId),
  }
}

export function buildResumeLaunchTargets(
  intentToken: string,
  liffId?: string | null,
  officialAccountId?: string | null,
  resumeKey?: string | null,
) {
  const key = String(resumeKey || '').trim()
  const resumeExtraPath = key
    ? `?resume_key=${encodeURIComponent(key)}`
    : `?resume_intent=${encodeURIComponent(intentToken)}`
  return {
    resumeLiffUrl: buildRuntimeLiffUrlWithPath(resumeExtraPath, liffId),
    resumeLineSchemeUrl: buildRuntimeLineSchemeUrlWithPath(resumeExtraPath, liffId),
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
