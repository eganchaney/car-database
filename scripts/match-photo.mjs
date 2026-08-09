// Works out which car a loose photo file belongs to, so you can drop images
// into a brand folder under whatever name they were downloaded with.
//
//   Koenigsegg-CCR-1.webp             → ccr
//   koenigsegg_ccxr_special_ed.avif   → ccxr-special-edition
//   koenigsegg_one_to_1.webp          → one-1        ("One:1")
//   2018 Ferrari 250 GTO (red).jpg    → 250-gto
//
// Matching runs in tiers, strongest first, and a match is only accepted when
// exactly one car is a clear winner — an ambiguous name is reported rather
// than guessed, because a photo on the wrong car is worse than a missing one.

export const norm = s => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')  // fold accents: Murcielago
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8' }

// Splits a name into comparable words. Letter/digit boundaries are split so
// "675LT" lines up with "675-lt", and roman numerals become digits so
// "gt40-mk1" lines up with "GT40 Mk I".
const tokens = s => norm(s)
  .replace(/(^|-)(mk|mark)([ivx]+)(?=-|$)/g, '$1$2-$3')   // mkII → mk ii
  .replace(/([a-z])(\d)/g, '$1-$2')
  .replace(/(\d)([a-z])/g, '$1-$2')
  .split('-')
  .filter(Boolean)
  .map(t => ROMAN[t] ?? t)

const compact = s => norm(s).replace(/-/g, '')
const digitRuns = s => String(s).match(/\d+/g) || []

// Model numbers carry the whole meaning in car naming — an F40 is not an F50,
// a 250 GTO is not a 275. Any number in the car's name must appear in the
// filename, which stops "close enough" from crossing between models.
function digitsAgree(candidate, fileName) {
  const have = digitRuns(fileName)
  return digitRuns(candidate).every(d => have.includes(d))
}

function bigrams(s) {
  const t = compact(s)
  const out = new Map()
  for (let i = 0; i < t.length - 1; i++) {
    const k = t.slice(i, i + 2)
    out.set(k, (out.get(k) || 0) + 1)
  }
  return out
}

// Sørensen–Dice coefficient over character bigrams: forgiving of typos,
// truncation, and small spelling differences.
function dice(a, b) {
  const A = bigrams(a), B = bigrams(b)
  let shared = 0, total = 0
  for (const [, n] of A) total += n
  for (const [, n] of B) total += n
  for (const [k, n] of A) shared += Math.min(n, B.get(k) || 0)
  return total ? (2 * shared) / total : 0
}

// Weighted towards recall: a car name that explains every word of the
// filename beats one that leaves a word unaccounted for. That is what picks
// "huayra-r-evo-roadster" over "huayra-roadster" for "huayra_evo_roadster" —
// the latter has no answer for "evo".
function tokenScore(fileText, slug) {
  const F = new Set(tokens(fileText)), S = new Set(tokens(slug))
  if (!F.size || !S.size) return 0
  const shared = [...S].filter(t => F.has(t)).length
  if (!shared) return 0
  const precision = shared / S.size   // how much of the car name is present
  const recall = shared / F.size      // how much of the filename it explains
  return (5 * precision * recall) / (4 * precision + recall)
}

// Word overlap alone misreads "zonda-revolucion" as the Zonda R, and spelling
// similarity alone misreads model numbers; together they agree far more often.
// A name that the car's name begins with ("gt" → "gt-gts") gets a nudge, which
// settles ties against cars that merely contain the word ("570gt").
function score(fileText, slug) {
  const prefix = compact(slug).startsWith(compact(fileText)) ? 0.05 : 0
  return 0.5 * dice(fileText, slug) + 0.5 * tokenScore(fileText, slug) + prefix
}

const ACCEPT = 0.45     // minimum combined similarity for a match
const MARGIN = 0.08     // how far ahead of the runner-up the winner must be
const SPELLING = 0.80   // near-identical spelling is conclusive by itself

// Returns { slug, order, how } or null. `order` positions multiple photos of
// the same car (a trailing "-2" means the second photo).
export function matchPhotoToCar(base, brandId, slugs) {
  const all = [...slugs]
  const n = norm(base)

  // Candidate readings of the filename: as-is, without a trailing index, and
  // with the brand name dropped — it carries no signal and appears anywhere
  // in the name ("2005-ford-gt", "koenigsegg_regera").
  const brandWords = new Set(brandId.split('-'))
  const readings = []
  const addReading = (text, order) => {
    if (!text || readings.some(r => r[0] === text && r[1] === order)) return
    readings.push([text, order])
    const m = /^(.*)-(\d+)$/.exec(text)
    if (m) readings.push([m[1], Number(m[2])])
    const withoutBrand = text.split('-').filter(w => !brandWords.has(w)).join('-')
    if (withoutBrand !== text) addReading(withoutBrand, order)
  }
  addReading(n, 1)

  // Tier 1 — an exact slug. Tried first so "agera-rs1.jpg" stays its own car
  // instead of being read as photo 1 of "agera-rs".
  for (const [text, order] of readings) {
    if (all.includes(text)) return { slug: text, order, how: 'exact' }
  }

  // Tier 2 — score every car and take a clear winner. Deliberately not
  // substring matching: "zonda-r" is a prefix of "zonda-revolucion" but a
  // completely different car, and only scoring catches that.
  const ranked = []
  for (const [text, order] of readings) {
    for (const slug of all) {
      if (!digitsAgree(slug, text)) continue
      ranked.push({ slug, order, value: score(text, slug), spelling: dice(text, slug) })
    }
  }
  ranked.sort((a, b) => b.value - a.value)
  const best = ranked[0]
  const runnerUp = ranked.find(r => r.slug !== best?.slug)?.value ?? 0
  if (best && best.value >= ACCEPT && best.value - runnerUp >= MARGIN) {
    return { slug: best.slug, order: best.order, how: `matched ${best.value.toFixed(2)}` }
  }
  // A near-identical spelling is conclusive on its own — it catches simple
  // misspellings ("tourbillion" → Tourbillon) that share no whole word.
  const bySpelling = [...ranked].sort((a, b) => b.spelling - a.spelling)
  const top = bySpelling[0]
  const next = bySpelling.find(r => r.slug !== top?.slug)?.spelling ?? 0
  if (top && top.spelling >= SPELLING && top.spelling - next >= MARGIN) {
    return { slug: top.slug, order: top.order, how: `spelling ${top.spelling.toFixed(2)}` }
  }
  return {
    unmatched: true,
    suggestion: best?.slug ?? null,
    // Flag the near-tie case, which usually means the filename is genuinely
    // short of detail rather than simply unrecognised.
    ambiguous: Boolean(best && best.value >= ACCEPT),
  }
}
