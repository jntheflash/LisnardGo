import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Spinner } from '../components/ui'
import { usePanneaux } from '../hooks/usePanneaux'
import { useStats, type MonthBucket } from '../hooks/useStats'
import { useAuth } from '../auth/AuthProvider'
import { lienWhatsapp, resoudreReferent } from '../data/referents'

const WhatsAppIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.005zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
  </svg>
)

export default function StatsPage() {
  const { panneaux, loading: loadingP } = usePanneaux()
  const { stats, loading: loadingS, error } = useStats()
  const { profile } = useAuth()

  // Référent dépendant du département du membre (repli national si absent).
  const { referent } = resoudreReferent(profile?.departement)
  const waUrl = lienWhatsapp(referent)

  const etatCounts = useMemo(
    () => ({
      total: panneaux.length,
      fait: panneaux.filter((p) => p.etat === 'fait').length,
      perime: panneaux.filter((p) => p.etat === 'perime').length,
      a_faire: panneaux.filter((p) => p.etat === 'a_faire').length,
    }),
    [panneaux],
  )

  const [showWa, setShowWa] = useState(false)
  const loading = loadingP || loadingS
  const total = etatCounts.total || 468
  const pctCollesEver = stats
    ? Math.round((stats.panneauxCollesEver / total) * 100)
    : 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-100">
      <PageHeader title="Statistiques" subtitle="La campagne sur la Métropole" />

      {/* Bouton « Recevoir des affiches » */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => setShowWa(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-fait px-4 py-3.5 text-base font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          {WhatsAppIcon}
          Recevoir des affiches
        </button>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-7 w-7 text-brand" />
        </div>
      )}

      {error && !loading && (
        <p className="p-8 text-center text-sm text-perime">{error}</p>
      )}

      {!loading && !error && stats && (
        <div className="space-y-4 p-4">
          {/* Couverture globale */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-sm text-slate-500">
                Panneaux collés (au moins une fois)
              </span>
              <InfoButton text="Nombre de panneaux DIFFÉRENTS collés au moins une fois (un panneau collé plusieurs fois compte pour 1). C'est la couverture réelle de la ville." />
            </div>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {stats.panneauxCollesEver}
              <span className="text-lg font-medium text-slate-400"> / {total}</span>
            </p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-fait"
                style={{ width: `${pctCollesEver}%` }}
              />
            </div>
            <p className="mt-1 text-right text-sm font-semibold text-fait">
              {pctCollesEver}%
            </p>
          </section>

          {/* Cartes chiffres */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Artistes"
              value={stats.nbArtistes}
              accent="brand"
              info="Nombre de militants différents ayant déjà collé au moins un panneau."
            />
            <StatCard
              label="Collages au total"
              value={stats.totalCollages}
              accent="brand"
              info="Nombre total de fois où « J'ai collé » a été validé (l'historique). Recoller un même panneau compte à chaque fois — sert au calcul des points."
            />
            <StatCard
              label="À jour"
              value={etatCounts.fait}
              accent="fait"
              info="Panneaux collés il y a 14 jours ou moins (encore « frais »)."
            />
            <StatCard
              label="À refaire"
              value={etatCounts.perime}
              accent="perime"
              info="Panneaux collés il y a plus de 14 jours : l'affiche est à recoller."
            />
            <StatCard
              label="Jamais collés"
              value={etatCounts.a_faire}
              accent="afaire"
              info="Panneaux qui n'ont encore jamais été collés."
            />
            <StatCard
              label="Couverture actuelle"
              value={`${Math.round((etatCounts.fait / total) * 100)}%`}
              accent="fait"
              info="Part des panneaux actuellement à jour sur le total de 468."
            />
          </div>

          {/* Graphique mensuel */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Collages par mois</h2>
            <p className="mb-4 text-sm text-slate-500">
              Nombre de collages réalisés chaque mois (jusqu'à mai 2027).
            </p>
            <BarChart data={stats.serie} />
          </section>
        </div>
      )}

      {/* Popup de confirmation avant redirection WhatsApp */}
      {showWa && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => setShowWa(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">
              Recevoir des affiches
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Vous allez être redirigé·e vers <strong>WhatsApp</strong> pour
              contacter <strong>{referent.nom}</strong>, qui distribue les
              affiches.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowWa(false)}
                className="flex-1 rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700"
              >
                Annuler
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowWa(false)}
                className="flex-1 rounded-xl bg-fait px-4 py-3 text-center font-semibold text-white"
              >
                Continuer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ACCENTS: Record<string, string> = {
  brand: 'text-brand',
  fait: 'text-fait',
  perime: 'text-perime',
  afaire: 'text-afaire',
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

/** Petit bouton ⓘ qui révèle un texte d'aide au tap. */
function InfoButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Plus d'infos"
        className={open ? 'text-brand' : 'text-slate-300'}
      >
        <InfoIcon />
      </button>
      {open && (
        <p className="mt-2 w-full text-[11px] leading-snug text-slate-500">
          {text}
        </p>
      )}
    </>
  )
}

function StatCard({
  label,
  value,
  accent,
  info,
}: {
  label: string
  value: string | number
  accent: string
  info?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold ${ACCENTS[accent] ?? 'text-slate-900'}`}>
        {value}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-slate-500">{label}</span>
        {info && <InfoButton text={info} />}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: MonthBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-2" style={{ height: 160 }}>
        {data.map((d) => (
          <div
            key={d.key}
            className="flex shrink-0 flex-col items-center justify-end gap-1"
            style={{ width: 34 }}
          >
            <span className="text-[10px] font-semibold text-slate-500">
              {d.count > 0 ? d.count : ''}
            </span>
            <div
              className="w-5 rounded-t bg-fait"
              style={{
                height: `${(d.count / max) * 120}px`,
                minHeight: d.count > 0 ? 4 : 2,
                background: d.count > 0 ? undefined : '#e2e8f0',
              }}
            />
            <span className="whitespace-nowrap text-[10px] text-slate-400">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
