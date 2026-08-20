import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../auth/AuthProvider'
import { useClassement } from '../hooks/useClassement'
import { supabase } from '../lib/supabase'
import { Button, Spinner } from '../components/ui'

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  const { rows, loading } = useClassement()
  const [signingOut, setSigningOut] = useState(false)

  const rang = rows.findIndex((r) => r.user_id === user?.id)
  const moi = rang >= 0 ? rows[rang] : null

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-100">
      <PageHeader title="Profil" />
      <div className="space-y-6 p-4">
        {/* Identité */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
              {(profile?.display_name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">
                {profile?.display_name ?? 'Militant'}
              </p>
              <p className="truncate text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-6 w-6 text-brand" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Points" value={moi?.total_points ?? 0} />
              <Stat label="Classement" value={rang >= 0 ? `#${rang + 1}` : '—'} />
              <Stat label="Collages" value={moi?.nb_collages ?? 0} />
              <Stat label="Sorties" value={moi?.nb_sorties ?? 0} />
            </div>
          )}
        </section>

        {/* Réseaux sociaux */}
        <SocialsSection />

        {/* Administration (rôles / panneaux / accès) — référents & admins nationaux */}
        {(profile?.role === 'referent' || profile?.role === 'admin_national') && (
          <Link
            to="/administration"
            className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
          >
            <span className="font-semibold text-slate-900">Administration</span>
            <span className="text-sm text-slate-400">
              {profile.role === 'admin_national'
                ? 'Rôles & panneaux →'
                : 'Mon département →'}
            </span>
          </Link>
        )}

        <Button
          loading={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await signOut()
          }}
          className="!bg-slate-200 !text-slate-700"
        >
          Se déconnecter
        </Button>

        <Link
          to="/confidentialite"
          className="block py-2 text-center text-sm text-slate-400 underline"
        >
          Confidentialité & suppression de compte
        </Link>
      </div>
    </div>
  )
}

function SocialsSection() {
  const { user, profile, refreshProfile } = useAuth()
  const [twitter, setTwitter] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pré-remplit avec les valeurs actuelles du profil
  useEffect(() => {
    setTwitter(profile?.twitter ?? '')
    setLinkedin(profile?.linkedin ?? '')
  }, [profile?.twitter, profile?.linkedin])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaved(false)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        twitter: twitter.trim() || null,
        linkedin: linkedin.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setError('Enregistrement impossible. Réessayez.')
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-900">Mes réseaux</h2>
      <p className="mb-4 text-sm text-slate-500">
        Optionnel. Visibles par les autres militants (ex. dans la fiche d'un
        panneau que vous avez collé) pour pouvoir vous contacter.
      </p>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label
            htmlFor="twitter"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            X / Twitter
          </label>
          <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <span className="pl-3 text-slate-400">@</span>
            <input
              id="twitter"
              type="text"
              value={twitter}
              onChange={(e) => {
                setTwitter(e.target.value)
                setSaved(false)
              }}
              placeholder="pseudo"
              autoCapitalize="none"
              className="w-full bg-transparent px-2 py-3 outline-none"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="linkedin"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            LinkedIn
          </label>
          <input
            id="linkedin"
            type="text"
            value={linkedin}
            onChange={(e) => {
              setLinkedin(e.target.value)
              setSaved(false)
            }}
            placeholder="https://www.linkedin.com/in/votre-profil"
            autoCapitalize="none"
            className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        {error && <p className="text-sm text-perime">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </form>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}
