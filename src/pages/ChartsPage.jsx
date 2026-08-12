import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchAllCars, numOf, powertrainOf, verifiedNum } from '../lib/data.js'
import { applyTheme } from '../lib/theme.js'

// Categorical slots 1–3, stepped for a dark surface. Validated all-pairs
// against this page's surface (#1a1c20): worst CVD ΔE 9.4, normal-vision 20.9,
// every hue ≥3:1 on the surface. Order is the colourblind-safety mechanism —
// don't reshuffle without re-validating.
const SERIES = {
  ice: { label: 'Combustion', color: '#3987e5' },
  hybrid: { label: 'Hybrid', color: '#d95926' },
  electric: { label: 'Electric', color: '#199e70' },
}

const CHARTS = [
  {
    id: 'hp',
    title: 'Horsepower over time',
    note: 'One dot per car. The climb is steady until turbocharging, then vertical.',
    unit: 'hp',
    of: c => numOf(c.specs.horsepower_hp),
  },
  {
    id: 'ptw',
    title: 'Power-to-weight over time',
    note: 'The honest measure of quickness — horsepower per ton.',
    unit: 'hp/ton',
    of: c => {
      const hp = numOf(c.specs.horsepower_hp), lbs = numOf(c.specs.weight_lbs)
      return hp && lbs ? Math.round(hp / (lbs / 2000)) : null
    },
  },
  {
    id: 'weight',
    title: 'Weight over time',
    note: 'Carbon fibre pulls one way, batteries and crash structures the other.',
    unit: 'lbs',
    of: c => numOf(c.specs.weight_lbs),
  },
  {
    id: 'zero',
    title: '0–60 mph over time',
    note: 'Lower is quicker. Electric motors flatten what a century of engines could not.',
    unit: 's',
    of: c => verifiedNum(c.specs.zero_to_sixty_s),
    lowerIsBetter: true,
  },
]

// A rounded axis maximum, so ticks land on numbers a person would choose.
function niceMax(value) {
  const mag = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / (mag / 2)) * (mag / 2)
}

const fmt = n => (n >= 1000 ? n.toLocaleString() : String(Math.round(n * 100) / 100))

function Scatter({ chart, points, onPick }) {
  const [hover, setHover] = useState(null)
  const wrap = useRef(null)

  const W = 900, H = 420
  const pad = { l: 62, r: 18, t: 14, b: 34 }
  const years = points.map(p => p.year)
  const x0 = Math.min(...years), x1 = Math.max(...years)
  const yMax = niceMax(Math.max(...points.map(p => p.value)))
  const sx = year => pad.l + ((year - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const sy = v => H - pad.b - (v / yMax) * (H - pad.t - pad.b)

  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i)
  const xTicks = []
  for (let y = Math.ceil(x0 / 20) * 20; y <= x1; y += 20) xTicks.push(y)

  // Direct labels for the handful of cars that define the shape of the plot —
  // never a label on every point. Record-setters bunch together at the top
  // right, so each label is only drawn if it clears the ones already placed;
  // the next-best car takes the slot instead of two names overlapping.
  const notable = []
  const boxes = []
  const ranked = [...points].sort((a, b) => (chart.lowerIsBetter ? a.value - b.value : b.value - a.value))
  for (const p of ranked.slice(0, 12)) {
    const cx = sx(p.year), cy = sy(p.value) - 11
    const w = p.model.length * 5.9, h = 13
    const anchor = cx > W - 160 ? 'end' : cx < 160 ? 'start' : 'middle'
    const left = anchor === 'end' ? cx - w : anchor === 'start' ? cx : cx - w / 2
    const box = { x0: left, x1: left + w, y0: cy - h, y1: cy + 3 }
    if (boxes.some(b => box.x1 > b.x0 && box.x0 < b.x1 && box.y1 > b.y0 && box.y0 < b.y1)) continue
    boxes.push(box)
    notable.push({ ...p, anchor })
    if (notable.length === 3) break
  }

  return (
    <div className="chart-wrap" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
           aria-label={`${chart.title}. ${points.length} cars plotted.`}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={pad.l - 10} y={sy(t) + 4} className="chart-tick" textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={sx(t)} y={H - pad.b + 20} className="chart-tick" textAnchor="middle">{t}</text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="chart-axis" />

        {points.map(p => (
          <circle
            key={p.id}
            cx={sx(p.year)} cy={sy(p.value)} r={hover?.id === p.id ? 7 : 4.5}
            fill={SERIES[p.type].color}
            className="chart-dot"
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(h => (h?.id === p.id ? null : h))}
            onClick={() => onPick(p)}
          />
        ))}

        {notable.map(p => (
          <text key={`l-${p.id}`} x={sx(p.year)} y={sy(p.value) - 11}
                className="chart-label" textAnchor={p.anchor}>
            {p.model}
          </text>
        ))}
      </svg>

      {hover && (
        <div
          className="chart-tip"
          style={{
            left: `${(sx(hover.year) / W) * 100}%`,
            top: `${(sy(hover.value) / H) * 100}%`,
          }}
        >
          <b>{hover.model}</b>
          <span>{hover.brand} · {hover.year}</span>
          <span className="chart-tip-value">{fmt(hover.value)} {chart.unit}</span>
        </div>
      )}
    </div>
  )
}

