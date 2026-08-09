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

const tokens = s => norm(s).split('-').filter(Boolean)
const digitRuns = s => String(s).match(/\d+/g) || []

// Model numbers carry the whole meaning in car naming — an F40 is not an F50,
// a 250 GTO is not a 275. Any number in the car's name must appear in the
// filename, which stops "close enough" from crossing between models.
function digitsAgree(candidate, fileName) {
  const have = digitRuns(fileName)
  return digitRuns(candidate).every(d => have.includes(d))
}

function bigrams(s) {
  const t = s.replace(/-/g, '')
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

// Balances "the car's whole name appears in the filename" against "the
// filename is mostly about this car", so a longer, more specific car name
// beats a short one that merely happens to be included.
function tokenF1(fileText, slug) {
  const F = new Set(tokens(fileText)), S = new Set(tokens(slug))
  if (!F.size || !S.size) return 0
  const shared = [...S].filter(t => F.has(t)).length
  if (!shared) return 0
  const precision = shared / S.size   // how much of the car name is present
  const recall = shared / F.size      // how much of the filename it explains
  return (2 * precision * recall) / (precision + recall)
}

// Word overlap alone misreads "zonda-revolucion" as the Zonda R, and spelling
// similarity alone misreads model numbers; together they agree far more often.
const score = (a, b) => 0.5 * dice(a, b) + 0.5 * tokenF1(a, b)

const ACCEPT = 0.45   // minimum similarity for a fuzzy match
const MARGIN = 0.08   // how far ahead of the runner-up the winner must be

// Returns { slug, order, how } or null. `order` positions multiple photos of
// the same car (a trailing "-2" means the second photo).
export function matchPhotoToCar(base, brandId, slugs) {
  const all = [...slugs]
  const n = norm(base)

  // Candidate readings of the filename: as-is, without a trailing index, and
  // with a repeated brand name ("koenigsegg-…") removed.
  const readings = []
  const addReading = (text, order) => {
    if (!text || readings.some(r => r[0] === text && r[1] === order)) return
    readings.push([text, order])
    const m = /^(.*)-(\d+)$/.exec(text)
    if (m) readings.push([m[1], Number(m[2])])
    if (text.startsWith(`${brandId}-`)) addReading(text.slice(brandId.length + 1), order)
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
      ranked.push({ slug, order, value: score(text, slug) })
    }
  }
  ranked.sort((a, b) => b.value - a.value)
  const best = ranked[0]
  const runnerUp = ranked.find(r => r.slug !== best?.slug)?.value ?? 0
  if (best && best.value >= ACCEPT && best.value - runnerUp >= MARGIN) {
    return { slug: best.slug, order: best.order, how: `matched ${best.value.toFixed(2)}` }
  }
  return {
    unmatched: true,
    suggestion: best?.slug ?? null,
    // Flag the near-tie case, which usually means the filename is genuinely
    // short of detail rather than simply unrecognised.
    ambiguous: Boolean(best && best.value >= ACCEPT),
  }
}
