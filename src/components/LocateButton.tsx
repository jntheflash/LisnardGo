import { useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

/** Bouton « me localiser » : centre la carte sur la position du navigateur. */
export default function LocateButton() {
  const map = useMap()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  function locate() {
    setError(false)
    setLoading(true)
    map
      .locate({ setView: true, maxZoom: 16, enableHighAccuracy: true })
      .once('locationfound', (e: L.LocationEvent) => {
        setLoading(false)
        L.circleMarker(e.latlng, {
          radius: 8,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          weight: 3,
        })
          .addTo(map)
          .bindPopup('Vous êtes ici')
      })
      .once('locationerror', () => {
        setLoading(false)
        setError(true)
      })
  }

  return (
    <button
      onClick={locate}
      aria-label="Me localiser"
      className="absolute bottom-4 right-3 z-[1000] flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg active:scale-95"
    >
      {loading ? (
        <svg className="h-6 w-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className={`h-6 w-6 ${error ? 'text-perime' : 'text-brand'}`}>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2v3m0 14v3m10-10h-3M5 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}
