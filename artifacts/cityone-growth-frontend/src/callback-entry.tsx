import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route, useSearchParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { LiffProvider } from './providers/LiffProvider'
import ContinuePage from './pages/user/ContinuePage'
import OpenInLinePage from './pages/user/OpenInLinePage'
import FollowConfirmPage from './pages/user/FollowConfirmPage'
import { normalizeRuntimeLiffExtraPath } from './lib/line'

function CallbackTitleSync() {
  React.useEffect(() => {
    document.title = 'CityOne 福利中心'
  }, [])
  return null
}

function WelfareCallbackEntryPage() {
  const [searchParams] = useSearchParams()

  const targetPath = React.useMemo(() => {
    const intent = searchParams.get('intent') || ''
    if (intent) {
      return `/welfare/continue?intent=${encodeURIComponent(intent)}`
    }

    const liffState = searchParams.get('liff.state') || ''
    if (!liffState) return ''

    const decoded = decodeURIComponent(liffState)
    const normalized = normalizeRuntimeLiffExtraPath(decoded)
    if (!normalized) return ''

    if (
      normalized.startsWith('/continue?') ||
      normalized.startsWith('/open-in-line?') ||
      normalized.startsWith('/follow-confirm?')
    ) {
      return `/welfare${normalized}`
    }

    return ''
  }, [searchParams])

  React.useEffect(() => {
    if (!targetPath) return
    window.location.replace(targetPath)
  }, [targetPath])

  if (targetPath) return null

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

function CallbackLiffShell({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </LiffProvider>
  )
}

export default function CallbackEntry() {
  return (
    <BrowserRouter>
      <CallbackTitleSync />
      <Routes>
        <Route path="/welfare" element={<WelfareCallbackEntryPage />} />
        <Route path="/welfare/open-in-line" element={<ErrorBoundary><OpenInLinePage /></ErrorBoundary>} />
        <Route path="/welfare/continue" element={<CallbackLiffShell><ContinuePage /></CallbackLiffShell>} />
        <Route path="/welfare/follow-confirm" element={<CallbackLiffShell><FollowConfirmPage /></CallbackLiffShell>} />
        <Route path="/continue" element={<Navigate to="/welfare/continue" replace />} />
        <Route path="*" element={<Navigate to="/welfare" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export function mount(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(<CallbackEntry />)
}
