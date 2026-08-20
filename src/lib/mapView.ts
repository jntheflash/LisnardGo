/** Mémorisation durable de la dernière position de carte consultée (localStorage). */

export interface SavedView {
  center: [number, number]
  zoom: number
}

const KEY = 'lisnardgo.mapView'

export function readSavedView(): SavedView | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    const lat = v?.center?.[0]
    const lng = v?.center?.[1]
    const zoom = v?.zoom
    const ok = [lat, lng, zoom].every((n) => typeof n === 'number' && isFinite(n))
    return ok ? { center: [lat, lng], zoom } : null
  } catch {
    return null
  }
}

export function saveView(center: [number, number], zoom: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ center, zoom }))
  } catch {
    /* quota / mode privé : on ignore */
  }
}
