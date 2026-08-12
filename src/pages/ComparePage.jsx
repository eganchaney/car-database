import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchAllCars, initials, numOf, thumbUrl, verifiedNum, withUnit } from '../lib/data.js'
import { applyTheme, familyAccent } from '../lib/theme.js'
import CarSearch from '../components/CarSearch.jsx'

// Measures that can be won or lost. `better` says which direction wins; a car
// whose value is prose ("Not published") simply doesn't compete on that row.
const MEASURES = [
  { label: 'Horsepower', unit: 'hp', better: 'high', of: c => c.specs.horsepower_hp },
  { label: 'Torque', unit: 'lb-ft', better: 'high', of: c => c.specs.torque_lbft },
  { label: 'Weight (dry)', unit: 'lbs', better: 'low', of: c => c.specs.weight_lbs },
  { label: '0–60 mph', unit: 's', better: 'low', of: c => c.specs.zero_to_sixty_s },
  { label: 'Top speed', unit: 'mph', better: 'high', of: c => c.specs.top_speed_mph },
  {
    label: 'Power-to-weight', unit: 'hp/ton', better: 'high', derived: true,
    of: c => {
      const hp = numOf(c.specs.horsepower_hp), lbs = numOf(c.specs.weight_lbs)
      return hp && lbs ? Math.round(hp / (lbs / 2000)) : null
    },
  },
]

const DETAILS = [
  { label: 'Year', of: c => c.year },
  { label: 'Engine', of: c => c.specs.engine },
  { label: 'Powertrain', of: c => c.specs.powertrain },
  { label: 'Drivetrain', of: c => c.specs.drivetrain },
  { label: 'Downforce', of: c => c.specs.downforce },
  { label: 'Original price', of: c => c.market.price },
  { label: 'Value (2026)', of: c => c.market.value_est },
  { label: 'Production', of: c => c.market.production },
  { label: 'Status', of: c => c.market.status },
  {
    label: 'Road legal',
    of: c => (c.market.road_legal === true ? 'Yes'
      : c.market.road_legal === false ? 'No — track only'
      : c.market.road_legal),
  },
]

const display = (value, unit) => withUnit(value, unit) ?? '—'

// A target or a simulation isn't an achieved figure — the Jesko Absolut's
// "unverified (simulated 330+)" shouldn't beat a measured top speed. Such
// values are still shown, they just don't win the row or count in the tally.
const figure = verifiedNum

export default function ComparePage() {
  const { brandA, slugA, brandB, slugB } = useParams()
  const navigate = useNavigate()
  const [all, setAll] = useState(null)

  useEffect(() => {
    applyTheme(null)
    fetchAllCars().then(setAll)
    return () => applyTheme(null)
  }, [])

  const byId = useMemo(() => new Map((all || []).map(e => [e.car.id, e])), [all])
  const left = brandA && slugA ? byId.get(`${brandA}/${slugA}`) : null
  const right = brandB && slugB ? byId.get(`${brandB}/${slugB}`) : null

  // Keep the URL the source of truth so any pairing can be shared or bookmarked.
  const choose = (side, entry) => {
    const a = side === 'left' ? entry : left
    const b = side === 'right' ? entry : right
    if (a && b) navigate(`/compare/${a.car.id}/vs/${b.car.id}`)
    else if (a) navigate(`/compare/${a.car.id}`)
    else if (b) navigate(`/compare/${b.car.id}`)   // a lone car always sits on the left
    else navigate('/compare')
  }

  if (!all) return <div className="loading">Loading the collection…</div>

  const verdict = tally(left?.car, right?.car)

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span> HEAD TO HEAD
        </div>
        <h1>Compare <em>any two</em></h1>
        <p className="sub">
          Pick two cars from anywhere in the database — same brand or across marques — and
          see who actually wins on paper.
        </p>
      </header>

      <div className="cmp">
        <div className="cmp-pickers">
          <CarSearch
            all={all} onPick={e => choose('left', e)} label="First car"
            placeholder={left ? left.car.model : 'Search all cars…'}
          />
          <span className="cmp-vs">vs</span>
          <CarSearch
            all={all} onPick={e => choose('right', e)} label="Second car"
            placeholder={right ? right.car.model : 'Search all cars…'}
          />
        </div>

        {verdict && <p className="cmp-verdict">{verdict}</p>}

        {left && right
          ? <Table left={left} right={right} />
          : <div className="empty-note">
              {left || right
                ? 'Pick a second car to see the head-to-head.'
                : 'Pick two cars to compare.'}
            </div>}
      </div>
    </>
  )
}

