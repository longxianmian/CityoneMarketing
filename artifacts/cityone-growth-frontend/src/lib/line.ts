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
 * 构造 LINE app URL scheme（line://app/<liffId>?<query>）。
 * 用作 https://liff.line.me/... Universal Link 在某些设备/浏览器拉不起 LINE app
 * 时的兜底（已安装 LINE 时 line:// 直接被系统拦截拉起 LINE）。桌面浏览器无 LINE
 * 时点击不会有任何反应，所以只作为辅助链接，不替代主按钮的 https URL。
 *
 * extraPath 形如 "/continue?intent=xxx"。LINE app URL scheme 不支持 path-style，
 * 所有参数必须编码进 query；这里把 extraPath 的 query 拆开拼到 line:// app 后。
 */
export function buildRuntimeLineSchemeUrlWithPath(extraPath?: string | null, value?: string | null) {
  const liffId = resolveRuntimeLiffId(value)
  if (!liffId) return ''
  const normalized = normalizeRuntimeLiffExtraPath(extraPath)
  if (!normalized) return `line://app/${liffId}`
  // normalized 形如 "/continue?intent=xxx"，转成 line app 的 query 形式
  const [pathPart, search = ''] = normalized.split('?')
  const params = new URLSearchParams(search)
  // path 段塞回 query 让 LIFF endpoint 端能复原（LIFF endpoint 配的是 /welfare 根，
  // path 段需要 LIFF 入口自行处理）。简化：仅保留 query，LIFF endpoint 会按 query 决定路由。
  const cleanedPath = pathPart.replace(/^\//, '')
  if (cleanedPath) params.set('liff_path', cleanedPath)
  const qs = params.toString()
  return qs ? `line://app/${liffId}?${qs}` : `line://app/${liffId}`
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
