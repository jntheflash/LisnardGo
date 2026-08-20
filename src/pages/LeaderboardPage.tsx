import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Spinner } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useClassement } from '../hooks/useClassement'
import type { ClassementEntry } from '../types'

const MEDAILLES = ['🥇', '🥈', '🥉']

type Onglet = 'mois' | 'total' | 'sorties' | 'points'

interface Config {
  key: Onglet
  label: string
  /** Valeur servant au tri et affichée à droite. */
  valeur: (r: ClassementEntry) => number
  unite: string
  /** Sous-titre contextuel sous le nom. */
  sousTitre: (r: ClassementEntry) => string
  vide: string
}

const ONGLETS: Config[] = [
  {
    key: 'mois',
    label: 'Ce mois',
    valeur: (r) => r.nb_collages_mois,
    unite: 'collages',
    sousTitre: (r) => `${r.total_points} pts au total`,
    vide: 'Aucun collage ce mois-ci. Soyez le premier ! 👨‍🎨',
  },
  {
    key: 'total',
    label: 'Total',
    valeur: (r) => r.nb_collages,
    unite: 'collages',
    sousTitre: (r) => `${r.nb_sorties} sortie${r.nb_sorties > 1 ? 's' : ''}`,
    vide: "Aucun collage pour l'instant. 👨‍🎨",
  },
  {
    key: 'sorties',
    label: 'Sorties',
    valeur: (r) => r.nb_sorties,
    unite: 'sorties',
    sousTitre: (r) => `${r.nb_collages} panneaux collés`,
    vide: "Personne n'est encore sorti coller. 👨‍🎨",
  },
  {
    key: 'points',
    label: 'Points',
    valeur: (r) => r.total_points,
    unite: 'pts',
    sousTitre: (r) => `${r.nb_collages} collages`,
    vide: "Aucun point pour l'instant. 👨‍🎨",
  },
]

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { rows, loading, error, refresh } = useClassement()
  const [ongletKey, setOngletKey] = useState<Onglet>('mois')
  const [showInfo, setShowInfo] = useState(false)

  const cfg = ONGLETS.find((o) => o.key === ongletKey)!

  const classes = useMemo(
    () =>
      rows
        .filter((r) => cfg.valeur(r) > 0)
        .sort((a, b) => cfg.valeur(b) - cfg.valeur(a)),
    [rows, cfg],
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-100">
      <PageHeader
        title="Classement"
        subtitle="Les militants qui collent le plus"
      />

      {/* Explication du système de points */}
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setShowInfo((s) => !s)}
          className={`flex items-center gap-1.5 text-sm font-medium ${
            showInfo ? 'text-brand' : 'text-slate-500'
          }`}
        >
          <InfoIcon />
          Comment sont calculés les points ?
        </button>
        {showInfo && (
          <div className="mt-2 space-y-2 rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
            <p>
              <span className="font-semibold text-slate-900">10 points</span> par
              collage, pour <strong>chaque personne présente</strong> (le valideur
              et les partenaires ajoutés).
            </p>
            <p>
              Votre total ={' '}
              <strong>10 × le nombre de collages auxquels vous avez participé</strong>{' '}
              (en tant que valideur ou partenaire). Pas de bonus.
            </p>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="sticky top-0 z-10 bg-slate-100 px-4 pt-3">
        <div className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm">
          {ONGLETS.map((o) => (
            <button
              key={o.key}
              onClick={() => setOngletKey(o.key)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition sm:text-sm ${
                ongletKey === o.key ? 'bg-brand text-white' : 'text-slate-500'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-7 w-7 text-brand" />
        </div>
      )}

      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-perime">{error}</p>
          <button
            onClick={refresh}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && (
        <ol className="space-y-2 p-4">
          {classes.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">{cfg.vide}</p>
          )}
          {classes.map((r, i) => {
            const moi = r.user_id === user?.id
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ${
                  moi ? 'bg-brand text-white ring-2 ring-brand' : 'bg-white'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center text-lg font-bold ${
                    moi ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {MEDAILLES[i] ?? i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {r.display_name}
                    {moi && <span className="ml-1 text-sm opacity-80">(vous)</span>}
                  </p>
                  <p
                    className={`text-xs ${moi ? 'text-white/80' : 'text-slate-400'}`}
                  >
                    {cfg.sousTitre(r)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums">{cfg.valeur(r)}</p>
                  <p
                    className={`text-[10px] uppercase tracking-wide ${
                      moi ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {cfg.unite}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
