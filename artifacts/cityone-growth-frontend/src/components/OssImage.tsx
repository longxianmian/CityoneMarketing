import React, { useState, useEffect, CSSProperties } from 'react'
import { getToken } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// 模块级缓存：OSS object key → 已获取的签名 URL
// 导航来回不会重新请求，直接命中内存
const ossUrlCache = new Map<string, string>()

export function isObjectKey(v?: string): boolean {
  if (!v) return false
  if (v.startsWith('http') || v.startsWith('/')) return false
  return v.includes('/')
}

export async function fetchSignedUrl(objectKey: string): Promise<string | null> {
  if (ossUrlCache.has(objectKey)) return ossUrlCache.get(objectKey)!
  try {
    const token = getToken() || ''
    const res = await fetch(`${API_BASE}/api/media/view-url?key=${encodeURIComponent(objectKey)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json()
    if (json.code === 200 && json.data?.previewUrl) {
      ossUrlCache.set(objectKey, json.data.previewUrl)
      return json.data.previewUrl
    }
    return null
  } catch {
    return null
  }
}

/** 返回 { url, loading }
 *  loading=true  → OSS key 正在异步获取签名 URL（首次，无缓存）
 *  loading=false → 已有 URL（直接地址或已缓存的 OSS URL）或 src 为空
 */
function useOssUrlFull(src?: string | null): { url: string; loading: boolean } {
  const isKey = isObjectKey(src || '')
  const cachedUrl = isKey ? (ossUrlCache.get(src!) ?? '') : ''

  const [url, setUrl] = useState<string>(
    isKey ? cachedUrl : (src || '')
  )
  const [loading, setLoading] = useState<boolean>(isKey && !cachedUrl)

  useEffect(() => {
    if (!src) {
      setUrl('')
      setLoading(false)
      return
    }
    if (!isObjectKey(src)) {
      setUrl(src)
      setLoading(false)
      return
    }
    // 有缓存直接用，不重新请求
    if (ossUrlCache.has(src)) {
      setUrl(ossUrlCache.get(src)!)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSignedUrl(src).then(resolved => {
      if (!cancelled) {
        setUrl(resolved || '')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [src])

  return { url, loading }
}

export function useOssUrl(src?: string): string {
  const { url } = useOssUrlFull(src)
  return url
}

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
  const { url, loading } = useOssUrlFull(src)

  // src 为空 → 不渲染（或 fallback）
  if (!src) {
    return fallback ? <>{fallback}</> : null
  }

  // OSS key 首次获取中（无缓存）→ 骨架屏占位
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

  // URL 获取失败 → fallback 或不渲染
  if (!url) {
    return fallback ? <>{fallback}</> : null
  }

  // 正常渲染，浏览器缓存由浏览器自行处理
  return <img src={url} alt={alt} style={style} className={className} />
}
