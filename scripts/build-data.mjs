// Converts "Car Database.xlsx" (the source of truth for all car data) into
// per-brand JSON files under public/data/, and fills each car's `images`
// array by scanning public/images/<brand>/<slug>/ — so adding a car is a
// spreadsheet row and adding a photo is dropping a file in a folder.
//
// Runs automatically before `npm run dev` and `npm run build`.
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const ROOT = path.resolve(import.meta.dirname, '..')
const XLSX_PATH = path.join(ROOT, 'Car Database.xlsx')
const BRANDS_PATH = path.join(ROOT, 'public', 'data', 'brands.json')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const IMG_DIR = path.join(ROOT, 'public', 'images')

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i

function imagesFor(brandId, slug) {
  const dir = path.join(IMG_DIR, brandId, slug)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => IMG_EXT.test(f))
    .sort((a, b) => (parseInt(a, 10) || 9999) - (parseInt(b, 10) || 9999) || a.localeCompare(b))
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
    images: imagesFor(brand.id, slug),
  })
}

fs.mkdirSync(DATA_DIR, { recursive: true })
for (const [id, cars] of carsByBrand) {
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify({ brand: id, cars }, null, 1))
  console.log(`${id}: ${cars.length} cars, ${cars.reduce((n, c) => n + c.images.length, 0)} photos`)
}
for (const m of unknown) {
  console.warn(`WARNING: manufacturer "${m}" is in the spreadsheet but not in public/data/brands.json — its cars were skipped. Add a brand entry to include them.`)
}
