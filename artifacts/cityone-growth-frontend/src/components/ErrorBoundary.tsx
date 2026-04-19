import React from 'react'

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f6ffed' }}>
          <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#172b24' }}>页面加载异常</div>
            <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8, fontSize: 14 }}>请刷新重试，或联系客服。</div>
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              style={{
                marginTop: 20,
                width: '100%',
                border: 'none',
                borderRadius: 999,
                background: '#2cdbce',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                padding: '14px 18px',
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
