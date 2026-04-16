export const FALLBACK_LIFF_ID = '2009152040-0m567HUo'
export const FALLBACK_LIFF_URL = `https://liff.line.me/${FALLBACK_LIFF_ID}`

export function resolveRuntimeLiffId(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed || FALLBACK_LIFF_ID
}

export function resolveRuntimeLiffUrl(value?: string | null) {
  const liffId = resolveRuntimeLiffId(value)
  return `https://liff.line.me/${liffId}`
}
