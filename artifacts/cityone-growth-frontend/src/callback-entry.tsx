import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { LiffProvider, useLiff } from './providers/LiffProvider'
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

function CallbackLoadingShell({
  title = '正在继续处理',
  desc = '系统正在确认 LINE 身份、关注状态，并自动继续当前操作。',
}: {
  title?: string
  desc?: string
}) {
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
        <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700, color: '#172b24' }}>{title}</div>
        <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>{desc}</div>
      </div>
    </div>
  )
}

function WelfareCallbackEntryPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { liffChecked, liffReady, needLineLogin } = useLiff()
  const hasLiffState = searchParams.has('liff.state')

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

  const intentToken = React.useMemo(() => {
    if (!targetPath) return ''
    try {
      const query = targetPath.split('?')[1] || ''
      return new URLSearchParams(query).get('intent') || ''
    } catch {
      return ''
    }
  }, [targetPath])

  const openInLinePath = intentToken
    ? `/welfare/open-in-line?intent=${encodeURIComponent(intentToken)}`
    : '/welfare'
  const directContinueRender = Boolean(
    intentToken &&
      targetPath &&
      targetPath.startsWith('/welfare/continue?') &&
      hasLiffState &&
      liffChecked &&
      (liffReady || needLineLogin),
  )

  React.useLayoutEffect(() => {
    if (directContinueRender) return
    if (!targetPath) return
    if (hasLiffState && !liffChecked) return
    if (hasLiffState && !liffReady && !needLineLogin) return
    navigate(targetPath, { replace: true })
  }, [directContinueRender, hasLiffState, liffChecked, liffReady, navigate, needLineLogin, targetPath])

  if (hasLiffState && liffChecked && !liffReady && !needLineLogin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f6ffed', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#172b24' }}>LINE 回调初始化失败</div>
          <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>当前回调没有建立可用的 LINE 身份，请重新在 LINE 中打开后继续当前操作。</div>
          <button
            type="button"
            onClick={() => window.location.assign(openInLinePath)}
            style={{
              marginTop: 20,
              width: '100%',
              border: 'none',
              borderRadius: 999,
              background: '#12b981',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              padding: '14px 18px',
              cursor: 'pointer',
            }}
          >
            重新在 LINE 中打开
          </button>
        </div>
      </div>
    )
  }

  if (directContinueRender) {
    return <ContinuePage intentTokenOverride={intentToken} />
  }

  if (targetPath) {
    return <CallbackLoadingShell />
  }

  return <CallbackLoadingShell />
}

function WelfareCallbackEntryRoute() {
  const [searchParams] = useSearchParams()
  const hasLiffState = searchParams.has('liff.state')

  if (!hasLiffState) {
    return (
      <ErrorBoundary>
        <WelfareCallbackEntryPage />
      </ErrorBoundary>
    )
  }

  return (
    <CallbackLiffShell>
      <WelfareCallbackEntryPage />
    </CallbackLiffShell>
  )
}

function CallbackLiffShell({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </LiffProvider>
  )
}

function CallbackFlowLayout() {
  return (
    <CallbackLiffShell>
      <Outlet />
    </CallbackLiffShell>
  )
}

function CallbackInvalidRoutePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#172b24' }}>当前继续路径无效</div>
        <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8 }}>请返回上一页重新发起当前操作。</div>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            marginTop: 20,
            width: '100%',
            border: 'none',
            borderRadius: 999,
            background: '#12b981',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            padding: '14px 18px',
            cursor: 'pointer',
          }}
        >
          返回上一页
        </button>
      </div>
    </div>
  )
}

export default function CallbackEntry() {
  return (
    <BrowserRouter>
      <CallbackTitleSync />
      <Routes>
        <Route
          path="/welfare"
          element={<CallbackFlowLayout />}
        >
          <Route index element={<WelfareCallbackEntryRoute />} />
          <Route path="continue" element={<ContinuePage />} />
          <Route path="follow-confirm" element={<FollowConfirmPage />} />
        </Route>
        <Route
          path="/welfare/open-in-line"
          element={
            <ErrorBoundary>
              <OpenInLinePage />
            </ErrorBoundary>
          }
        />
        <Route path="/continue" element={<Navigate to="/welfare/continue" replace />} />
        <Route path="*" element={<CallbackInvalidRoutePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export function mount(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(<CallbackEntry />)
}
