import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import BrandPage from './pages/BrandPage.jsx'
import CarPage from './pages/CarPage.jsx'

// Without this the browser keeps the previous page's scroll offset, which on a
// shorter page lands the reader below all the content.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:brandId" element={<BrandPage />} />
        <Route path="/:brandId/:slug" element={<CarPage />} />
      </Routes>
    </>
  )
}
