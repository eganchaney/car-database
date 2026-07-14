import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchBrands, fetchAllCars, carOfTheDay, coverUrl, initials, isOneOff } from '../lib/data.js'
import { applyTheme, familyAccent } from '../lib/theme.js'
import { useFavorites } from '../lib/favorites.js'
import CarCard from '../components/CarCard.jsx'

export default function Home() {
  const [brands, setBrands] = useState(null)
  const [all, setAll] = useState(null)
  const favs = useFavorites()

  useEffect(() => { applyTheme(null) }, [])
  useEffect(() => {
    fetchBrands().then(setBrands)
    fetchAllCars().then(setAll)
  }, [])

  if (!brands || !all) return <div className="loading">Loading the collection…</div>

  const byId = new Map(all.map(e => [e.car.id, e]))
  const favEntries = favs.map(id => byId.get(id)).filter(Boolean)
  const cotd = carOfTheDay(all)
  const newest = all.slice(-4).reverse()
  const oneOffs = all.filter(e => isOneOff(e.car)).length
  const activeBrands = brands.filter(b => b.data)

  return (
    <>
      <header className="page">
        <div className="kicker">
          <span className="pipes"><i /><i /><i /><i /></span>
          PERSONAL ENCYCLOPEDIA OF INTERESTING CARS
        </div>
        <h1>The Car <em>Database</em></h1>
        <p className="sub">Every car in here earned its place. Pick a brand to enter its world, or start with today's featured machine.</p>
        <div className="statstrip">
          <span><b>{all.length}</b>cars</span>
          <span><b>{activeBrands.length}</b>{activeBrands.length === 1 ? 'brand' : 'brands'}</span>
          <span><b>{oneOffs}</b>one-offs</span>
          <span><b>{favEntries.length}</b>favorites</span>
        </div>
      </header>

      {cotd && <CarOfTheDay entry={cotd} />}

      <section className="hsect">
        <h2>Brands</h2>
        <div className="brandix">
          {brands.map(b => b.data ? (
            <Link key={b.id} className="brandcard" to={`/${b.id}`} style={{ '--fam': b.theme?.accent }}>
              <span className="bspine" />
              <div className="bmeta">{b.country}{b.founded ? ` · EST. ${b.founded}` : ''}</div>
              <div className="bname">{b.name}</div>
              <div className="btag">{b.tagline}</div>
            </Link>
          ) : (
            <div key={b.id} className="brandcard planned">
              <span className="bspine" />
              <div className="bmeta">{b.country} · Coming soon</div>
              <div className="bname">{b.name}</div>
              <div className="btag">{b.theme_direction}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="hsect">
        <h2>Favorites <span className="h2note">saved on this device</span></h2>
        {favEntries.length ? (
          <div className="brandix">
            {favEntries.map(e => <CarCard key={e.car.id} car={e.car} brand={e.brand} showBrand />)}
          </div>
        ) : (
          <div className="empty-note">No favorites yet — tap the ♡ on any car to pin it here.</div>
        )}
      </section>

      <section className="hsect">
        <h2>Newest additions</h2>
        <div className="brandix">
          {newest.map(e => <CarCard key={e.car.id} car={e.car} brand={e.brand} showBrand />)}
        </div>
      </section>

      <footer style={{ marginTop: 60 }}>
        A personal project — photos credited to their photographers under their original licenses.
      </footer>
    </>
  )
}

function CarOfTheDay({ entry }) {
  const { car, brand } = entry
  const cover = coverUrl(car)
  const fam = familyAccent(brand, car.family)
  return (
    <section className="hsect">
      <h2>Car of the day <span className="h2note">rotates daily</span></h2>
      <Link className="cotd" to={`/${car.id}`} style={fam ? { '--fam': fam } : undefined}>
        <div className="cover">
          <span className="fam-spine" />
          {cover ? <img src={cover} alt={car.model} /> : <div className="mono-mark">{initials(car)}</div>}
        </div>
        <div className="cotd-body">
          <div className="cbrand">{brand.name} · {car.year}</div>
          <div className="cname">{car.model}</div>
          <p>{car.content.story}</p>
          <span className="cotd-open">Open the build plaque →</span>
        </div>
      </Link>
    </section>
  )
}
