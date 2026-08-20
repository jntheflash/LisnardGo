import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui'
import { DEPARTEMENTS } from '../data/departements'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()

  // Pré-remplissage depuis un éventuel ancien nom d'affichage.
  const initial = (() => {
    if (profile?.prenom || profile?.nom)
      return { prenom: profile.prenom ?? '', nom: profile.nom ?? '' }
    const parts = (profile?.display_name ?? '').trim().split(/\s+/).filter(Boolean)
    return { prenom: parts[0] ?? '', nom: parts.slice(1).join(' ') }
  })()

  const [prenom, setPrenom] = useState(initial.prenom)
  const [nom, setNom] = useState(initial.nom)
  const [departement, setDepartement] = useState(profile?.departement ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // « Compléter » si le profil existait déjà, sinon « Bienvenue ».
  const existant = Boolean(profile?.display_name)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const p = prenom.trim()
    const n = nom.trim()
    if (!p || !n || !departement) {
      setError('Le prénom, le nom et le département sont obligatoires.')
      return
    }
    if (!user) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ prenom: p, nom: n, departement, display_name: `${p} ${n}` })
      .eq('id', user.id)
    if (error) {
      setLoading(false)
      setError('Enregistrement impossible. Réessayez.')
      return
    }
    await refreshProfile()
    // refreshProfile met à jour le profil → l'app affiche la carte.
  }

  return (
    <div className="flex h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {existant ? 'Complétez votre profil' : 'Bienvenue 👋'}
        </h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Indiquez votre prénom, votre nom et votre département de référence pour
          accéder à la carte. Vos nom et prénom apparaîtront dans le classement
          (jamais votre e-mail).
        </p>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label
              htmlFor="prenom"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Prénom
            </label>
            <input
              id="prenom"
              type="text"
              autoFocus
              autoComplete="given-name"
              maxLength={40}
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="ex. Camille"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label
              htmlFor="nom"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nom
            </label>
            <input
              id="nom"
              type="text"
              autoComplete="family-name"
              maxLength={40}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex. Martin"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label
              htmlFor="departement"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Département de référence
            </label>
            <select
              id="departement"
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="" disabled>
                Choisissez un département…
              </option>
              {DEPARTEMENTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} - {d.nom}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-perime">{error}</p>}
          <Button type="submit" loading={loading}>
            {existant ? 'Enregistrer' : "C'est parti"}
          </Button>
        </form>
      </div>
    </div>
  )
}
