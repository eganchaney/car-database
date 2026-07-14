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

const creditsCache = new Map()
export function fetchCredits(carId) {
  // carId is "brand/slug"; credits live at images/<brand>/<slug>/credits.json
  if (!creditsCache.has(carId)) {
    creditsCache.set(carId, fetch(`${BASE}images/${carId}/credits.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({})))
  }
  return creditsCache.get(carId)
}

export const slugOf = car => car.id.split('/')[1]
export const imageUrl = (car, file) => `${BASE}images/${car.id}/${file}`
export const coverUrl = car => (car.images?.length ? imageUrl(car, car.images[0]) : null)

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
