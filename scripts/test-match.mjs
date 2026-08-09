// Regression tests for photo-filename matching: node scripts/test-match.mjs
// Runs against the real car lists, so it also catches a spreadsheet change
// that makes two model names too similar to tell apart.
import fs from 'node:fs'
import path from 'node:path'
import { matchPhotoToCar } from './match-photo.mjs'

const DATA = path.join(path.resolve(import.meta.dirname, '..'), 'public', 'data')
const slugsFor = brand =>
  JSON.parse(fs.readFileSync(path.join(DATA, `${brand}.json`), 'utf8'))
    .cars.map(c => c.id.split('/')[1])

// [brand, filename without extension, expected slug — or null to require that
//  it is reported rather than guessed]
const CASES = [
  // names as photos actually arrive from the web
  ['koenigsegg', 'Koenigsegg-CCR-1', 'ccr'],
  ['koenigsegg', 'koenigsegg_one_to_1-1', 'one-1'],          // "One:1"
  ['koenigsegg', 'Koenigsegg-Trevita-1', 'ccxr-trevita'],
  ['koenigsegg', "sadair's_spear-1", 'sadair-s-spear'],
  ['koenigsegg', 'koenigsegg_regera-2', 'regera'],
  ['ferrari', '1962-ferrari-250-gto-red', '250-gto'],
  ['ferrari', 'Ferrari_Purosangue_2023', 'purosangue'],
  ['ferrari', 'ferrari-296-gtb', '296-gtb-gts'],
  ['pagani', 'pagani-zonda-f-roadster', 'zonda-roadster-f'],
  ['pagani', 'Huayra BC', 'huayra-bc'],
  ['bugatti', 'Bugatti_Chiron_Super_Sport_300', 'chiron-super-sport-300'],
  ['lamborghini', 'Murcielago LP670-4 SV', 'murci-lago-lp670-4-superveloce'],

  // accents: the slug keeps them, the filename usually doesn't
  ['pagani', 'pagani_zonda_revolucion', 'zonda-revoluci-n'],

  // must not drift between models that differ only by a number or suffix
  ['koenigsegg', 'agera-rs1', 'agera-rs1'],       // not photo 1 of agera-rs
  ['koenigsegg', 'agera-rs-2', 'agera-rs'],       // second photo of agera-rs
  ['ferrari', 'ferrari-f40', 'f40'],
  ['ferrari', 'Ferrari F50 (1995)', 'f50'],
  ['ferrari', 'ferrari_250_lm', '250-lm'],

  // too vague or unrelated — reported, never guessed
  ['koenigsegg', 'koenigsegg-ccxr-edition-1', null],  // CCXR Special vs CCX/CCXR Edition
  ['koenigsegg', 'IMG_20240513_183045', null],
  ['koenigsegg', 'screenshot', null],
]

let failed = 0
for (const [brand, file, expected] of CASES) {
  const r = matchPhotoToCar(file, brand, slugsFor(brand))
  const got = r.unmatched ? null : r.slug
  if (got === expected) {
    console.log(`  ok    ${brand}/${file} → ${got ?? 'reported, not guessed'}`)
  } else {
    failed++
    console.log(`  FAIL  ${brand}/${file} → ${got ?? 'unmatched'}  (expected ${expected ?? 'no match'})`)
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${CASES.length} passed`)
process.exit(failed ? 1 : 0)
