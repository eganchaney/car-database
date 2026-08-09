import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAllCars, initials, moneyOf, numOf, thumbUrl, verifiedNum, withUnit } from '../lib/data.js'
import { applyTheme, familyAccent } from '../lib/theme.js'

const money = n => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : `$${Math.round(n).toLocaleString()}`)

// Each leaderboard: how to rank, and what to print under the car's name. The
// printed value is the database's own wording, so estimates stay labelled as
// estimates rather than being laundered into hard figures.
const BOARDS = [
  {
    title: 'Most powerful',
    note: 'peak horsepower',
    rank: c => numOf(c.specs.horsepower_hp),
    best: 'high',
    show: c => withUnit(c.specs.horsepower_hp, 'hp'),
  },
  {
    title: 'Best power-to-weight',
    note: 'horsepower per ton, the number that settles arguments',
    rank: c => {
      const hp = numOf(c.specs.horsepower_hp), lbs = numOf(c.specs.weight_lbs)
      return hp && lbs ? hp / (lbs / 2000) : null
    },
    best: 'high',
    show: (c, v) => `${Math.round(v).toLocaleString()} hp/ton`,
  },
  {
    title: 'Quickest to 60',
    note: 'seconds, as published',
    rank: c => verifiedNum(c.specs.zero_to_sixty_s),
    best: 'low',
    show: c => withUnit(c.specs.zero_to_sixty_s, 's'),
  },
  {
    title: 'Highest top speed',
    note: 'achieved figures only — targets and simulations excluded',
    rank: c => verifiedNum(c.specs.top_speed_mph),
    best: 'high',
    show: c => withUnit(c.specs.top_speed_mph, 'mph'),
  },
  {
    title: 'Lightest',
    note: 'dry weight',
    rank: c => numOf(c.specs.weight_lbs),
    best: 'low',
    show: c => withUnit(c.specs.weight_lbs, 'lbs'),
  },
  {
    title: 'Most valuable',
    note: 'estimated 2026 value — ranges count from their lower end',
    rank: c => moneyOf(c.market.value_est),
    best: 'high',
    show: (c, v) => money(v),
  },
]

export default function RecordsPage() {
  const [all, setAll] = useState(null)

  useEffect(() => {
    applyTheme(null)
    fetchAllCars().then(setAll)
    return () => applyTheme(null)
  }, [])

  if (!all) return <div className="loading">Reading 597 cars…</div>

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span> RECORD HOLDERS
        </div>
        <h1>The <em>extremes</em></h1>
        <p className="sub">
          Every marque measured against every other. <Link className="sub-link" to="/explore">Browse the whole collection →</Link>
        </p>
      </header>

      <div className="boards">
        {BOARDS.map(board => {
          const ranked = all
            .map(e => ({ ...e, value: board.rank(e.car) }))
            .filter(e => e.value != null && isFinite(e.value))
            .sort((a, b) => (board.best === 'high' ? b.value - a.value : a.value - b.value))
            .slice(0, 5)
          if (!ranked.length) return null
          const [winner, ...rest] = ranked
          return (
            <section className="board" key={board.title}>
              <h2>{board.title}<span className="h2note">{board.note}</span></h2>
              <Winner entry={winner} text={board.show(winner.car, winner.value)} />
              <ol className="board-rest">
                {rest.map((e, i) => (
                  <li key={e.car.id}>
                    <span className="board-rank">{i + 2}</span>
                    <Link to={`/${e.car.id}`} className="board-name">{e.car.model}</Link>
                    <span className="board-brand">{e.brand.name}</span>
                    <span className="board-value">{board.show(e.car, e.value)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
      <footer>Figures come from the spreadsheet — estimates are labelled there and shown as written.</footer>
    </>
  )
}

function Winner({ entry, text }) {
  const { car, brand } = entry
  const photo = car.images?.[0]
  const fam = familyAccent(brand, car.family) || brand.theme?.accent
  return (
    <Link className="board-winner" to={`/${car.id}`} style={fam ? { '--fam': fam } : undefined}>
      <div className="board-photo">
        {photo
          ? <img src={thumbUrl(car, photo)} alt={car.model} loading="lazy" />
          : <div className="mono-mark">{initials(car)}</div>}
      </div>
      <div className="board-body">
        <div className="board-brand">{brand.name} · {car.year}</div>
        <div className="board-model">{car.model}</div>
        <div className="board-figure">{text}</div>
      </div>
    </Link>
  )
}
