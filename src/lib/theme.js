// Applies a brand theme (from brands.json) as CSS variables on <html>.
// Passing null restores the neutral home-page theme.
const VARS = ['--carbon', '--carbon2', '--panel', '--accent', '--ivory', '--display', '--body', '--mono']

export function applyTheme(theme) {
  const root = document.documentElement
  VARS.forEach(v => root.style.removeProperty(v))
  document.body.className = 'tx-carbon-weave' // neutral default keeps the weave
  if (!theme) return
  if (theme.background) root.style.setProperty('--carbon', theme.background)
  if (theme.panel) root.style.setProperty('--carbon2', theme.panel)
  if (theme.accent) root.style.setProperty('--accent', theme.accent)
  if (theme.ivory) root.style.setProperty('--ivory', theme.ivory)
  if (theme.displayFont) root.style.setProperty('--display', theme.displayFont)
  if (theme.bodyFont) root.style.setProperty('--body', theme.bodyFont)
  if (theme.monoFont) root.style.setProperty('--mono', theme.monoFont)
  if (theme.texture) document.body.className = `tx-${theme.texture}`
}

export function familyAccent(brand, family) {
  return brand?.theme?.familyAccents?.[family] || brand?.theme?.accent || null
}
