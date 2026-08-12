import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchAllCars, isOneOff, numOf, powertrainOf } from '../lib/data.js'
import { applyTheme } from '../lib/theme.js'
import { useSpotted } from '../lib/marks.js'
import CarCard from '../components/CarCard.jsx'

// Ways of slicing the whole database that cut across marques — the thing a
// brand page can't do.
const COLLECTIONS = [
  { id: 'all', label: 'Everything', test: () => true },
  { id: 'one-offs', label: 'One-offs', test: c => isOneOff(c) },
  { id: 'track', label: 'Track only', test: c => c.market.road_legal === false },
  { id: 'v12', label: 'V12', test: c => /v12/i.test(c.specs.engine || '') },
  { id: 'electric', label: 'Electric', test: c => powertrainOf(c) === 'electric' },
  { id: 'hybrid', label: 'Hybrid', test: c => powertrainOf(c) === 'hybrid' },
]

const SORTS = {
  year: (a, b) => a.car.year - b.car.year,
  hp: (a, b) => (numOf(b.car.specs.horsepower_hp) ?? 0) - (numOf(a.car.specs.horsepower_hp) ?? 0),
  name: (a, b) => a.car.model.localeCompare(b.car.model),
  brand: (a, b) => a.brand.name.localeCompare(b.brand.name) || a.car.year - b.car.year,
}

// Rendering 597 cards at once is slow to paint; images are lazy but the DOM
// isn't. A page at a time keeps it instant and still reaches everything.
const PAGE = 96

export default function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const [all, setAll] = useState(null)
  const [shown, setShown] = useState(PAGE)
  const spotted = useSpotted()

  const q = params.get('q') || ''
  const collection = params.get('c') || 'all'
  const sort = params.get('sort') || 'year'

  useEffect(() => {
    applyTheme(null)
    fetchAllCars().then(setAll)
    return () => applyTheme(null)
  }, [])

  useEffect(() => { setShown(PAGE) }, [q, collection, sort])

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all' || (key === 'sort' && value === 'year')) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    if (!all) return []
    const needle = q.trim().toLowerCase()
    // "Spotted" lives in localStorage rather than the data, so it can't be a
    // static predicate like the rest.
    const test = collection === 'spotted'
      ? car => spotted.includes(car.id)
      : (COLLECTIONS.find(c => c.id === collection) || COLLECTIONS[0]).test
    return all
      .filter(e => test(e.car))
      .filter(e => !needle || `${e.brand.name} ${e.car.model}`.toLowerCase().includes(needle))
      .sort(SORTS[sort] || SORTS.year)
  }, [all, q, collection, sort, spotted])

  if (!all) return <div className="loading">Loading all 39 brands…</div>

  const counts = Object.fromEntries(
    COLLECTIONS.map(c => [c.id, all.filter(e => c.test(e.car)).length]))
  counts.spotted = spotted.length

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span> THE WHOLE COLLECTION
        </div>
        <h1>Explore <em>everything</em></h1>
        <p className="sub">
          Every car from every marque in one place — search by name, or pull out a slice
          that cuts across brands. <Link className="sub-link" to="/records">See the record holders →</Link>
        </p>
      </header>

      <div className="controls">
        {[...COLLECTIONS, ...(spotted.length ? [{ id: 'spotted', label: 'Spotted' }] : [])].map(c => (
          <button
            key={c.id}
            className={`chip${collection === c.id ? ' on' : ''}`}
            onClick={() => set('c', c.id)}
          >{c.label} <span className="chip-count">{counts[c.id]}</span></button>
        ))}
        <span className="spacer" />
        <input
          className="search" type="text" placeholder="Search 597 cars…"
          value={q} onChange={e => set('q', e.target.value)}
        />
        <select value={sort} onChange={e => set('sort', e.target.value)}>
          <option value="year">Sort · Year</option>
          <option value="hp">Sort · Horsepower</option>
          <option value="name">Sort · Name</option>
          <option value="brand">Sort · Brand</option>
        </select>
        <span className="count">{results.length} cars</span>
      </div>

      {results.length === 0 ? (
        <div className="hsect" style={{ paddingBottom: 90 }}>
          <div className="empty-note">Nothing matches “{q}”. Try a model or a marque.</div>
        </div>
      ) : (
        <>
          <main className="grid">
            {results.slice(0, shown).map(e => (
              <CarCard key={e.car.id} car={e.car} brand={e.brand} showBrand />
            ))}
          </main>
          {shown < results.length && (
            <div className="more-row">
              <button className="btn" onClick={() => setShown(n => n + PAGE)}>
                Show {Math.min(PAGE, results.length - shown)} more
              </button>
              <span className="count">{shown} of {results.length}</span>
            </div>
          )}
        </>
      )}
    </>
  )
}
