import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchActiveBrands, fetchBrandData, slugOf } from '../lib/data.js'
import { applyTheme } from '../lib/theme.js'

// A working page for whoever is filling the gaps: which cars still have no
// photo, and the exact filename to save one as.
export default function MissingPage() {
  const [brands, setBrands] = useState(null)
  const [open, setOpen] = useState(null)
  const [order, setOrder] = useState('missing')  // 'missing' | 'closest' | 'name'

  useEffect(() => {
    applyTheme(null)
    fetchActiveBrands()
      .then(list => Promise.all(list.map(async b => {
        const { cars } = await fetchBrandData(b)
        return {
          brand: b,
          total: cars.length,
          missing: cars.filter(c => !c.images.length),
        }
      })))
      .then(setBrands)
    return () => applyTheme(null)
  }, [])

  const sorted = useMemo(() => {
    if (!brands) return []
    const list = [...brands]
    if (order === 'name') list.sort((a, b) => a.brand.name.localeCompare(b.brand.name))
    else if (order === 'closest') {
      // Brands nearest to complete first, ignoring those already done.
      list.sort((a, b) => (a.missing.length || Infinity) - (b.missing.length || Infinity))
    } else list.sort((a, b) => b.missing.length - a.missing.length)
    return list
  }, [brands, order])

  if (!brands) return <div className="loading">Counting photos…</div>

  const totalCars = brands.reduce((n, b) => n + b.total, 0)
  const totalMissing = brands.reduce((n, b) => n + b.missing.length, 0)
  const done = totalCars - totalMissing
  const pct = Math.round((done / totalCars) * 100)

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span> PHOTO COVERAGE
        </div>
        <h1>Still <em>missing</em></h1>
        <p className="sub">
          {done} of {totalCars} cars have a photo ({pct}%). Open a brand for the list of gaps —
          each row shows the filename to save an image as, so it lands on the right car.
        </p>
        <div className="cover-bar" style={{ '--pct': `${pct}%` }}><span /></div>
      </header>

      <div className="controls">
        {[['missing', 'Most missing'], ['closest', 'Closest to done'], ['name', 'A–Z']].map(([id, label]) => (
          <button key={id} className={`chip${order === id ? ' on' : ''}`} onClick={() => setOrder(id)}>{label}</button>
        ))}
        <span className="spacer" />
        <span className="count">{totalMissing} cars without a photo</span>
      </div>

      <div className="hsect" style={{ paddingBottom: 90 }}>
        <ul className="cover-list">
          {sorted.map(({ brand, total, missing }) => {
            const have = total - missing.length
            const complete = missing.length === 0
            const isOpen = open === brand.id
            return (
              <li key={brand.id} className={`cover-row${complete ? ' complete' : ''}`}>
                <button
                  className="cover-head"
                  onClick={() => setOpen(isOpen ? null : brand.id)}
                  disabled={complete}
                  style={{ '--fam': brand.theme?.accent }}
                >
                  <span className="cover-name">{brand.name}</span>
                  <span className="cover-bar small" style={{ '--pct': `${Math.round((have / total) * 100)}%` }}><span /></span>
                  <span className="cover-count">
                    {complete ? 'all done' : `${missing.length} of ${total} missing`}
                  </span>
                  <span className="cover-caret">{complete ? '✓' : isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <ul className="cover-gaps">
                    {missing.map(car => (
                      <li key={car.id}>
                        <Link to={`/${car.id}`}>{car.model}</Link>
                        <code>{slugOf(car)}.jpg</code>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        <p className="hint" style={{ marginTop: 18 }}>
          Save photos into <code>public/images/&lt;brand&gt;/</code> using those names — any
          image extension works, and the build matches loosely, so
          <code> Ferrari 250 GTO.jpg</code> finds its car too.
        </p>
      </div>
    </>
  )
}