// "Huayra wins 4 of 6 measures" — only measures both cars publish are counted.
function tally(a, b) {
  if (!a || !b) return null
  let aWins = 0, bWins = 0, comparable = 0
  for (const m of MEASURES) {
    const x = figure(m.of(a)), y = figure(m.of(b))
    if (x == null || y == null) continue
    comparable++
    if (x === y) continue
    const aBetter = m.better === 'high' ? x > y : x < y
    if (aBetter) aWins++; else bWins++
  }
  if (!comparable) return 'Neither car publishes enough figures to compare.'
  if (aWins === bWins) return `Dead even — ${aWins} measures each of ${comparable}.`
  const [name, wins] = aWins > bWins ? [a.model, aWins] : [b.model, bWins]
  return `${name} wins ${wins} of ${comparable} measures.`
}

function Table({ left, right }) {
  const accent = e => familyAccent(e.brand, e.car.family) || e.brand.theme?.accent
  const style = { '--fam-a': accent(left), '--fam-b': accent(right) }

  return (
    <div className="cmp-table" style={style}>
      <div className="cmp-row cmp-heads">
        <CarHead entry={left} side="a" />
        <span className="cmp-label" />
        <CarHead entry={right} side="b" />
      </div>

      {MEASURES.map(m => {
        const rawA = m.of(left.car), rawB = m.of(right.car)
        const x = figure(rawA), y = figure(rawB)
        const both = x != null && y != null
        const aWins = both && x !== y && (m.better === 'high' ? x > y : x < y)
        const bWins = both && x !== y && !aWins
        const gap = both ? Math.abs(x - y) : null
        // The winner of a lower-is-better measure is under by the gap, not over it.
        const gapText = gap
          ? `${m.better === 'high' ? '+' : '−'}${gap.toLocaleString()} ${m.unit}`
          : null
        return (
          <div className="cmp-row" key={m.label}>
            <div className={`cmp-val a${aWins ? ' win' : ''}`}>
              {display(rawA, m.unit)}
              {aWins && <span className="cmp-gap">{gapText}</span>}
            </div>
            <div className="cmp-label">{m.label}</div>
            <div className={`cmp-val b${bWins ? ' win' : ''}`}>
              {display(rawB, m.unit)}
              {bWins && <span className="cmp-gap">{gapText}</span>}
            </div>
          </div>
        )
      })}

      <div className="cmp-divider">Details</div>

      {DETAILS.map(d => (
        <div className="cmp-row" key={d.label}>
          <div className="cmp-val a quiet">{display(d.of(left.car))}</div>
          <div className="cmp-label">{d.label}</div>
          <div className="cmp-val b quiet">{display(d.of(right.car))}</div>
        </div>
      ))}
    </div>
  )
}

function CarHead({ entry, side }) {
  const { car, brand } = entry
  const photo = car.images?.[0]
  return (
    <Link className={`cmp-head ${side}`} to={`/${car.id}`}>
      <div className="cmp-photo">
        {photo
          ? <img src={thumbUrl(car, photo)} alt={car.model} />
          : <div className="mono-mark">{initials(car)}</div>}
      </div>
      <div className="cmp-brand">{brand.name}</div>
      <div className="cmp-name">{car.model}</div>
    </Link>
  )
}
