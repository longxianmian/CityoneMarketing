import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'

function isCallbackEntryPath(pathname: string, search: string) {
  const params = new URLSearchParams(search || '')
  if (pathname === '/welfare' && (params.has('intent') || params.has('liff.state'))) return true
  return (
    pathname === '/welfare/continue' ||
    pathname === '/welfare/open-in-line' ||
    pathname === '/welfare/follow-confirm' ||
    pathname === '/continue'
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

const entryLoader = isCallbackEntryPath(window.location.pathname, window.location.search)
  ? import('./callback-entry')
  : import('./full-entry')

entryLoader
  .then((mod) => {
    root.render(<mod.default />)
  })
  .catch((error) => {
    console.error('[boot] failed to load entry module', error)
    root.render(
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f6ffed' }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', background: '#fff', borderRadius: 20, boxShadow: '0 12px 32px rgba(17, 94, 89, 0.08)', padding: '28px 24px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#172b24' }}>页面加载异常</div>
          <div style={{ marginTop: 10, color: '#666', lineHeight: 1.8, fontSize: 14 }}>请刷新重试，或联系客服。</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
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
      </div>,
    )
  })
