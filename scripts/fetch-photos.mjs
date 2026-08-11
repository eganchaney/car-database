// Finds a photo for every car in a brand that hasn't got one, using Wikimedia
// Commons — freely licensed, and the API hands back the photographer and
// licence so credits.json fills itself in.
//
//   node scripts/fetch-photos.mjs lotus --dry     # show the picks, download nothing
//   node scripts/fetch-photos.mjs lotus           # download them
//   node scripts/fetch-photos.mjs lotus --limit 5
//
// Files are saved as <slug>.<ext> so the build files them against the right
// car, and images are capped in width — Commons originals run to 20 MB+.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'public', 'data')
const IMG = path.join(ROOT, 'public', 'images')
const API = 'https://commons.wikimedia.org/w/api.php'
const WIDTH = 2000
const UA = 'CarDatabase/1.0 (personal project; https://github.com/eganchaney/car-database)'

// Pictures of a detail, a badge or a museum placard are no use as a hero shot.
const JUNK = /logo|badge|emblem|engine|interior|dashboard|steering|seat|wheel\b|tyre|tire|gearbox|brake|headlight|taillight|tail light|rear light|plaque|sign|diagram|drawing|blueprint|patent|map|graph|chart|assembly line|factory|grave|stamp|coin|model car|scale model|toy|lego|die-?cast/i

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = s => norm(s).split(' ').filter(w => w.length > 1)
const strip = html => String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Commons ${res.status}`)
  return res.json()
}

async function search(query) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',            // File: namespace
    gsrsearch: query,
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(WIDTH),
  })
  return Object.values(data.query?.pages || {})
}

const digits = s => String(s).match(/\d+/g) || []

// "Series 2", "S2", "Mk IV" — a generation marker. Matching the wrong one
// means the wrong car, so a mismatch is rejected outright rather than scored.
function generation(text) {
  const m = /(?:series|mk|mark)\s*([0-9]+|[ivx]+)\b/i.exec(text) || /\bs([1-4])\b/i.exec(text)
  if (!m) return null
  const roman = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' }
  const raw = m[1].toLowerCase()
  return roman[raw] ?? raw
}

// Prefers a picture whose filename actually names this model, is landscape,
// and is big enough to use — then takes the largest of what's left.
// `others` holds the distinctive words of every OTHER car in the brand, so a
// line-up shot ("Exige S1, Elise S3, Elise S2, Evora") loses to a solo photo.
function pick(candidates, brandName, model, others = new Set()) {
  const want = words(model)
  const wantDigits = digits(model)
  const wantGen = generation(model)
  // A row like "Exige (S1/S2/S3)" or "Elise (Series 2/3)" covers several
  // generations at once, so any one of those numbers is a valid match rather
  // than all of them.
  const anyGeneration = /\//.test(model)
  const scored = []
  for (const page of candidates) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    if (!/^image\/(jpeg|png|webp)$/.test(info.mime || '')) continue
    if (info.width < 900 || info.height < 500) continue
    const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
    if (JUNK.test(title)) continue

    // Commons dedups filenames with a trailing "(1)"; that digit isn't part of
    // the car's name, so drop it before any number is compared.
    const bare = title.replace(/\((\d+)\)\s*$/, '').trim()
    const titleDigits = digits(bare)
    const digitsOk = wantDigits.length === 0 || (anyGeneration
      ? wantDigits.some(d => titleDigits.includes(d))
      : wantDigits.every(d => titleDigits.includes(d)))
    if (!digitsOk) continue                                            // 3-Eleven ≠ Eleven

    const gen = generation(bare)
    if (!anyGeneration && wantGen && gen && gen !== wantGen) continue   // Series 1 ≠ Series 2

    const have = new Set(words(bare))
    const hits = want.filter(w => have.has(w)).length
    if (!hits) continue

    let score = hits / want.length
    if (have.has(norm(brandName))) score += 0.25
    if (info.width > info.height) score += 0.15          // landscape suits the hero
    score += Math.min(info.width / 6000, 0.15)
    // Every other model named in the title is another car in the frame. Two
    // or more and it's a line-up, which makes a poor hero shot at any score.
    const intruders = [...have].filter(w => others.has(w) && !want.includes(w)).length
    if (intruders >= 2) continue
    score -= intruders * 0.5
    scored.push({ page, info, title, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.score > 0 ? scored[0] : null
}

function creditFor(info) {
  const meta = info.extmetadata || {}
  const who = strip(meta.Artist?.value) || strip(meta.Credit?.value) || 'Unknown photographer'
  const licence = strip(meta.LicenseShortName?.value) || 'see Wikimedia Commons'
  return `Photo: ${who}, ${licence}, via Wikimedia Commons`
}

const brandId = process.argv[2]
const dry = process.argv.includes('--dry')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

if (!brandId) {
  console.error('Usage: node scripts/fetch-photos.mjs <brand-id> [--dry] [--limit N]')
  process.exit(1)
}

const brands = JSON.parse(fs.readFileSync(path.join(DATA, 'brands.json'), 'utf8')).brands
const brand = brands.find(b => b.id === brandId)
if (!brand) { console.error(`No brand "${brandId}" in brands.json`); process.exit(1) }

const { cars } = JSON.parse(fs.readFileSync(path.join(DATA, `${brandId}.json`), 'utf8'))
const todo = cars.filter(c => !c.images.length).slice(0, limit)
console.log(`${brand.name}: ${todo.length} cars without a photo\n`)

const brandDir = path.join(IMG, brandId)
fs.mkdirSync(brandDir, { recursive: true })
const creditsPath = path.join(brandDir, 'credits.json')
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {}

// Distinctive words belonging to other cars of this brand, used to spot a
// line-up shot. Words this car shares are excluded per-car inside pick().
const vocabulary = new Set(cars.flatMap(c => words(c.model)).filter(w => w.length > 2))

const found = [], empty = []
for (const car of todo) {
  const slug = car.id.split('/')[1]
  // Brackets usually hold a generation note — worth keeping, so "Elise
  // (Series 1)" doesn't match a Series 2, but also worth dropping as a
  // fallback query when Commons has nothing under the full name.
  const plain = car.model.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const inner = /\(([^)]*)\)/.exec(car.model)?.[1] || ''
  const queries = [
    `${brand.name} ${car.model}`,
    `${brand.name} ${plain} ${inner}`.trim(),
    `${brand.name} ${plain}`,
    `${brand.name} ${plain.split('/')[0]}`,
  ]
  let best = null
  for (const q of [...new Set(queries)]) {
    try {
      best = pick(await search(q), brand.name, car.model, vocabulary)
    } catch (e) {
      console.warn(`  ! ${car.model}: ${e.message}`)
    }
    if (best) break
    await new Promise(r => setTimeout(r, 150))
  }
  if (!best) { empty.push(car.model); console.log(`  —  ${car.model}: nothing suitable`); continue }

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[best.info.mime]
  const file = `${slug}.${ext}`
  const credit = creditFor(best.info)
  console.log(`  ✓  ${car.model}\n       ${best.title} (${best.info.width}×${best.info.height})\n       ${credit}`)

  if (!dry) {
    const src = best.info.thumburl || best.info.url     // thumburl is the capped copy
    const res = await fetch(src, { headers: { 'User-Agent': UA } })
    if (!res.ok) { console.warn(`       download failed: ${res.status}`); empty.push(car.model); continue }
    fs.writeFileSync(path.join(brandDir, file), Buffer.from(await res.arrayBuffer()))
    credits[file] = credit
  }
  found.push(car.model)
  await new Promise(r => setTimeout(r, 250))           // be polite to Commons
}

if (!dry && found.length) {
  fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n')
}

console.log(`\n${found.length} found, ${empty.length} without a usable photo${dry ? ' (dry run — nothing saved)' : ''}`)
if (empty.length) console.log(`Still needed: ${empty.join(', ')}`)
