import React, { useState, useEffect, CSSProperties } from 'react'
import { getToken } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function isObjectKey(v?: string): boolean {
  if (!v) return false
  if (v.startsWith('http') || v.startsWith('/')) return false
  return v.includes('/')
}

export async function fetchSignedUrl(objectKey: string): Promise<string | null> {
  try {
    const token = getToken() || ''
    const res = await fetch(`${API_BASE}/api/media/view-url?key=${encodeURIComponent(objectKey)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json()
    if (json.code === 200 && json.data?.previewUrl) return json.data.previewUrl
    return null
  } catch {
    return null
  }
}

export function useOssUrl(src?: string): string {
  const [resolved, setResolved] = useState<string>(
    src && !isObjectKey(src) ? src : ''
  )

  useEffect(() => {
    if (!src) { setResolved(''); return }
    if (!isObjectKey(src)) { setResolved(src); return }
    let cancelled = false
    fetchSignedUrl(src).then(url => {
      if (!cancelled) setResolved(url || '')
    })
    return () => { cancelled = true }
  }, [src])

  return resolved
}

interface OssImageProps {
  src?: string
  alt?: string
  style?: CSSProperties
  className?: string
  fallback?: React.ReactNode
}

export default function OssImage({ src, alt = '', style, className, fallback }: OssImageProps) {
  const resolvedSrc = useOssUrl(src)

  if (!resolvedSrc) {
    return fallback ? <>{fallback}</> : null
  }

  return <img src={resolvedSrc} alt={alt} style={style} className={className} />
}
