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
  placeholderStyle?: CSSProperties
}

export default function OssImage({ src, alt = '', style, className, fallback, placeholderStyle }: OssImageProps) {
  const resolvedSrc = useOssUrl(src)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [resolvedSrc])

  if (!resolvedSrc) {
    if (fallback) return <>{fallback}</>
    const ph: CSSProperties = {
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'ossShimmer 1.4s infinite',
      display: 'block',
      ...style,
      ...placeholderStyle,
    }
    return (
      <>
        <style>{`@keyframes ossShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div style={ph} />
      </>
    )
  }

  return (
    <>
      {!loaded && (
        <>
          <style>{`@keyframes ossShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          <div style={{
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'ossShimmer 1.4s infinite',
            display: 'block',
            ...style,
            ...placeholderStyle,
          }} />
        </>
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        style={{ ...style, display: loaded ? 'block' : 'none' }}
        className={className}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  )
}
