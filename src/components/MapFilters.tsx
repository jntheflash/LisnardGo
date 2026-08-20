import type { PanneauEtat } from '../types'
import { ETATS } from '../config'

export type FiltreEtat = 'tout' | PanneauEtat

interface Props {
  filtre: FiltreEtat
  onFiltre: (f: FiltreEtat) => void
  counts: Record<FiltreEtat, number>
}

const ONGLETS: { key: FiltreEtat; label: string; color?: string }[] = [
  { key: 'tout', label: 'Tout' },
  { key: 'a_faire', label: ETATS.a_faire.label, color: ETATS.a_faire.color },
  { key: 'fait', label: ETATS.fait.label, color: ETATS.fait.color },
  { key: 'perime', label: ETATS.perime.label, color: ETATS.perime.color },
]

export default function MapFilters({ filtre, onFiltre, counts }: Props) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-[1000] p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* Onglets d'état */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white/95 p-1.5 shadow-md backdrop-blur">
        {ONGLETS.map((o) => {
          const active = filtre === o.key
          return (
            <button
              key={o.key}
              onClick={() => onFiltre(o.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                active ? 'bg-brand text-white' : 'text-slate-600'
              }`}
            >
              {o.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: o.color }}
                />
              )}
              {o.label}
              <span
                className={`tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}
              >
                {counts[o.key]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
