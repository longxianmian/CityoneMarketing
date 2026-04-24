import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route, useSearchParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import queryClient from './lib/queryClient'
import { LiffProvider } from './providers/LiffProvider'
import ContinuePage from './pages/user/ContinuePage'
import FollowConfirmPage from './pages/user/FollowConfirmPage'
import OpenInLinePage from './pages/user/OpenInLinePage'
import { resolveRuntimeWelfareCallbackTarget } from './lib/line'
import { useLiff } from './providers/LiffProvider'
import { readPendingIntentResume } from './lib/pendingIntent'

function CallbackTitleSync() {
  React.useEffect(() => {
    document.title = 'CityOne 福利中心'
  }, [])
  return null
}

function getContinueIntentToken(targetPath: string) {
  try {
    const url = new URL(targetPath, window.location.origin)
    if (url.pathname !== '/welfare/continue') return ''
    return url.searchParams.get('intent') || ''
  } catch {
    return ''
  }
}

function WelfareCallbackEntryPage() {
  const [searchParams] = useSearchParams()
  const { liffChecked } = useLiff()

  const targetPath = React.useMemo(() => {
    return resolveRuntimeWelfareCallbackTarget(searchParams)
  }, [searchParams])
  const hasLiffCallback = searchParams.has('liff.state')
  const hasExternalLoginCallback = searchParams.has('code') && (
    searchParams.has('state') ||
    searchParams.has('liffClientId') ||
    searchParams.has('liffRedirectUri')
  )
  const explicitResumeIntent = (searchParams.get('resume_intent') || '').trim()
  const persistedResumeIntent = React.useMemo(() => {
    return explicitResumeIntent ? '' : readPendingIntentResume()
  }, [explicitResumeIntent, searchParams])
  const resumeIntent = explicitResumeIntent || persistedResumeIntent
  const hasResumeIntent = !!resumeIntent
  const continueIntentToken = React.useMemo(() => getContinueIntentToken(targetPath), [targetPath])

  React.useEffect(() => {
    if (targetPath || hasResumeIntent || ((hasLiffCallback || hasExternalLoginCallback) && !liffChecked)) return
    const t = window.setTimeout(() => {
      window.location.replace('/welfare')
    }, 1200)
    return () => window.clearTimeout(t)
  }, [hasExternalLoginCallback, hasLiffCallback, hasResumeIntent, liffChecked, targetPath])

  if ((hasLiffCallback || hasResumeIntent || hasExternalLoginCallback) && !liffChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f6ffed', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto',
              borderRadius: '50%',
              border: '3px solid rgba(44, 219, 206, 0.18)',
              borderTopColor: '#2cdbce',
              animation: 'boot-spin 0.8s linear infinite',
            }}
          />
          <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700, color: '#172b24' }}>正在继续领取</div>
          <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>系统正在确认 LINE 回流上下文，请稍候。</div>
        </div>
      </div>
    )
  }

  if (continueIntentToken) {
    return <ContinuePage intentTokenOverride={continueIntentToken} />
  }

  if (hasResumeIntent && liffChecked && resumeIntent) {
    return <ContinuePage intentTokenOverride={resumeIntent} />
  }

  if (targetPath) {
    return <Navigate to={targetPath} replace />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f6ffed', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
        <div
          style={{
            width: 34,
            height: 34,
            margin: '0 auto',
            borderRadius: '50%',
            border: '3px solid rgba(44, 219, 206, 0.18)',
            borderTopColor: '#2cdbce',
            animation: 'boot-spin 0.8s linear infinite',
          }}
        />
        <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700, color: '#172b24' }}>正在继续领取</div>
        <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>系统正在确认 LINE 身份并自动完成后续步骤。</div>
      </div>
    </div>
  )
}

function RootCallbackEntryPage() {
  const [searchParams] = useSearchParams()
  const explicitResumeIntent = (searchParams.get('resume_intent') || '').trim()
  const persistedResumeIntent = React.useMemo(() => {
    return explicitResumeIntent ? '' : readPendingIntentResume()
  }, [explicitResumeIntent, searchParams])
  const effectiveResumeIntent = explicitResumeIntent || persistedResumeIntent
  const targetPath = React.useMemo(() => resolveRuntimeWelfareCallbackTarget(searchParams), [searchParams])
  const hasExternalLoginCallback = searchParams.has('code') && (
    searchParams.has('state') ||
    searchParams.has('liffClientId') ||
    searchParams.has('liffRedirectUri')
  )

  // LINE 回流有时会落在站点根路径，必须保留原 query 并重定向到福利回调入口。
  if (targetPath || effectiveResumeIntent || hasExternalLoginCallback) {
    const query = searchParams.toString()
    return <Navigate to={query ? `/welfare?${query}` : '/welfare'} replace />
  }

  return <Navigate to="/welfare" replace />
}

export default function CallbackEntry() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LiffProvider>
          <CallbackTitleSync />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RootCallbackEntryPage />} />
              <Route path="/welfare" element={<WelfareCallbackEntryPage />} />
              <Route path="/welfare/open-in-line" element={<OpenInLinePage />} />
              <Route path="/welfare/continue" element={<ContinuePage />} />
              <Route path="/welfare/follow-confirm" element={<FollowConfirmPage />} />
              <Route path="*" element={<Navigate to="/welfare" replace />} />
            </Routes>
          </ErrorBoundary>
        </LiffProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export function mount(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(<CallbackEntry />)
}
