import { useEffect, useMemo, useRef, useState } from 'react'

// A search box over every car, driveable entirely from the keyboard: type,
// arrow up/down through the matches, Enter to take one, Escape to dismiss.
// The list scrolls, so a broad search like "gt" stays reachable.
const LIMIT = 40

export default function CarSearch({
  all,
  onPick,
  onSubmit,          // optional: Enter with nothing highlighted
  placeholder = 'Search all cars…',
  label,
  autoFocus = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const list = useRef(null)

  useEffect(() => {
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const hits = all.filter(e => `${e.brand.name} ${e.car.model}`.toLowerCase().includes(q))
    // A match at the start of the model name is what you usually meant.
    hits.sort((a, b) => {
      const rank = e => (e.car.model.toLowerCase().startsWith(q) ? 0 : 1)
      return rank(a) - rank(b) || a.car.year - b.car.year
    })
    return hits.slice(0, LIMIT)
  }, [all, query])

  useEffect(() => { setActive(0) }, [query])

  // Keep the highlighted row visible as the selection walks past the fold.
  useEffect(() => {
    if (!open || !list.current) return
    list.current.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = entry => {
    onPick(entry)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = e => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!matches.length) {
      if (e.key === 'Enter' && onSubmit && query.trim()) { onSubmit(query.trim()); setOpen(false) }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(i => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive(i => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && matches[active]) choose(matches[active])
      else if (onSubmit && query.trim()) { onSubmit(query.trim()); setOpen(false) }
    }
  }

  const showing = open && matches.length > 0

  return (
    <div className="cmp-picker" ref={box}>
      {label && <label className="plab">{label}</label>}
      <input
        className="search cmp-search"
        type="text"
        role="combobox"
        aria-expanded={showing}
        aria-controls="car-search-list"
        aria-autocomplete="list"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showing && (
        <ul className="cmp-results" id="car-search-list" role="listbox" ref={list}>
          {matches.map((e, i) => (
            <li key={e.car.id} role="option" aria-selected={i === active}>
              <button
                className={i === active ? 'on' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(e)}
              >
                <span>{e.car.model}</span>
                <span className="cmp-result-meta">{e.brand.name} · {e.car.year}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
