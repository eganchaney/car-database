import { useSyncExternalStore } from 'react'

// Per-visitor marks kept in localStorage: the cars you've favourited, and the
// ones you've seen in person. Both are arrays of car ids ("pagani/huayra").
function createMarkStore(key) {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
  }
  let cache = read()
  const listeners = new Set()

  const write = ids => {
    cache = ids
    try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* full or blocked */ }
    listeners.forEach(fn => fn())
  }
  const subscribe = fn => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
  return {
    toggle: id => write(cache.includes(id) ? cache.filter(x => x !== id) : [...cache, id]),
    read: () => useSyncExternalStore(subscribe, () => cache),
  }
}

const favorites = createMarkStore('car-db-favorites')
const spotted = createMarkStore('car-db-spotted')

export const toggleFavorite = favorites.toggle
export const useFavorites = favorites.read
export const toggleSpotted = spotted.toggle
export const useSpotted = spotted.read
