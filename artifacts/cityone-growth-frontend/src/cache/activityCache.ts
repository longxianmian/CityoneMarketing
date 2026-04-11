const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: any
  cachedAt: number
}

const _map = new Map<string, CacheEntry>()

export function getCachedActivity(id: string): any | null {
  const entry = _map.get(id)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) { _map.delete(id); return null }
  return entry.data
}

export function setCachedActivity(id: string, data: any) {
  _map.set(id, { data, cachedAt: Date.now() })
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function prefetchActivity(id: string) {
  if (getCachedActivity(id)) return
  fetch(`${API_BASE}/api/activities/${id}`)
    .then(r => r.json())
    .then(json => { if (json?.data || json?.activity_id) setCachedActivity(id, json.data || json) })
    .catch(() => {})
}
