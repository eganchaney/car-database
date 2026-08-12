import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import BrandPage from './pages/BrandPage.jsx'
import CarPage from './pages/CarPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'
import MissingPage from './pages/MissingPage.jsx'
import ChartsPage from './pages/ChartsPage.jsx'

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
        {/* Static "compare" outranks /:brandId, and the pairing lives in the
            URL so a match-up can be shared. */}
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/compare/:brandA/:slugA" element={<ComparePage />} />
        <Route path="/compare/:brandA/:slugA/vs/:brandB/:slugB" element={<ComparePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/missing" element={<MissingPage />} />
        <Route path="/:brandId" element={<BrandPage />} />
        <Route path="/:brandId/:slug" element={<CarPage />} />
      </Routes>
    </>
  )
}
