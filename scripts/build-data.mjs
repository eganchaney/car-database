// Converts "Car Database.xlsx" (the source of truth for all car data) into
// per-brand JSON files under public/data/, and fills each car's `images`
// array by scanning public/images/<brand>/<slug>/ — so adding a car is a
// spreadsheet row and adding a photo is dropping a file in a folder.
//
// Runs automatically before `npm run dev` and `npm run build`.
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { buildImages, derivedPath } from './build-images.mjs'

await buildImages()

const ROOT = path.resolve(import.meta.dirname, '..')
const XLSX_PATH = path.join(ROOT, 'Car Database.xlsx')
const BRANDS_PATH = path.join(ROOT, 'public', 'data', 'brands.json')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const IMG_DIR = path.join(ROOT, 'public', 'images')

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i
const readJSON = p => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {})

// Works out which car a loose file in the brand folder belongs to. Files
// downloaded from the web rarely arrive named exactly like the slug, so this
// forgives case, underscores, a repeated brand name, and a trailing "-1":
//
//   Koenigsegg-CCR-1.webp        → ccr
//   koenigsegg_ccxr_special-1.jpg → ccxr-special-edition
//   koenigsegg_regera-2.png      → regera, second photo
//
// An exact slug is always tried first, so "agera-rs1.jpg" stays its own car
// rather than being read as photo 1 of "agera-rs". A loose match is only
// accepted when exactly one car fits — ambiguity is reported, never guessed.
function matchFlatFile(base, brandId, found) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const candidates = []
  const n = norm(base)
  candidates.push([n, 1])
  const numbered = /^(.*)-(\d+)$/.exec(n)
  if (numbered) candidates.push([numbered[1], Number(numbered[2])])
  // the same list again with a leading brand name ("koenigsegg-…") removed
  for (const [c, order] of [...candidates]) {
    if (c.startsWith(`${brandId}-`)) {
      const stripped = c.slice(brandId.length + 1)
      candidates.push([stripped, order])
      const m = /^(.*)-(\d+)$/.exec(stripped)
      if (m) candidates.push([m[1], Number(m[2])])
    }
  }
  for (const [c, order] of candidates) {
    if (found.has(c)) return { slug: c, order }
  }
  // Last resort: a partial name, accepted only when it fits exactly one car.
  // A filename that is part of a slug ("ccxr-edition" inside
  // "ccx-edition-ccxr-edition") is the stronger signal, so it is tried first —
  // otherwise a shorter sibling slug like "ccxr" would make it look ambiguous.
  const slugs = [...found.keys()]
  for (const [c, order] of candidates) {
    if (c.length < 3) continue
    const inside = slugs.filter(s => s.includes(c))
    if (inside.length === 1) return { slug: inside[0], order }
  }
  for (const [c, order] of candidates) {
    if (c.length < 3) continue
    const contains = slugs.filter(s => c.includes(s))
    if (contains.length === 1) return { slug: contains[0], order }
  }
  return null
}

// Two photo layouts are supported, so you can use whichever is less work:
//
//   nested — public/images/<brand>/<slug>/1.jpg  + that folder's credits.json
//   flat   — public/images/<brand>/<slug>.jpg    + the brand folder's credits.json
//            (extra photos: <slug>-2.jpg, <slug>-3.jpg …)
//
// The flat layout means every car in a brand lives in ONE folder, so a whole
// brand's photos can be uploaded in a single drag-and-drop.
// Returns, per car slug, [{ file: <path relative to the brand folder>, credit }].
function scanBrandImages(brandId, slugs) {
  const brandDir = path.join(IMG_DIR, brandId)
  const found = new Map(slugs.map(s => [s, []]))
  if (!fs.existsSync(brandDir)) return found

  const brandCredits = readJSON(path.join(brandDir, 'credits.json'))

  for (const entry of fs.readdirSync(brandDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!found.has(entry.name)) continue
      const credits = readJSON(path.join(brandDir, entry.name, 'credits.json'))
      for (const f of fs.readdirSync(path.join(brandDir, entry.name))) {
        if (!IMG_EXT.test(f)) continue
        found.get(entry.name).push({
          file: `${entry.name}/${f}`,
          credit: credits[f] || '',
          order: parseInt(f, 10) || Number.MAX_SAFE_INTEGER,
          name: f,
        })
      }
      continue
    }
    if (!IMG_EXT.test(entry.name)) continue
    const match = matchFlatFile(entry.name.replace(IMG_EXT, ''), brandId, found)
    if (!match) {
      console.warn(`WARNING: images/${brandId}/${entry.name} doesn't match any car — skipped.`)
      continue
    }
    const { slug, order } = match
    found.get(slug).push({
      file: entry.name,
      credit: brandCredits[entry.name] || '',
      order,
      name: entry.name,
    })
  }

  for (const list of found.values()) {
    list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    // `file` is the original (served on a car's own page, full quality);
    // `thumb` is the generated 560px cover used by every card grid.
    list.forEach(p => {
      p.thumb = derivedPath(p.file)
      delete p.order
      delete p.name
    })
  }
  return found
}

