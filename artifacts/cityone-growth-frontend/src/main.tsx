import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import App from './App'
import './styles/global.css'
import { I18nProvider, useI18n } from './i18n'

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
          <App />
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <AppWithI18n />
  </I18nProvider>
)
