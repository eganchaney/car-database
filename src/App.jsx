import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import BrandPage from './pages/BrandPage.jsx'
import CarPage from './pages/CarPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:brandId" element={<BrandPage />} />
      <Route path="/:brandId/:slug" element={<CarPage />} />
    </Routes>
  )
}
