import { useState } from 'react'
import {
  BLOC_COLORS,
  BLOC_LABELS,
  DROITE_BLOCS,
  ORDRE_BLOCS,
  SCRUTINS,
  type Scrutin,
} from '../data/blocsElectoraux'

interface Props {
  on: boolean
  setOn: (v: boolean) => void
  scrutin: Scrutin
  setScrutin: (s: Scrutin) => void
  droitesOnly: boolean
  setDroitesOnly: (v: boolean) => void
}

/** Bouton « Calques » + panneau : active le calque électoral, choisit le scrutin, légende. */
export default function ElectoralControl({
  on,
  setOn,
  scrutin,
  setScrutin,
  droitesOnly,
  setDroitesOnly,
}: Props) {
  const [open, setOpen] = useState(false)
  const blocsLegende = droitesOnly ? DROITE_BLOCS : ORDRE_BLOCS

  return (
    <div className="pointer-events-auto absolute bottom-[4.5rem] right-3 z-[1000] flex flex-col-reverse items-end gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Calque électoral"
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg active:scale-95 ${
          on ? 'bg-brand text-white' : 'bg-white text-slate-700'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 12 10 5 10-5" />
          <path d="m2 17 10 5 10-5" />
        </svg>
      </button>

      {open && (
        <div className="max-h-[60vh] w-64 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
          {/* Activation */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Calque électoral</span>
            <button
              onClick={() => setOn(!on)}
              role="switch"
              aria-checked={on}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                on ? 'bg-brand' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  on ? 'left-[1.375rem]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Bloc arrivé en tête par bureau de vote (Loire-Atlantique).
          </p>

          {on && (
            <>
              {/* Sélecteur de scrutin */}
              <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
                {SCRUTINS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setScrutin(s.key)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      scrutin === s.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Interrupteur « Droites uniquement » */}
              <button
                onClick={() => setDroitesOnly(!droitesOnly)}
                className="mt-3 flex w-full items-center justify-between"
              >
                <span className="text-sm text-slate-700">Droites uniquement</span>
                <span
                  role="switch"
                  aria-checked={droitesOnly}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    droitesOnly ? 'bg-brand' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      droitesOnly ? 'left-[1.375rem]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>

              {/* Légende (3 blocs de droite si « Droites uniquement », sinon 4) */}
              <div className="mt-3 space-y-1.5">
                {blocsLegende.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3.5 w-3.5 rounded"
                      style={{ background: BLOC_COLORS[b] }}
                    />
                    <span className="text-slate-700">{BLOC_LABELS[b]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                {droitesOnly
                  ? 'Bloc le plus fort parmi les droites ; intensité = sa part au sein des droites (les bureaux sans résultat sont en gris).'
                  : 'Plus la couleur est intense, plus le bloc en tête est haut (les bureaux sans résultat sont en gris).'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
