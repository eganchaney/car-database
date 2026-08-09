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
import { matchPhotoToCar } from './match-photo.mjs'

await buildImages()

const ROOT = path.resolve(import.meta.dirname, '..')
const XLSX_PATH = path.join(ROOT, 'Car Database.xlsx')
const BRANDS_PATH = path.join(ROOT, 'public', 'data', 'brands.json')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const IMG_DIR = path.join(ROOT, 'public', 'images')

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i
const readJSON = p => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {})

// Two photo layouts are supported, so you can use whichever is less work:
//
//   nested — public/images/<brand>/<slug>/1.jpg  + that folder's credits.json
//   flat   — public/images/<brand>/<slug>.jpg    + the brand folder's credits.json
//            (extra photos: <slug>-2.jpg, <slug>-3.jpg …)
//
// The flat layout means every car in a brand lives in ONE folder, so a whole
// brand's photos can be uploaded in a single drag-and-drop.
// Returns, per car slug, [{ file: <path relative to the brand folder>, credit }].
function scanBrandImages(brandId, slugs, report) {
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
    const match = matchPhotoToCar(entry.name.replace(IMG_EXT, ''), brandId, found.keys())
    if (match.unmatched) {
      report.unmatched.push({
        path: `public/images/${brandId}/${entry.name}`,
        brandId,
        file: entry.name,
        suggestion: match.suggestion,
        ambiguous: match.ambiguous,
      })
      continue
    }
    const { slug, order } = match
    if (match.how !== 'exact') {
      report.matched.push({ brandId, file: entry.name, slug, how: match.how })
    }
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
const report = { matched: [], unmatched: [] }
for (const [id, cars] of carsByBrand) {
  const found = scanBrandImages(id, cars.map(c => c.id.split('/')[1]), report)
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
// Show every photo that needed more than an exact name, so a wrong guess is
// visible rather than silent.
if (report.matched.length) {
  console.log(`\nPhotos matched by name (${report.matched.length}):`)
  for (const m of report.matched) console.log(`  ${m.brandId}/${m.file} → ${m.slug} (${m.how})`)
}
const renameTo = u => (u.suggestion ? `${u.suggestion}${path.extname(u.file)}` : null)
if (report.unmatched.length) {
  console.warn(`\nPhotos not matched to a car (${report.unmatched.length}) — these are skipped:`)
  for (const u of report.unmatched) {
    const fix = renameTo(u) ? ` Rename to "${renameTo(u)}" if that's the one.` : ''
    console.warn(`  ${u.path}${fix}`)
  }
}

// In GitHub Actions, surface unmatched photos where they can't be missed:
// as annotations on the run, and as a table on the run's summary page.
if (process.env.GITHUB_ACTIONS) {
  for (const u of report.unmatched) {
    const fix = renameTo(u)
      ? `Closest car: ${u.suggestion}. Rename the file to "${renameTo(u)}" if that's the one.`
      : 'No similar car name found — check the spelling and the brand folder.'
    const why = u.ambiguous ? 'matches more than one car equally well' : "doesn't match any car"
    console.log(`::warning file=${u.path}::Photo ${why}, so it was skipped. ${fix}`)
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const totalPhotos = [...carsByBrand.values()]
    .reduce((n, cars) => n + cars.reduce((m, c) => m + c.images.length, 0), 0)
  const totalCars = [...carsByBrand.values()].reduce((n, cars) => n + cars.length, 0)
  const withPhotos = [...carsByBrand.values()]
    .reduce((n, cars) => n + cars.filter(c => c.images.length).length, 0)

  const md = [`## Car database\n`,
    `**${totalCars} cars · ${totalPhotos} photos · ${withPhotos} cars have a photo**\n`]

  if (report.unmatched.length) {
    md.push(`### ⚠️ ${report.unmatched.length} photo(s) skipped — not matched to a car\n`)
    md.push('| Photo | Closest car | What to do |', '| --- | --- | --- |')
    for (const u of report.unmatched) {
      md.push(`| \`${u.file}\` (${u.brandId}) | ${u.suggestion ? `\`${u.suggestion}\`` : '—'} | ${
        renameTo(u)
          ? `Rename to \`${renameTo(u)}\`${u.ambiguous ? ' (the name fits more than one car)' : ''}`
          : 'Check the spelling, and that it is in the right brand folder'
      } |`)
    }
    md.push('')
  } else {
    md.push(`### ✅ Every photo matched a car\n`)
  }

  if (report.matched.length) {
    md.push(`<details><summary>${report.matched.length} photo(s) matched by name, not an exact filename</summary>\n`)
    for (const m of report.matched) md.push(`- \`${m.file}\` → **${m.slug}** (${m.brandId})`)
    md.push('\n</details>')
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n')
}
