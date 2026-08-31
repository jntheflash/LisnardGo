import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ETATS } from '../config'
import { formatDernierCollage, formatExpiration } from '../lib/etat'
import { twitterUrl, linkedinUrl } from '../lib/social'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { PanneauAvecEtat } from '../types'
import { Button } from './ui'

interface Member {
  id: string
  display_name: string
  prenom?: string | null
  nom?: string | null
}

/** Compte à rebours avant péremption, rafraîchi chaque seconde. */
function Countdown({ dernierCollage }: { dernierCollage: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3600), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl bg-fait/10 px-3 py-2 text-sm font-semibold text-fait">
      <span aria-hidden="true">⏳</span>
      {formatExpiration(dernierCollage)}
    </div>
  )
}

const XIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
)

const LinkedInIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
)

type Step = 'details' | 'partners' | 'success'

interface Props {
  panneau: PanneauAvecEtat
  onClose: () => void
  /** Enregistre le collage (+ participants) ; renvoie true si succès. */
  onValiderCollage: (partnerIds: string[]) => Promise<boolean>
  onAnnuler: () => void
  /** True → on propose en plus le lien « Annuler » (mon collage est le plus récent). */
  peutAnnuler: boolean
  busy?: boolean
  erreur?: string | null
  /** Suppression (uniquement panneaux manuels de l'utilisateur). */
  onSupprimer?: () => void
  peutSupprimer?: boolean
  suppressionBusy?: boolean
}