export default function ChartsPage() {
  const [all, setAll] = useState(null)
  const [table, setTable] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    applyTheme(null)
    fetchAllCars().then(setAll)
    return () => applyTheme(null)
  }, [])

  const series = useMemo(() => {
    if (!all) return {}
    const out = {}
    for (const chart of CHARTS) {
      out[chart.id] = all
        .map(({ car, brand }) => {
          const value = chart.of(car)
          return value && car.year
            ? { id: car.id, model: car.model, brand: brand.name, year: car.year, value, type: powertrainOf(car) }
            : null
        })
        .filter(Boolean)
    }
    return out
  }, [all])

  if (!all) return <div className="loading">Plotting 675 cars…</div>

  return (
    <>
      <header className="page">
        <div className="crumb"><Link to="/">← Home</Link></div>
        <div className="kicker" style={{ marginTop: 18 }}>
          <span className="pipes"><i /><i /><i /><i /></span> A CENTURY, PLOTTED
        </div>
        <h1>The <em>shape</em> of it</h1>
        <p className="sub">
          Every car in the database with a published figure, from 1910 to today. Hover a dot
          for the car, click it to open the page.
        </p>
        <div className="chart-legend">
          {Object.entries(SERIES).map(([k, s]) => (
            <span key={k}><i style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      </header>

      <div className="charts">
        {CHARTS.map(chart => {
          const points = series[chart.id]
          if (!points?.length) return null
          const ranked = [...points].sort((a, b) =>
            chart.lowerIsBetter ? a.value - b.value : b.value - a.value)
          return (
            <section className="chart-card" key={chart.id}>
              <h2>{chart.title}<span className="h2note">{chart.note}</span></h2>
              <Scatter chart={chart} points={points} onPick={p => navigate(`/${p.id}`)} />
              <div className="chart-foot">
                <span className="count">{points.length} cars with a published figure</span>
                <button className="chip" onClick={() => setTable(table === chart.id ? null : chart.id)}>
                  {table === chart.id ? 'Hide numbers' : 'Show numbers'}
                </button>
              </div>
              {table === chart.id && (
                <table className="chart-table">
                  <thead>
                    <tr><th>Car</th><th>Brand</th><th>Year</th><th>{chart.unit}</th><th>Power</th></tr>
                  </thead>
                  <tbody>
                    {ranked.slice(0, 12).map(p => (
                      <tr key={p.id}>
                        <td><Link to={`/${p.id}`}>{p.model}</Link></td>
                        <td>{p.brand}</td>
                        <td>{p.year}</td>
                        <td>{fmt(p.value)}</td>
                        <td>{SERIES[p.type].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>
      <footer>Figures come from the spreadsheet; cars without a published number for a measure are left out of that chart.</footer>
    </>
  )
}
