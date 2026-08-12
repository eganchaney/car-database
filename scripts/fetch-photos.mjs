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
import crypto from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'public', 'data')
const IMG = path.join(ROOT, 'public', 'images')
const API = 'https://commons.wikimedia.org/w/api.php'
// Car pages show the hero at 920px, so 1600 is still sharp on a retina
// screen. It also keeps ~500 photos to a few hundred MB rather than a GB.
const WIDTH = 1600
const UA = 'CarDatabase/1.0 (personal project; https://github.com/eganchaney/car-database)'

// Pictures of a detail, a badge or a museum placard are no use as a hero shot.
const JUNK = /logo|badge|emblem|engine|interior|dashboard|steering|seat|wheel\b|tyre|tire|gearbox|brake|headlight|taillight|tail light|rear light|plaque|sign|diagram|drawing|blueprint|patent|map|graph|chart|assembly line|factory|grave|stamp|coin|model car|scale model|toy|lego|die-?cast/i

const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i
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

// Commons files a car's photographs under its own category, which is both a
// far deeper pool than search (often 100 files rather than 20) and a much
// stronger guarantee that the car is the right one — membership is curated,
// where a filename is just a string.
async function categoryFiles(name) {
  const data = await api({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: `Category:${name}`,
    gcmtype: 'file',
    gcmlimit: '100',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(WIDTH),
  })
  return Object.values(data.query?.pages || {})
}

// The obvious category name is often right ("Ferrari F50") but not always
// ("Ferrari Enzo" is empty — the category is "Ferrari Enzo Ferrari"), so fall
// back to searching the category namespace.
async function findCategory(brandName, model) {
  const direct = `${brandName} ${model}`
  const hit = await categoryFiles(direct)
  if (hit.length) return { name: direct, files: hit }

  const data = await api({
    action: 'query', list: 'search', srnamespace: '14',
    srsearch: `${brandName} ${model}`, srlimit: '5',
  })
  const wanted = words(`${brandName} ${model}`)
  for (const result of data.query?.search || []) {
    const name = result.title.replace(/^Category:/, '')
    // Vehicle categories on Commons are brand-first ("Ferrari Enzo Ferrari").
    // Insisting on that prefix is what separates the car from the man:
    // "Enzo Ferrari" is Il Commendatore, and his photographs are not the car's.
    if (!norm(name).startsWith(norm(brandName))) continue
    const have = new Set(words(name))
    // Require every *named* part of the model, but treat bare numbers as
    // optional: Commons files the Veyron 16.4 under "Bugatti Veyron", and the
    // Type 41 Royale under "Bugatti Royale". Insisting on the digits loses
    // those categories; dropping the words would let "Ferrari 250" stand in
    // for the 250 GTO.
    const named = wanted.filter(w => /[a-z]/.test(w))
    if (!named.every(w => have.has(w))) continue
    const files = await categoryFiles(name)
    if (files.length) return { name, files }
  }
  return null
}

