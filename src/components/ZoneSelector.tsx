import { useMap } from 'react-leaflet'
import { ZONES } from '../data/zones'

/** Petit sélecteur de zone : recentre la carte sur une zone prédéfinie d'un tap. */
export default function ZoneSelector() {
  const map = useMap()
  return (
    <div className="absolute bottom-4 left-3 z-[1000] flex overflow-hidden rounded-full bg-white/95 shadow-lg backdrop-blur">
      {ZONES.map((z, i) => (
        <button
          key={z.key}
          onClick={() => map.setView(z.center, z.zoom)}
          className={`px-3 py-2 text-xs font-semibold text-slate-700 active:bg-slate-100 ${
            i > 0 ? 'border-l border-slate-200' : ''
          }`}
        >
          {z.label}
        </button>
      ))}
    </div>
  )
}
