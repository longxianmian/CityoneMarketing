import React, { useState, useEffect, CSSProperties } from 'react'
import { getToken } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// ─────────────────────────────────────────────
// Stale-While-Revalidate 本地缓存
//   • 命中且新鲜 → 直接返回，零等待
//   • 命中但过期 → 立即返回旧值，后台静默刷新
//   • 未命中     → 请求后返回
// ─────────────────────────────────────────────
const STALE_MS  = 20 * 60 * 1000   // 20 分钟后视为 stale，触发后台刷新
const EXPIRE_MS = 50 * 60 * 1000   // 50 分钟后视为彻底过期，下次挂载重新 loading

interface CacheEntry { url: string; fetchedAt: number }
const ossCache = new Map<string, CacheEntry>()

// 正在进行中的请求去重（防止同一 key 并发多次请求）
const inFlight = new Map<string, Promise<string | null>>()

function doFetch(objectKey: string): Promise<string | null> {
  if (inFlight.has(objectKey)) return inFlight.get(objectKey)!
  const p = (async () => {
    try {
      const token = getToken() || ''
      const res = await fetch(
        `${API_BASE}/api/media/view-url?key=${encodeURIComponent(objectKey)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      const json = await res.json()
      if (json.code === 200 && json.data?.previewUrl) {
        const url = json.data.previewUrl
        ossCache.set(objectKey, { url, fetchedAt: Date.now() })
        return url
      }
      return null
    } catch {
      return null
    } finally {
      inFlight.delete(objectKey)
    }
  })()
  inFlight.set(objectKey, p)
  return p
}

export function isObjectKey(v?: string): boolean {
  if (!v) return false
  if (v.startsWith('http') || v.startsWith('/')) return false
  return v.includes('/')
}

/** 保留向后兼容的 fetchSignedUrl 导出 */
export async function fetchSignedUrl(objectKey: string): Promise<string | null> {
  const entry = ossCache.get(objectKey)
  if (entry) return entry.url
  return doFetch(objectKey)
}

/** SWR hook：立即返回缓存值（即使 stale），同时按需后台刷新 */
function useOssUrlSWR(src?: string | null): { url: string; loading: boolean } {
  const isKey = isObjectKey(src || '')
  const entry  = isKey ? ossCache.get(src!) : undefined
  const now    = Date.now()
  const fresh  = entry && (now - entry.fetchedAt) < EXPIRE_MS
  const stale  = entry && (now - entry.fetchedAt) >= STALE_MS

  const initUrl     = isKey ? (fresh ? entry!.url : '') : (src || '')
  const initLoading = isKey && !fresh   // 无新鲜缓存才 loading

  const [url, setUrl]         = useState<string>(initUrl)
  const [loading, setLoading] = useState<boolean>(initLoading)

  useEffect(() => {
    if (!src) { setUrl(''); setLoading(false); return }
    if (!isObjectKey(src)) { setUrl(src); setLoading(false); return }

    const e   = ossCache.get(src)
    const t   = Date.now()
    const ok  = e && (t - e.fetchedAt) < EXPIRE_MS
    const old = e && (t - e.fetchedAt) >= STALE_MS

    if (ok) {
      // 命中有效缓存 → 立即显示
      setUrl(e!.url)
      setLoading(false)
      // 已经 stale → 后台静默刷新，不影响当前显示
      if (old) {
        doFetch(src).then(newUrl => { if (newUrl) setUrl(newUrl) }).catch(() => {})
      }
      return
    }

    // 无有效缓存 → 显示 loading，等待结果
    let cancelled = false
    setLoading(true)
    doFetch(src).then(resolved => {
      if (!cancelled) {
        setUrl(resolved || '')
        setLoading(false)
      }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [src])

  return { url, loading }
}

export function useOssUrl(src?: string): string {
  const { url } = useOssUrlSWR(src)
  return url
}

// ─────────────────────────────────────────────
// OssImage 组件
// ─────────────────────────────────────────────
interface OssImageProps {
  src?: string | null
  alt?: string
  style?: CSSProperties
  className?: string
  fallback?: React.ReactNode
  placeholderStyle?: CSSProperties
}

const SHIMMER_CSS = `@keyframes ossShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`

export default function OssImage({ src, alt = '', style, className, fallback, placeholderStyle }: OssImageProps) {
  const { url, loading } = useOssUrlSWR(src)

  if (!src) return fallback ? <>{fallback}</> : null

  if (loading) {
    return (
      <>
        <style>{SHIMMER_CSS}</style>
        <div style={{
          background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'ossShimmer 1.4s infinite',
          display: 'block',
          ...style,
          ...placeholderStyle,
        }} />
      </>
    )
  }

  if (!url) return fallback ? <>{fallback}</> : null

  return <img src={url} alt={alt} style={style} className={className} />
}
