// Data loading with per-brand lazy caching. Everything is static JSON under
// public/data/, fetched relative to the page so it works on any host.
const BASE = import.meta.env.BASE_URL

let brandsPromise = null
const brandDataCache = new Map()

export function fetchBrands() {
  if (!brandsPromise) {
    brandsPromise = fetch(`${BASE}data/brands.json`).then(r => {
      if (!r.ok) throw new Error(`brands.json: ${r.status}`)
      return r.json()
    }).then(j => j.brands)
  }
  return brandsPromise
}

export function fetchBrandData(brand) {
  // `brand` is a brand object from brands.json with a `data` path
  if (!brandDataCache.has(brand.id)) {
    brandDataCache.set(brand.id, fetch(`${BASE}${brand.data}`).then(r => {
      if (!r.ok) throw new Error(`${brand.data}: ${r.status}`)
      return r.json()
    }))
  }
  return brandDataCache.get(brand.id)
}

// Brands that actually have a data file (not just "planned")
export async function fetchActiveBrands() {
  const brands = await fetchBrands()
  return brands.filter(b => b.data)
}

// All cars across all active brands, each tagged with its brand object.
export async function fetchAllCars() {
  const brands = await fetchActiveBrands()
  const datasets = await Promise.all(brands.map(fetchBrandData))
  return datasets.flatMap((d, i) => d.cars.map(car => ({ car, brand: brands[i] })))
}

export const slugOf = car => car.id.split('/')[1]
// Each image entry has `file` (the original as uploaded) and `thumb` (a 560px
// WebP built at compile time). Card grids use thumbs so a page of 40 cars stays
// light; a car's own page uses the original at full quality. Credits are baked
// into the data at build time, so there's nothing to fetch at runtime.
export const imageUrl = (car, img) => `${BASE}images/${car.brand}/${img.file}`
export const thumbUrl = (car, img) => `${BASE}thumbs/${car.brand}/${img.thumb}`
export const coverUrl = car => (car.images?.length ? thumbUrl(car, car.images[0]) : null)

// First number in a value: "1,018 (E85) / 806 (petrol)" -> 1018, "~2,400 (est.)" -> 2400.
// Returns null for non-numeric strings like "Not published".
export function numOf(v) {
  if (typeof v === 'number') return v
  const m = /[\d][\d,]*(\.\d+)?/.exec(String(v ?? ''))
  return m ? parseFloat(m[0].replace(/,/g, '')) : null
}

// Compact display for card stats: parsed number or an em dash.
export function statOf(v) {
  const n = numOf(v)
  return n == null ? '—' : n.toLocaleString()
}

export function isOneOff(car) {
  return /one-off/i.test(car.market.status) || /^1\b/.test(String(car.market.production))
}

// Short fallback mark for cars without a photo, e.g. "F" for "Zonda F"
export function initials(car) {
  const m = car.model.replace(new RegExp(`^${car.family} ?`), '')
  return m ? m.split(' ')[0].slice(0, 6) : car.family
}

// Deterministic "car of the day": rotates daily through all cars.
export function carOfTheDay(all) {
  if (!all.length) return null
  const days = Math.floor(Date.now() / 86400000)
  return all[days % all.length]
}
