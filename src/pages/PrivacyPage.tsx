import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export default function PrivacyPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function supprimerCompte() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      setBusy(false)
      setError('Suppression impossible. Réessayez plus tard.')
      return
    }
    await signOut()
    // signOut → l'app revient à l'écran de connexion.
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <header className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600"
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-900">
          Confidentialité & mentions
        </h1>
      </header>

      <div className="space-y-6 p-5 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Qui édite l'app</h2>
          <p>
            Application militante de cartographie des panneaux d'affichage libre
            de Nantes Métropole. Usage interne, non commercial.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">
            Données collectées
          </h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Votre adresse e-mail (pour la connexion uniquement)</li>
            <li>Votre nom d'affichage (visible dans le classement)</li>
            <li>
              L'historique de vos collages (panneau + date), pour la carte et les
              points
            </li>
          </ul>
          <p className="mt-2">
            Aucune donnée n'est revendue ni partagée avec des tiers. Votre e-mail
            n'est jamais visible par les autres militants.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Hébergement</h2>
          <p>
            Données hébergées sur Supabase, en région Union Européenne (RGPD).
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Crédits carte</h2>
          <p>
            Fond de carte ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              les contributeurs OpenStreetMap
            </a>{' '}
            ©{' '}
            <a
              href="https://carto.com/attributions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CARTO
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Vos droits</h2>
          <p>
            Vous pouvez supprimer votre compte et toutes vos données à tout
            moment, ci-dessous. La suppression est définitive.
          </p>
        </section>

        {/* Suppression de compte */}
        <section className="rounded-2xl border border-perime/30 bg-perime/5 p-4">
          <h2 className="mb-1 font-semibold text-perime">Supprimer mon compte</h2>
          <p className="mb-3 text-slate-600">
            Efface définitivement votre profil, vos collages et votre e-mail.
            Cette action est irréversible.
          </p>
          {error && <p className="mb-2 text-sm text-perime">{error}</p>}
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-xl border border-perime px-4 py-2.5 text-sm font-semibold text-perime"
            >
              Supprimer mon compte
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">
                Confirmer la suppression définitive ?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={supprimerCompte}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-perime px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Suppression…' : 'Oui, supprimer'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
