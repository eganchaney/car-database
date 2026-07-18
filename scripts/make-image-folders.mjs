// Creates public/images/<brand>/<slug>/ with an empty credits.json for every
// car in the generated data that doesn't have a folder yet — so adding photos
// is always just "drop files into the existing folder". Never touches folders
// or credits.json files that already exist.
//
// Run after adding cars: npm run data && node scripts/make-image-folders.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const IMG_DIR = path.join(ROOT, 'public', 'images')

const { brands } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'brands.json'), 'utf8'))
let made = 0

for (const brand of brands) {
  const dataPath = path.join(DATA_DIR, `${brand.id}.json`)
  if (!fs.existsSync(dataPath)) continue
  const { cars } = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  for (const car of cars) {
    const dir = path.join(IMG_DIR, ...car.id.split('/'))
    const credits = path.join(dir, 'credits.json')
    fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(credits)) {
      fs.writeFileSync(credits, '{}\n')
      made++
    }
  }
}
console.log(`${made} new image folders created (existing ones untouched)`)
