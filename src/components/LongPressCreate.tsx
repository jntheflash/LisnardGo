import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const DELAY_MS = 800 // 0,8 s
const MOVE_TOLERANCE = 10 // px : au-delà, c'est un déplacement (pan), pas un appui

/**
 * Détecte un appui long (0,8 s) IMMOBILE sur la carte et renvoie les coordonnées.
 * Géré par événements tactiles (mobile/iOS) ET souris (ordinateur).
 * Annulé si le doigt/curseur bouge (pan), si on relâche tôt (tap), ou si la
 * carte commence à se déplacer/zoomer. Ne bloque jamais le pan/zoom.
 */
export default function LongPressCreate({
  onLongPress,
}: {
  onLongPress: (lat: number, lng: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    const el = map.getContainer()
    let timer: ReturnType<typeof setTimeout> | null = null
    let startX = 0
    let startY = 0

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    // Démarre le minuteur à une position donnée (sauf si on appuie sur un marqueur).
    const start = (x: number, y: number, target: EventTarget | null) => {
      if (
        target instanceof HTMLElement &&
        target.closest('.leaflet-marker-icon, .cluster-wrapper')
      )
        return
      startX = x
      startY = y
      clear()
      timer = setTimeout(() => {
        timer = null
        // Neutralise le clic de relâchement (souris) / le clic fantôme iOS qui
        // suit la fin de l'appui long, pour qu'il ne ferme pas la popup qu'on
        // vient d'ouvrir (dismiss au clic extérieur).
        const swallow = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
          document.removeEventListener('click', swallow, true)
        }
        document.addEventListener('click', swallow, true)
        setTimeout(() => document.removeEventListener('click', swallow, true), 700)

        const rect = el.getBoundingClientRect()
        const pt = L.point(startX - rect.left, startY - rect.top)
        const { lat, lng } = map.containerPointToLatLng(pt)
        onLongPress(lat, lng)
      }, DELAY_MS)
    }

    const moved = (x: number, y: number) =>
      Math.abs(x - startX) > MOVE_TOLERANCE ||
      Math.abs(y - startY) > MOVE_TOLERANCE

    // --- Tactile (mobile / iOS) ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return clear() // multi-touch = pinch/zoom
      const t = e.touches[0]
      start(t.clientX, t.clientY, e.target)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!timer) return
      const t = e.touches[0]
      if (t && moved(t.clientX, t.clientY)) clear()
    }

    // --- Souris (ordinateur) ---
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      start(e.clientX, e.clientY, e.target)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (timer && moved(e.clientX, e.clientY)) clear()
    }

    // Empêche le menu contextuel natif (clic droit / appui long mobile).
    const onContext = (e: Event) => e.preventDefault()

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', clear)
    el.addEventListener('touchcancel', clear)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseup', clear)
    el.addEventListener('mouseleave', clear)
    el.addEventListener('contextmenu', onContext)
    // Annule aussi dès que la carte bouge ou zoome (pan/zoom).
    map.on('movestart', clear)
    map.on('zoomstart', clear)

    return () => {
      clear()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', clear)
      el.removeEventListener('touchcancel', clear)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup', clear)
      el.removeEventListener('mouseleave', clear)
      el.removeEventListener('contextmenu', onContext)
      map.off('movestart', clear)
      map.off('zoomstart', clear)
    }
  }, [map, onLongPress])

  return null
}