function roadLegal(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'yes' || s.startsWith('yes')) return true
  if (s === 'no' || s.startsWith('no ') || s.startsWith('no(')) return false
  return String(v ?? '').trim() || null // e.g. "Nominally (a few road-registered)"
}

const brandsFile = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf8'))
const brands = brandsFile.brands
const byName = new Map(brands.map(b => [b.name.toLowerCase(), b]))

if (!fs.existsSync(XLSX_PATH)) {
  console.error(`ERROR: "${XLSX_PATH}" not found — it is the source of truth for car data.`)
  process.exit(1)
}

const wb = XLSX.read(fs.readFileSync(XLSX_PATH))
const sheetName = wb.SheetNames.find(n => {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, range: 0, blankrows: false })
  return rows[0]?.includes('Manufacturer') && rows[0]?.includes('Model')
})
if (!sheetName) {
  console.error('ERROR: no sheet with "Manufacturer" and "Model" header columns found.')
  process.exit(1)
}
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

const carsByBrand = new Map(brands.map(b => [b.id, []]))
const unknown = new Set()

for (const row of rows) {
  const mfr = String(row['Manufacturer'] ?? '').trim()
  if (!mfr) continue
  const brand = byName.get(mfr.toLowerCase())
  if (!brand) { unknown.add(mfr); continue }

  const model = String(row['Model']).trim()
  const slug = slugify(model)
  const famKeys = Object.keys(brand.theme?.familyAccents || {}).sort((a, b) => b.length - a.length)
  const family = famKeys.find(k => model.startsWith(k)) || null

  carsByBrand.get(brand.id).push({
    id: `${brand.id}/${slug}`,
    brand: brand.id,
    family,
    model,
    year: row['Year'],
    specs: {
      horsepower_hp: row['Horsepower (hp)'],
      torque_lbft: row['Torque (lb-ft)'],
      weight_lbs: row['Weight (lbs)'],
      zero_to_sixty_s: row['0-60 mph (s)'],
      top_speed_mph: row['Top Speed (mph)'],
      engine: row['Engine Type & Name'],
      powertrain: row['Powertrain'],
      drivetrain: row['Drivetrain'],
      downforce: row['Downforce'],
    },
    market: {
      price: row['Original Retail Price'],
      value_est: row['Estimated Value (2026)'],
      production: row['Production Count'],
      status: row['Production Status'],
      road_legal: roadLegal(row['Road Legal']),
    },
    content: {
      story: row['The Story'],
      engineering: row['Engineering'],
      records: row['Records & Claims to Fame'],
    },
    images: [],
  })
}

// Photos are matched per brand, since the flat layout keeps every car of a
// brand in one folder and needs the brand's full slug list to disambiguate.
for (const [id, cars] of carsByBrand) {
  const found = scanBrandImages(id, cars.map(c => c.id.split('/')[1]))
  for (const car of cars) car.images = found.get(car.id.split('/')[1]) || []
}

fs.mkdirSync(DATA_DIR, { recursive: true })
for (const [id, cars] of carsByBrand) {
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify({ brand: id, cars }, null, 1))
  console.log(`${id}: ${cars.length} cars, ${cars.reduce((n, c) => n + c.images.length, 0)} photos`)
}
for (const m of unknown) {
  console.warn(`WARNING: manufacturer "${m}" is in the spreadsheet but not in public/data/brands.json — its cars were skipped. Add a brand entry to include them.`)
}
