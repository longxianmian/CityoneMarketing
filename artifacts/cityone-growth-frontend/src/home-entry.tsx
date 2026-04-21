import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import WelfareHomePage from './pages/user/WelfareHomePage'

function HomeTitleSync() {
  React.useEffect(() => {
    document.title = 'CityOne 福利中心'
  }, [])
  return null
}

function NonHomeRouteRedirect() {
  const location = useLocation()

  React.useEffect(() => {
    const target = `${location.pathname}${location.search}${location.hash}`
    if (target === '/welfare') return
    window.location.replace(target)
  }, [location.hash, location.pathname, location.search])

  return null
}

export default function HomeEntry() {
  return (
    <BrowserRouter>
      <HomeTitleSync />
      <ErrorBoundary>
        <Routes>
          <Route path="/welfare" element={<WelfareHomePage />} />
          <Route path="*" element={<NonHomeRouteRedirect />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export function mount(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(<HomeEntry />)
}
