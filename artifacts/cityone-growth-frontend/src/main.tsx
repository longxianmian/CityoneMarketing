import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { I18nProvider, useI18n } from './i18n'
import { LiffProvider } from './providers/LiffProvider'
import queryClient from './lib/queryClient'
import AntdShell from './components/AntdShell'
import { clientLog } from './lib/clientLogger'
import './styles/global.css'

/** 路由变化埋点：每次 SPA navigate 都打一条 route_change，方便复盘"点了什么 → 跳到哪" */
function RouteLogger() {
  const location = useLocation()
  const lastKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    const key = location.pathname + location.search
    if (key === lastKeyRef.current) return
    const prev = lastKeyRef.current
    lastKeyRef.current = key
    clientLog('route_change', {
      from: prev || '(initial)',
      to: location.pathname + location.search,
      pathname: location.pathname,
      key: location.key,
    })
  }, [location])
  return null
}

function DocumentTitleSync() {
  const location = useLocation()
  const { language } = useI18n()

  React.useEffect(() => {
    const isAdmin = location.pathname.startsWith('/admin')
    if (isAdmin) {
      document.title = 'CityOne Admin'
      return
    }
    const titleMap = {
      zh: 'CityOne 福利中心',
      th: 'CityOne Benefits Center',
      en: 'CityOne Benefits Center',
    } as const
    document.title = titleMap[language] || titleMap.en
  }, [location.pathname, language])

  return null
}

function MainEntry() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <AntdShell>
            <LiffProvider>
              <RouteLogger />
              <DocumentTitleSync />
              <App />
            </LiffProvider>
          </AntdShell>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<MainEntry />)
