import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchBrands, fetchBrandData, numOf } from '../lib/data.js'
import { applyTheme, familyAccent } from '../lib/theme.js'
import CarCard from '../components/CarCard.jsx'

export default function BrandPage() {
  const { brandId } = useParams()
  const [brand, setBrand] = useState(null)
  const [cars, setCars] = useState(null)
  const [missing, setMissing] = useState(false)
  const [filter, setFilter] = useState('all')     // 'all' | family | 'd:1960' | 'road' | 'track'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('year')

  useEffect(() => {
    setBrand(null); setCars(null); setMissing(false)
    setFilter('all'); setQ(''); setSort('year')
    fetchBrands().then(brands => {
      const b = brands.find(x => x.id === brandId && x.data)
      if (!b) { setMissing(true); return }
      setBrand(b)
      applyTheme(b.theme)
      fetchBrandData(b).then(d => setCars(d.cars)).catch(() => setMissing(true))
    })
    return () => applyTheme(null)
  }, [brandId])

  const families = useMemo(
    () => cars ? [...new Set(cars.map(c => c.family).filter(Boolean))] : [],
    [cars],
  )
  // Brands without curated families (e.g. Ferrari's 100+ model lines) get
  // decade chips instead, derived from the data.
  const decades = useMemo(
    () => (cars && !families.length)
      ? [...new Set(cars.map(c => Math.floor(c.year / 10) * 10))].sort((a, b) => a - b)
      : [],
    [cars, families],
  )

  const visible = useMemo(() => {
    if (!cars) return []
    const needle = q.trim().toLowerCase()
    const list = cars.filter(c => {
      if (families.includes(filter) && c.family !== filter) return false
      if (filter.startsWith('d:') && Math.floor(c.year / 10) * 10 !== +filter.slice(2)) return false
      if (filter === 'road' && c.market.road_legal !== true) return false
      if (filter === 'track' && c.market.road_legal !== false) return false
      if (needle && !c.model.toLowerCase().includes(needle)) return false
      return true
    })
    list.sort((a, b) =>
      sort === 'hp' ? (numOf(b.specs.horsepower_hp) ?? 0) - (numOf(a.specs.horsepower_hp) ?? 0) :
      sort === 'name' ? a.model.localeCompare(b.model) :
      a.year - b.year)
    return list
  }, [cars, families, filter, q, sort])

  if (missing) {
    return (
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <h1>Not yet</h1>
        <p className="sub">This brand isn't in the database yet.</p>
      </header>
    )
  }
  if (!brand || !cars) return <div className="loading">Loading…</div>

  const hero = brand.hero || {}
  const chip = (key, label, fam) => (
    <button
      key={key}
      className={`chip${filter === key ? ' on' : ''}`}
      style={fam ? { '--fam': fam } : undefined}
      onClick={() => setFilter(key)}
    >{label}</button>
  )

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← All brands</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span>
          {hero.kicker || `${brand.name.toUpperCase()} · ${brand.country?.toUpperCase() || ''}`}
        </div>
        <h1>{hero.titlePrefix || brand.name} {hero.titleAccent && <em>{hero.titleAccent}</em>}</h1>
        <p className="sub">{hero.sub || brand.tagline}</p>
      </header>

      {cars.length === 0 ? (
        <div className="hsect" style={{ marginTop: 30, paddingBottom: 90 }}>
          <div className="empty-note">
            No cars yet — add {brand.name} rows to <b>Car Database.xlsx</b> and they'll appear here.
          </div>
        </div>
      ) : (
        <>
          <div className="controls">
            {chip('all', 'All')}
            {families.map(f => chip(f, f, familyAccent(brand, f)))}
            {decades.map(d => chip(`d:${d}`, `${d}s`))}
            {chip('road', 'Road legal')}
            {chip('track', 'Track only')}
            <span className="spacer" />
            <input
              className="search" type="text" placeholder="Search models…"
              value={q} onChange={e => setQ(e.target.value)}
            />
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="year">Sort · Year</option>
              <option value="hp">Sort · Horsepower</option>
              <option value="name">Sort · Name</option>
            </select>
            <span className="count">{visible.length} / {cars.length} cars</span>
          </div>

          <main className="grid">
            {visible.map(car => <CarCard key={car.id} car={car} brand={brand} />)}
          </main>
        </>
      )}
    </>
  )
}
