import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n'
import ErrorBoundary from './components/ErrorBoundary'
import WelfareHomePage from './pages/user/WelfareHomePage'

function HomeTitleSync() {
  React.useEffect(() => {
    document.title = 'CityOne 福利中心'
  }, [])
  return null
}

export default function HomeEntry() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <HomeTitleSync />
        <ErrorBoundary>
          <Routes>
            <Route path="/welfare" element={<WelfareHomePage />} />
            <Route path="*" element={<Navigate to="/welfare" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </I18nProvider>
  )
}
