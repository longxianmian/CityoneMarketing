import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/global.css'
import { I18nProvider, useI18n } from './i18n'
import { LiffProvider } from './providers/LiffProvider'
import queryClient from './lib/queryClient'

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

function AppWithI18n() {
  const { antdLocale } = useI18n()

  return (
    <BrowserRouter>
      <ConfigProvider
        locale={antdLocale}
        theme={{
          token: {
            colorPrimary: '#2CDBCE',
            borderRadius: 6,
          },
        }}
      >
        <AntdApp>
          <LiffProvider>
            <DocumentTitleSync />
            <App />
          </LiffProvider>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AppWithI18n />
    </I18nProvider>
  </QueryClientProvider>
)
