import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchBrands, fetchBrandData, fetchCredits, imageUrl, initials, isOneOff } from '../lib/data.js'
import { applyTheme, familyAccent } from '../lib/theme.js'
import { FavHeart, Tags } from '../components/CarCard.jsx'

function PlaqueItem({ lab, val, big = false, wide = false }) {
  if (val == null || val === '') return null
  return (
    <div className={`pitem${wide ? ' pwide' : ''}`}>
      <div className="plab">{lab}</div>
      <div className={`pval${big ? ' big' : ''}`}>{val}</div>
    </div>
  )
}

export default function CarPage() {
  const { brandId, slug } = useParams()
  const [state, setState] = useState(null) // { brand, car } | 'missing'
  const [credits, setCredits] = useState({})
  const [lightbox, setLightbox] = useState(null) // image filename or null

  useEffect(() => {
    setState(null); setCredits({}); setLightbox(null)
    window.scrollTo(0, 0)
    fetchBrands().then(async brands => {
      const brand = brands.find(x => x.id === brandId && x.data)
      if (!brand) { setState('missing'); return }
      const d = await fetchBrandData(brand)
      const car = d.cars.find(c => c.id === `${brandId}/${slug}`)
      if (!car) { setState('missing'); return }
      applyTheme(brand.theme)
      setState({ brand, car })
      if (car.images?.length) fetchCredits(car.id).then(setCredits)
    })
    return () => applyTheme(null)
  }, [brandId, slug])

  useEffect(() => {
    if (!lightbox) return
    const onKey = e => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (state === 'missing') {
    return (
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <h1>Not found</h1>
        <p className="sub">No car at this address.</p>
      </header>
    )
  }
  if (!state) return <div className="loading">Loading…</div>

  const { brand, car } = state
  const fam = familyAccent(brand, car.family)
  const s = car.specs, m = car.market
  const heroImg = car.images?.[0]
  const heroCredit = heroImg ? credits[heroImg] : null
  const topSpeed = typeof s.top_speed_mph === 'number' ? `${s.top_speed_mph} mph` : s.top_speed_mph

  return (
    <div style={fam ? { '--fam': fam } : undefined}>
      <div className="backbar">
        <span className="crumb">
          <Link to="/">Home</Link><span className="sep">/</span>
          <Link to={`/${brand.id}`}>{brand.name}</Link><span className="sep">/</span>
          {car.model}
        </span>
      </div>

      <div className="sheet-page">
        <article className="sheet">
          <div className="hero">
            {heroImg
              ? <img src={imageUrl(car, heroImg)} alt={car.model} />
              : <div className="mono-mark">{initials(car)}</div>}
            {heroCredit && <div className="hero-credit">{heroCredit}</div>}
            <span className="fam-band" />
          </div>
          <div className="inner">
            <div className="dhead">
              <span className="dname">{car.model}</span>
              <span className="dmeta">{car.year} · {brand.name.toUpperCase()}</span>
            </div>
            <div className="tags dtags">
              {m.road_legal ? <span className="tag">Road legal</span> : <span className="tag track">Track only</span>}
              {isOneOff(car) && <span className="tag oneoff">One-off</span>}
              <span className="tag">{m.status}</span>
              <FavHeart id={car.id} inline />
            </div>

            <div className="plaque">
              <div className="plaque-title">Build Plaque · Specifications</div>
              <div className="pgrid">
                <PlaqueItem lab="Horsepower" val={`${s.horsepower_hp} hp`} big />
                <PlaqueItem lab="Torque" val={`${s.torque_lbft} lb-ft`} big />
                <PlaqueItem lab="Weight (dry)" val={`${s.weight_lbs.toLocaleString()} lbs`} big />
                <PlaqueItem lab="0–60 mph" val={`${s.zero_to_sixty_s} s`} big />
                <PlaqueItem lab="Top speed" val={topSpeed} big />
                <PlaqueItem lab="Drivetrain" val={s.drivetrain} />
                <PlaqueItem lab="Engine" val={s.engine} wide />
                <PlaqueItem lab="Powertrain" val={s.powertrain} wide />
                <PlaqueItem lab="Downforce" val={s.downforce} wide />
                <PlaqueItem lab="Price" val={m.price} wide />
                <PlaqueItem lab="Production" val={m.production} wide />
              </div>
            </div>

            <div className="sect"><h3>The Story</h3><p>{car.content.story}</p></div>
            <div className="sect"><h3>Engineering</h3><p>{car.content.engineering}</p></div>
            <div className="sect"><h3>Records &amp; Claims to Fame</h3><p>{car.content.records}</p></div>

            <div className="sect">
              <h3>Photos</h3>
              {car.images?.length ? (
                <div className="gal">
                  {car.images.map(f => (
                    <figure className="gfig" key={f}>
                      <button className="gitem" onClick={() => setLightbox(f)} aria-label={`View photo of ${car.model}`}>
                        <img src={imageUrl(car, f)} alt={car.model} loading="lazy" />
                      </button>
                      <figcaption className="gcredit">{credits[f] || ''}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="gempty">No photos yet for this one.</div>
              )}
            </div>
          </div>
        </article>
      </div>

      {lightbox && (
        <button className="lightbox" onClick={() => setLightbox(null)} aria-label="Close photo">
          <img src={imageUrl(car, lightbox)} alt={car.model} />
          <span className="gcredit">{credits[lightbox] || ''}</span>
        </button>
      )}
    </div>
  )
}