// A category is already known to be this car, so only the picture's usefulness
// as a gallery shot is judged here — except that a category still contains the
// odd group photo ("Ferrari F40, F50, and Enzo"), which belongs to no one car.
function rankCategory(pages, model, others = new Set(), carYear = null) {
  const want = words(model)
  const out = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    if (!/^image\/(jpeg|png|webp)$/.test(info.mime || '')) continue
    if (info.width < 900 || info.height < 500) continue
    const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
    if (JUNK.test(title)) continue
    if (predatesCar(title, carYear)) continue
    const have = new Set(words(title))
    const intruders = [...have].filter(w => others.has(w) && !want.includes(w)).length
    if (intruders >= 1) continue
    let score = 1
    if (info.width > info.height) score += 0.4
    score += Math.min(info.width / 6000, 0.3)
    out.push({ page, info, title, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

const digits = s => String(s).match(/\d+/g) || []

// A picture cannot predate the car it shows. Commons titles carry the year of
// the event, so "Enzo Ferrari, XI Targa Florio, 1920" is disqualified as a
// photo of a 2002 Ferrari Enzo — it is the man, not the machine. Two years of
// slack covers prototypes and press cars shown before launch.
function predatesCar(title, carYear) {
  if (!carYear) return false
  const years = (String(title).match(/\b(1[89]\d\d|20[0-4]\d)\b/g) || []).map(Number)
  return years.some(y => y < carYear - 2)
}

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
  return scored.filter(s => s.score > 0)
}

function creditFor(info) {
  const meta = info.extmetadata || {}
  const who = strip(meta.Artist?.value) || strip(meta.Credit?.value) || 'Unknown photographer'
  const licence = strip(meta.LicenseShortName?.value) || 'see Wikimedia Commons'
  return `Photo: ${who}, ${licence}, via Wikimedia Commons`
}

const brandId = process.argv[2]
const dry = process.argv.includes('--dry')
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}
const limit = Number(flag('--limit', Infinity))
const total = Number(flag('--total', 1))          // photos wanted per car
const only = flag('--slugs', '')                  // restrict to these cars

if (!brandId) {
  console.error('Usage: node scripts/fetch-photos.mjs <brand-id> [--dry] [--limit N] [--total N] [--slugs a,b,c]')
  process.exit(1)
}

const brands = JSON.parse(fs.readFileSync(path.join(DATA, 'brands.json'), 'utf8')).brands
const brand = brands.find(b => b.id === brandId)
if (!brand) { console.error(`No brand "${brandId}" in brands.json`); process.exit(1) }

const { cars } = JSON.parse(fs.readFileSync(path.join(DATA, `${brandId}.json`), 'utf8'))
const wanted = only ? new Set(only.split(',').map(s => s.trim())) : null
const todo = cars
  .filter(c => (wanted ? wanted.has(c.id.split('/')[1]) : !c.images.length))
  .slice(0, limit)

const brandDir = path.join(IMG, brandId)
fs.mkdirSync(brandDir, { recursive: true })
const creditsPath = path.join(brandDir, 'credits.json')
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {}

// Distinctive words belonging to other cars of this brand, used to spot a
// line-up shot. Words this car shares are excluded per-car inside pick().
const vocabulary = new Set(cars.flatMap(c => words(c.model)).filter(w => w.length > 2))

const digest = buf => crypto.createHash('md5').update(buf).digest('hex')

console.log(`${brand.name}: ${todo.length} cars, target ${total} photo(s) each\n`)

let added = 0
const short = []
for (const car of todo) {
  const slug = car.id.split('/')[1]
  // What this car already has comes from the built data, which is the same
  // matching the site uses — it covers both layouts and names the build
  // resolved loosely ("veyron-16.4.webp" belongs to veyron-16-4). Re-deriving
  // it from filenames here would disagree with the site.
  const existing = (car.images || [])
    .map(img => path.join(brandDir, img.file))
    .filter(p => fs.existsSync(p))
  const seen = new Set(existing.map(p => digest(fs.readFileSync(p))))
  let have = existing.length
  if (have >= total) continue

  // Naming still needs the next free slot, and only "<slug>.jpg" /
  // "<slug>-2.jpg" are this car's own: "countach-lp400-s.jpg" is the LP400 S,
  // a different car, not the LP400's second photo.
  const own = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?$`)
  let slots = fs.readdirSync(brandDir)
    .filter(f => IMG_EXT.test(f) && own.test(f.replace(IMG_EXT, ''))).length

  const plain = car.model.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const inner = /\(([^)]*)\)/.exec(car.model)?.[1] || ''
  const queries = [...new Set([
    `${brand.name} ${car.model}`,
    `${brand.name} ${plain} ${inner}`.trim(),
    `${brand.name} ${plain}`,
    `${brand.name} ${plain.split('/')[0]}`,
  ])]

  const ranked = []
  const titles = new Set()
  const push = list => {
    for (const r of list) {
      if (titles.has(r.title)) continue
      titles.add(r.title)
      ranked.push(r)
    }
  }

  // The car's own Commons category first — deeper and safer than search.
  try {
    const category = await findCategory(brand.name, plain)
    if (category) push(rankCategory(category.files, car.model, vocabulary, car.year))
  } catch (e) { console.warn(`  ! ${car.model} category: ${e.message}`) }

  for (const q of queries) {
    if (ranked.length >= total * 3) break
    try {
      push(pick(await search(q), brand.name, car.model, vocabulary).filter(r => !predatesCar(r.title, car.year)))
    } catch (e) { console.warn(`  ! ${car.model}: ${e.message}`) }
    await new Promise(r => setTimeout(r, 150))
  }
  if (!ranked.length) { short.push(car.model); console.log(`  —  ${car.model}: nothing suitable`); continue }

  const before = have
  for (const candidate of ranked) {
    if (have >= total) break
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[candidate.info.mime]
    const file = slots === 0 ? `${slug}.${ext}` : `${slug}-${slots + 1}.${ext}`
    if (fs.existsSync(path.join(brandDir, file))) { have++; slots++; continue }
    const credit = creditFor(candidate.info)
    if (dry) {
      console.log(`  ✓  ${car.model} → ${file}\n       ${candidate.title} (${candidate.info.width}×${candidate.info.height})`)
      have++; slots++; added++
      continue
    }
    const res = await fetch(candidate.info.thumburl || candidate.info.url, { headers: { 'User-Agent': UA } })
    if (!res.ok) { console.warn(`       download failed: ${res.status}`); continue }
    const bytes = Buffer.from(await res.arrayBuffer())
    const hash = digest(bytes)
    if (seen.has(hash)) continue                    // same picture under another name
    seen.add(hash)
    fs.writeFileSync(path.join(brandDir, file), bytes)
    credits[file] = credit
    console.log(`  ✓  ${car.model} → ${file}  (${candidate.info.width}×${candidate.info.height})`)
    have++; slots++; added++
    await new Promise(r => setTimeout(r, 250))      // be polite to Commons
  }
  if (have === before) short.push(car.model)
}

if (!dry && added) fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n')
console.log(`\n${added} photo(s) added${dry ? ' (dry run — nothing saved)' : ''}`)
if (short.length) console.log(`No more found for: ${short.join(', ')}`)
