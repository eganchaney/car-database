// One-time migration: decode pagani-photos-backup.json (base64 data URLs +
// credits, keyed by car slug) into public/images/pagani/<slug>/N.jpg files
// with a credits.json per folder, and fill the `images` arrays in
// public/data/pagani.json.
//
// Usage: node scripts/migrate-photos.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const BACKUP = path.join(ROOT, 'pagani-photos-backup.json')
const DATA_SRC = path.join(ROOT, 'pagani.json')
const DATA_OUT = path.join(ROOT, 'public', 'data', 'pagani.json')
const IMG_ROOT = path.join(ROOT, 'public', 'images', 'pagani')

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'))
const data = JSON.parse(fs.readFileSync(DATA_SRC, 'utf8'))

let files = 0
const imagesBySlug = {}

for (const [slug, photos] of Object.entries(backup.photos)) {
  const dir = path.join(IMG_ROOT, slug)
  fs.mkdirSync(dir, { recursive: true })
  const credits = {}
  const names = []
  photos.forEach((p, i) => {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(p.src)
    if (!m) { console.warn(`skip ${slug}[${i}]: not a data URL`); return }
    const ext = EXT[m[1]] || 'jpg'
    const name = `${i + 1}.${ext}`
    fs.writeFileSync(path.join(dir, name), Buffer.from(m[2], 'base64'))
    names.push(name)
    if (p.credit) credits[name] = p.credit
    files++
  })
  fs.writeFileSync(path.join(dir, 'credits.json'), JSON.stringify(credits, null, 2))
  imagesBySlug[slug] = names
}

for (const car of data.cars) {
  const slug = car.id.split('/')[1]
  car.images = imagesBySlug[slug] || []
}

fs.mkdirSync(path.dirname(DATA_OUT), { recursive: true })
fs.writeFileSync(DATA_OUT, JSON.stringify(data, null, 2))
console.log(`Wrote ${files} images for ${Object.keys(imagesBySlug).length} cars`)
console.log(`Updated ${DATA_OUT}`)
