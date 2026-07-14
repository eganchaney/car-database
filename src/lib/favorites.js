import { useSyncExternalStore } from 'react'

// Favorites = array of car ids ("pagani/zonda-f") in localStorage.
const KEY = 'car-db-favorites'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

let cache = read()
const listeners = new Set()

function write(ids) {
  cache = ids
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* storage full/blocked */ }
  listeners.forEach(fn => fn())
}

export function toggleFavorite(id) {
  write(cache.includes(id) ? cache.filter(x => x !== id) : [...cache, id])
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useFavorites() {
  return useSyncExternalStore(subscribe, () => cache)
}
