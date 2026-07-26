// Generates a small WebP cover for every photo in public/images/, so you can
// upload full-size files and never think about it:
//
//   public/thumbs/<path>.webp   560px  — every card grid (brand pages, home,
//                                        and the gallery strip on a car page)
//
// Card grids show dozens of photos at once, so they get the light version.
// A car's own page serves the untouched original from public/images/ — one
// photo, one car, full quality. public/thumbs/ is generated and gitignored;
// public/images/ is never modified.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const IMG_DIR = path.join(ROOT, 'public', 'images')
const IMG_EXT = /\.(jpe?g|png|webp|avif)$/i

export const SIZES = { thumbs: 560 }
export const derivedPath = rel => rel.replace(/\.[^.]+$/, '.webp')

function walk(dir, base = '') {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) return walk(path.join(dir, e.name), rel)
    return IMG_EXT.test(e.name) ? [rel] : []
  })
}

// Rebuilds a derivative only when it's missing or older than its source, so
// repeat runs during development cost almost nothing.
async function derive(rel, kind) {
  const src = path.join(IMG_DIR, rel)
  const out = path.join(ROOT, 'public', kind, derivedPath(rel))
  const srcTime = fs.statSync(src).mtimeMs
  // Compare in whole seconds: utimes below loses sub-second precision on some
  // filesystems, and an exact comparison would rebuild everything every run.
  if (fs.existsSync(out) && Math.floor(fs.statSync(out).mtimeMs / 1000) >= Math.floor(srcTime / 1000)) return false
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await sharp(src)
    .rotate()                                            // honor EXIF orientation
    .resize({ width: SIZES[kind], withoutEnlargement: true })
    .webp({ quality: 74 })
    .toFile(out)
  fs.utimesSync(out, new Date(), new Date(srcTime))       // stamp for the check above
  return true
}

export async function buildImages() {
  const files = walk(IMG_DIR)
  let built = 0
  for (const rel of files) {
    for (const kind of Object.keys(SIZES)) {
      if (await derive(rel, kind)) built++
    }
  }
  if (built) console.log(`images: ${built} derivatives generated from ${files.length} photos`)
  else console.log(`images: ${files.length} photos, all derivatives up to date`)
  return files
}

if (import.meta.filename === process.argv[1]) await buildImages()
