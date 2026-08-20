import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PanneauAvecEtat } from '../types'
import { saveView } from '../lib/mapView'

/**
 * Centrage initial en CASCADE + persistance de la dernière position.
 *  1. dernière position consultée (gérée en amont : passée comme vue initiale du
 *     MapContainer → ici on ne refait rien si `hasSavedView`) ;
 *  2. sinon, panneaux du département du profil (fitBounds) ;
 *  3. sinon, ensemble des panneaux (fitBounds global).
 */
export default function MapAutoView({
  panneaux,
  departement,
  hasSavedView,
}: {
  panneaux: PanneauAvecEtat[]
  departement: string | null
  hasSavedView: boolean
}) {
  const map = useMap()
  const applied = useRef(false)

  // Persiste centre + zoom à la fin de chaque déplacement/zoom (debounce 400 ms).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onChange = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const c = map.getCenter()
        saveView([c.lat, c.lng], map.getZoom())
      }, 400)
    }
    map.on('moveend', onChange)
    map.on('zoomend', onChange)
    return () => {
      clearTimeout(t)
      map.off('moveend', onChange)
      map.off('zoomend', onChange)
    }
  }, [map])

  // Cascade initiale (une seule fois), uniquement sans vue mémorisée.
  useEffect(() => {
    if (applied.current || hasSavedView) {
      applied.current = true
      return
    }
    if (panneaux.length === 0) return // on attend le chargement des panneaux

    applied.current = true
    let cible = panneaux
    if (departement) {
      const duDept = panneaux.filter((p) => p.departement === departement)
      if (duDept.length > 0) cible = duDept // 2. département du profil
    }
    // 3. sinon : tous les panneaux
    const bounds = L.latLngBounds(
      cible.map((p) => [p.lat, p.lng] as [number, number]),
    )
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [map, panneaux, departement, hasSavedView])

  return null
}