export default function PanneauSheet({
  panneau,
  onClose,
  onValiderCollage,
  onAnnuler,
  peutAnnuler,
  busy,
  erreur,
  onSupprimer,
  peutSupprimer,
  suppressionBusy,
}: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('details')
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [confirmSuppr, setConfirmSuppr] = useState(false)

  // --- État de l'étape 2 (partenaires) ---
  // On mémorise la requête qui a produit ces résultats : « en cours de
  // recherche » et « résultats affichables » s'en déduisent, sans setState
  // synchrone dans l'effet (qui provoquerait des rendus en cascade).
  const [res, setRes] = useState<{ q: string; list: Member[] }>({ q: '', list: [] })
  const [suggestions, setSuggestions] = useState<Member[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Member[]>([])
  // Une fois la recherche focalisée, la sheet reste en pleine hauteur (keyboard-aware).
  const [searchFocused, setSearchFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Zone réellement visible (au-dessus du clavier iOS) via visualViewport.
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const visual = window.visualViewport
    if (!visual) return
    const update = () => setVv({ top: visual.offsetTop, height: visual.height })
    update()
    visual.addEventListener('resize', update)
    visual.addEventListener('scroll', update)
    return () => {
      visual.removeEventListener('resize', update)
      visual.removeEventListener('scroll', update)
    }
  }, [])

  const q = query.trim()

  // Suggestions « Récemment » : liste courte, déjà bornée côté serveur.
  useEffect(() => {
    let cancelled = false
    supabase.rpc('suggested_partners').then(({ data }) => {
      if (!cancelled)
        setSuggestions(((data ?? []) as Member[]).filter((m) => m.display_name))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Recherche CÔTÉ SERVEUR : 2 caractères minimum, 10 résultats maximum, jamais
  // d'e-mail. L'annuaire n'est plus téléchargé — seule la saisie part au serveur.
  useEffect(() => {
    if (q.length < 2) return
    let cancelled = false
    const t = setTimeout(() => {
      supabase.rpc('search_members', { q }).then(({ data }) => {
        if (cancelled) return
        setRes({
          q,
          list: ((data ?? []) as Member[]).filter((m) => m.display_name),
        })
      })
    }, 250) // anti-rebond : une requête par pause de frappe, pas par caractère
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  // Fermeture automatique de l'étape de confirmation (~1,5 s).
  useEffect(() => {
    if (step !== 'success') return
    const t = setTimeout(onClose, 1500)
    return () => clearTimeout(t)
  }, [step, onClose])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  // Le serveur exclut déjà l'utilisateur courant : il reste à masquer les
  // personnes déjà sélectionnées. Les résultats d'une requête précédente ne
  // s'affichent jamais pour la requête en cours.
  const visibles = useMemo(
    () =>
      res.q === q
        ? res.list.filter((m) => m.id !== user?.id && !selectedIds.has(m.id))
        : [],
    [res, q, selectedIds, user],
  )
  const searching = q.length >= 2 && res.q !== q

  const recent = useMemo(
    () =>
      suggestions
        .filter((m) => m.id !== user?.id && !selectedIds.has(m.id))
        .slice(0, 8),
    [suggestions, selectedIds, user],
  )

  function addPartner(m: Member) {
    setSelected((prev) => (prev.some((s) => s.id === m.id) ? prev : [...prev, m]))
    setQuery('')
    // Pas de focus automatique : le clavier ne s'ouvre que sur action volontaire.
  }
  // Ajout depuis une suggestion « Récemment » : ne donne jamais le focus au champ
  // (pas de clavier) et ferme le clavier s'il était déjà ouvert.
  function addFromSuggestion(m: Member) {
    inputRef.current?.blur()
    addPartner(m)
  }
  function removePartner(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }

  function goPartners() {
    setDir('fwd')
    setStep('partners')
  }
  function goBack() {
    setDir('back')
    setSearchFocused(false)
    setStep('details')
  }
  async function valider() {
    const ok = await onValiderCollage(selected.map((s) => s.id))
    if (ok) {
      setSearchFocused(false)
      setDir('fwd')
      setStep('success')
    }
  }

  const etat = ETATS[panneau.etat]
  const manuel = panneau.source === 'manuel'
  const coords = `${panneau.lat.toFixed(5)}, ${panneau.lng.toFixed(5)}`
  const adresse = [panneau.nom_voie, panneau.complement_adresse]
    .filter(Boolean)
    .join(' — ')

  // Pleine hauteur + keyboard-aware uniquement à l'étape 2 une fois la recherche focalisée.
  const keyboardAware = step === 'partners' && searchFocused && vv
  const sheetStyle: CSSProperties = keyboardAware
    ? { top: vv.top, height: vv.height }
    : { bottom: 0, maxHeight: '88dvh' }

  const animClass = dir === 'back' ? 'sheet-back' : 'sheet-fwd'

  return (
    <>
      {/* Voile : un seul élément à l'écran ; tap dehors = fermer */}
      <div
        className="fixed inset-0 z-[1990] bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface unique */}
      <div
        className="sheet-enter fixed inset-x-0 z-[2000] mx-auto flex max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
        style={sheetStyle}
      >
        <div key={step} className={`flex min-h-0 flex-1 flex-col ${animClass}`}>
          {/* ---------- ÉTAPE 1 : DÉTAILS ---------- */}
          {step === 'details' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-slate-900">
                    {manuel
                      ? 'Panneau ajouté manuellement'
                      : adresse || 'Adresse non renseignée'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {manuel ? coords : panneau.commune}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ background: etat.color }}
                  >
                    {etat.label}
                  </span>
                  <button
                    onClick={onClose}
                    aria-label="Fermer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-400">Dernier collage</dt>
                  <dd className="font-semibold text-slate-700">
                    {formatDernierCollage(panneau.dernier_collage)}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-400">Référence</dt>
                  <dd className="font-semibold text-slate-700">
                    {manuel ? 'Manuel' : panneau.id_inventaire}
                  </dd>
                </div>
              </dl>

              {panneau.etat === 'fait' && panneau.dernier_collage && (
                <Countdown dernierCollage={panneau.dernier_collage} />
              )}

              {panneau.dernier_collage_par_nom && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>
                    Collé par{' '}
                    <span className="font-semibold text-slate-800">
                      {panneau.dernier_collage_par_nom}
                    </span>
                  </span>
                  {panneau.dernier_collage_par_twitter && (
                    <a
                      href={twitterUrl(panneau.dernier_collage_par_twitter)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="X / Twitter"
                      className="text-slate-400 transition-colors hover:text-slate-800"
                    >
                      {XIcon}
                    </a>
                  )}
                  {panneau.dernier_collage_par_linkedin && (
                    <a
                      href={linkedinUrl(panneau.dernier_collage_par_linkedin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="text-slate-400 transition-colors hover:text-[#0a66c2]"
                    >
                      {LinkedInIcon}
                    </a>
                  )}
                </p>
              )}

              {erreur && <p className="mt-3 text-sm text-perime">{erreur}</p>}

              <div className="mt-4 space-y-2">
                <Button onClick={goPartners}>
                  {panneau.etat === 'fait'
                    ? "J'ai recollé ce panneau 👨‍🎨"
                    : "J'ai collé ce panneau 👨‍🎨"}
                </Button>

                {peutAnnuler && (
                  <button
                    onClick={onAnnuler}
                    disabled={busy}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 underline disabled:opacity-50"
                  >
                    Annuler mon dernier collage
                  </button>
                )}

                {/* Itinéraire : Google Maps prend la position actuelle comme départ */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${panneau.lat},${panneau.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path
                      d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Itinéraire
                </a>

                {/* Suppression — uniquement les panneaux manuels de l'utilisateur */}
                {peutSupprimer &&
                  (confirmSuppr ? (
                    <div className="space-y-2 rounded-xl border border-perime/30 bg-perime/5 p-3">
                      <p className="text-sm font-medium text-slate-800">
                        Supprimer définitivement ce panneau de la carte ?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={onSupprimer}
                          disabled={suppressionBusy}
                          className="flex-1 rounded-xl bg-perime px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {suppressionBusy ? 'Suppression…' : 'Oui, supprimer'}
                        </button>
                        <button
                          onClick={() => setConfirmSuppr(false)}
                          disabled={suppressionBusy}
                          className="flex-1 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmSuppr(true)}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-perime underline"
                    >
                      Supprimer ce panneau
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* ---------- ÉTAPE 2 : AVEC QUI ---------- */}
          {step === 'partners' && (
            <>
              <div className="flex shrink-0 items-center gap-2 p-5 pb-2">
                <button
                  onClick={goBack}
                  aria-label="Retour"
                  className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <h2 className="text-lg font-bold text-slate-900">
                  Avec qui avez-vous collé ce panneau ?
                </h2>
              </div>

              <div className="shrink-0 px-5">
                <p className="mb-3 text-sm text-slate-500">
                  Par sécurité, indiquez le ou les membres présents (facultatif).
                </p>

                {selected.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selected.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => removePartner(m.id)}
                        className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {m.display_name}
                        <span aria-hidden="true" className="text-white/80">
                          ✕
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Rechercher (prénom ou nom)…"
                  autoCapitalize="none"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Résultats OU suggestions « Récemment » — zone défilable */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2">
                {q.length > 0 ? (
                  q.length < 2 ? (
                    <p className="py-3 text-sm text-slate-400">
                      Tapez au moins 2 caractères.
                    </p>
                  ) : searching ? (
                    <p className="py-3 text-sm text-slate-400">Recherche…</p>
                  ) : visibles.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {visibles.map((m) => (
                        <li key={m.id}>
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addPartner(m)}
                            className="w-full py-2.5 text-left text-sm text-slate-700"
                          >
                            {m.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-3 text-sm text-slate-400">Aucun membre trouvé.</p>
                  )
                ) : recent.length > 0 ? (
                  <div>
                    <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Récemment
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((m) => (
                        <button
                          key={m.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addFromSuggestion(m)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                        >
                          {m.display_name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {erreur && <p className="mb-2 text-sm text-perime">{erreur}</p>}
                <Button onClick={valider} loading={busy}>
                  Valider le collage
                </Button>
              </div>
            </>
          )}

          {/* ---------- ÉTAPE 3 : CONFIRMATION ---------- */}
          {step === 'success' && (
            <button
              onClick={onClose}
              className="flex min-h-0 flex-1 cursor-default flex-col items-center justify-center gap-3 p-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fait/15 text-3xl text-fait">
                ✓
              </span>
              <p className="text-lg font-bold text-slate-900">
                Panneau marqué comme collé
              </p>
              <p className="text-sm text-slate-500">Merci pour votre collage 👨‍🎨</p>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
