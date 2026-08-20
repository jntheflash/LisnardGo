import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { DEPARTEMENTS } from '../data/departements'
import { Spinner } from '../components/ui'

type Role = 'militant' | 'referent' | 'admin_national'

interface Membre {
  id: string
  prenom: string | null
  nom: string | null
  display_name: string | null
  email: string | null
  departement: string | null
  role: Role
  referent_departement: string | null
  is_active: boolean
}

interface PanneauManuel {
  id: string
  nom_voie: string | null
  complement_adresse: string | null
  commune: string | null
  lat: number
  lng: number
  departement: string | null
}

const NOM_DEPT = new Map(DEPARTEMENTS.map((d) => [d.code, d.nom]))
const labelDept = (code: string | null) =>
  code ? `${code} - ${NOM_DEPT.get(code) ?? '?'}` : '—'

/** Valeur spéciale du filtre admin : membres/panneaux sans département. */
const SANS_DEPT = '__sans_departement__'

const ROLE_LABEL: Record<Role, string> = {
  militant: 'Militant',
  referent: 'Référent',
  admin_national: 'Admin national',
}
const ROLE_BADGE: Record<Role, string> = {
  militant: 'bg-slate-100 text-slate-500',
  referent: 'bg-brand/10 text-brand',
  admin_national: 'bg-fait/15 text-fait',
}

export default function AdministrationPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin_national'
  const monEmail = user?.email?.toLowerCase()

  const [members, setMembers] = useState<Membre[]>([])
  const [panneaux, setPanneaux] = useState<PanneauManuel[]>([])
  const [acces, setAcces] = useState<{ email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreDept, setFiltreDept] = useState('') // '' = tous (admin)
  const [statutFiltre, setStatutFiltre] = useState<'actifs' | 'desactives' | 'tous'>('actifs')
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDisable, setConfirmDisable] = useState<string | null>(null)
  const [busyMember, setBusyMember] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErreur(null)
    const [{ data: ms }, { data: ps }, { data: ae }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, prenom, nom, display_name, email, departement, role, referent_departement, is_active')
        .order('display_name'),
      supabase
        .from('panneaux')
        .select('id, nom_voie, complement_adresse, commune, lat, lng, departement')
        .eq('source', 'manuel')
        .is('deleted_at', null),
      // Liste blanche (RLS : visible uniquement par les admins) — pour la révocation.
      supabase.from('allowed_emails').select('email').order('email'),
    ])
    setMembers((ms ?? []) as Membre[])
    setPanneaux((ps ?? []) as PanneauManuel[])
    setAcces((ae ?? []) as { email: string }[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Filtre de périmètre EXPLICITEMENT conditionné au rôle :
  //  • admin_national : AUCUN filtre imposé ; filtre FACULTATIF via filtreDept
  //    ('' = tous, SANS_DEPT = sans département, sinon un code de département).
  //    On ne se base jamais sur le departement perso ni sur referent_departement.
  //  • referent : strictement son referent_departement (vide → rien).
  const inScope = (dept: string | null): boolean => {
    if (isAdmin) {
      if (filtreDept === '') return true // Tous
      if (filtreDept === SANS_DEPT) return !dept // sans département
      return dept === filtreDept
    }
    const rd = profile?.referent_departement ?? null
    return rd != null && dept === rd
  }
  // Filtre par statut actif/désactivé (référent : actifs uniquement).
  const statutMatch = (m: Membre): boolean => {
    if (!isAdmin) return m.is_active !== false
    if (statutFiltre === 'actifs') return m.is_active !== false
    if (statutFiltre === 'desactives') return m.is_active === false
    return true
  }
  const membresAffiches = members.filter(
    (m) => inScope(m.departement) && statutMatch(m),
  )
  const panneauxAffiches = panneaux.filter((p) => inScope(p.departement))

  // Départements présents (pour le filtre admin).
  const deptsPresents = useMemo(() => {
    const s = new Set<string>()
    members.forEach((m) => m.departement && s.add(m.departement))
    panneaux.forEach((p) => p.departement && s.add(p.departement))
    return [...s].sort()
  }, [members, panneaux])

  async function supprimerPanneau(id: string) {
    setBusyId(id)
    setErreur(null)
    const { data, error } = await supabase
      .from('panneaux')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    setBusyId(null)
    setConfirmId(null)
    if (error || !data || data.length === 0) {
      setErreur(
        'Suppression refusée par le serveur (hors de votre périmètre ?) ou impossible.',
      )
      return
    }
    setPanneaux((prev) => prev.filter((p) => p.id !== id))
  }

  async function changerRole(userId: string, role: Role, dept: string) {
    setErreur(null)
    const { error } = await supabase.rpc('admin_set_role', {
      p_user_id: userId,
      p_role: role,
      p_referent_departement: role === 'referent' ? dept : null,
    })
    if (error) {
      setErreur(error.message)
      return
    }
    await load()
  }

  async function revoquer(email: string) {
    setErreur(null)
    const { error } = await supabase
      .from('allowed_emails')
      .delete()
      .eq('email', email)
    if (error) {
      setErreur("Révocation de l'accès impossible.")
      return
    }
    setAcces((prev) => prev.filter((a) => a.email !== email))
  }

  // Désactivation douce / réactivation via l'Edge Function (jamais en direct).
  async function toggleActive(userId: string, activate: boolean) {
    setBusyMember(userId)
    setErreur(null)
    const { error } = await supabase.functions.invoke('set-member-active', {
      body: { user_id: userId, active: activate },
    })
    setBusyMember(null)
    setConfirmDisable(null)
    if (error) {
      let text = 'Action impossible.'
      try {
        const j = await (error as { context?: Response }).context?.json()
        if (j?.error) text = j.error
      } catch {
        /* corps non lisible */
      }
      setErreur(text)
      return
    }
    await load()
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600"
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Administration</h1>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'Admin national — accès complet'
              : `Référent — ${labelDept(profile?.referent_departement ?? null)}`}
          </p>
        </div>
      </header>

      <div className="space-y-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {erreur && (
          <p className="rounded-xl bg-perime/10 px-4 py-3 text-sm text-perime">
            {erreur}
          </p>
        )}

        {/* Inviter un membre (admin national uniquement) — via Edge Function */}
        {isAdmin && <InviteForm onInvited={load} />}

        {/* Filtre par département (admin uniquement) */}
        {isAdmin && (
          <div>
            <label className="mb-1 block px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Département
            </label>
            <select
              value={filtreDept}
              onChange={(e) => setFiltreDept(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Tous les départements</option>
              <option value={SANS_DEPT}>Département non renseigné</option>
              {deptsPresents.map((c) => (
                <option key={c} value={c}>
                  {labelDept(c)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtre statut actif/désactivé (admin uniquement) */}
        {isAdmin && (
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['actifs', 'Actifs'],
                ['desactives', 'Désactivés'],
                ['tous', 'Tous'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatutFiltre(k)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  statutFiltre === k
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-7 w-7 text-brand" />
          </div>
        ) : (
          <>
            {/* Militants */}
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Membres ({membresAffiches.length})
              </h2>
              {membresAffiches.length === 0 ? (
                <p className="px-1 text-sm text-slate-400">Aucun membre.</p>
              ) : (
                membresAffiches.map((m) => {
                  const inactif = m.is_active === false
                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl bg-white p-4 shadow-sm ${inactif ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {m.display_name || m.email || 'Membre'}
                          </p>
                          <p className="truncate text-sm text-slate-500">{m.email}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Département : {labelDept(m.departement)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${ROLE_BADGE[m.role]}`}
                          >
                            {ROLE_LABEL[m.role]}
                            {m.role === 'referent' && m.referent_departement
                              ? ` ${m.referent_departement}`
                              : ''}
                          </span>
                          {inactif && (
                            <span className="rounded-full bg-perime/10 px-2.5 py-1 text-xs font-bold text-perime">
                              Désactivé
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gestion des rôles (admin national uniquement) */}
                      {isAdmin && <RoleEditor membre={m} onSave={changerRole} />}

                      {/* Activation / désactivation (admin national uniquement) */}
                      {isAdmin &&
                        (inactif ? (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <button
                              onClick={() => toggleActive(m.id, true)}
                              disabled={busyMember === m.id}
                              className="rounded-xl bg-fait px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {busyMember === m.id ? '…' : 'Réactiver'}
                            </button>
                          </div>
                        ) : confirmDisable === m.id ? (
                          <div className="mt-3 space-y-2 rounded-xl border border-perime/30 bg-perime/5 p-3">
                            <p className="text-sm font-medium text-slate-800">
                              Désactiver ce membre ? Il ne pourra plus se
                              connecter ; ses données et collages sont conservés.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => toggleActive(m.id, false)}
                                disabled={busyMember === m.id}
                                className="flex-1 rounded-xl bg-perime px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {busyMember === m.id
                                  ? 'Désactivation…'
                                  : 'Oui, désactiver'}
                              </button>
                              <button
                                onClick={() => setConfirmDisable(null)}
                                disabled={busyMember === m.id}
                                className="flex-1 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <button
                              onClick={() => setConfirmDisable(m.id)}
                              className="text-sm font-medium text-perime underline"
                            >
                              Désactiver
                            </button>
                          </div>
                        ))}
                    </div>
                  )
                })
              )}
            </section>

            {/* Accès autorisés (liste blanche) — admin national uniquement */}
            {isAdmin && (
              <section className="space-y-3">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Accès autorisés ({acces.length})
                </h2>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  {acces.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucun accès enregistré.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {acces.map((a) => {
                        const moi = a.email === monEmail
                        return (
                          <li
                            key={a.email}
                            className="flex items-center gap-2 py-2.5 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-700">
                              {a.email}
                            </span>
                            {moi ? (
                              <span className="text-xs text-slate-400">vous</span>
                            ) : (
                              <button
                                onClick={() => revoquer(a.email)}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-perime"
                                aria-label={`Révoquer ${a.email}`}
                              >
                                Révoquer
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {/* Panneaux manuels */}
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Panneaux manuels ({panneauxAffiches.length})
              </h2>
              {panneauxAffiches.length === 0 ? (
                <p className="px-1 text-sm text-slate-400">
                  Aucun panneau manuel.
                </p>
              ) : (
                panneauxAffiches.map((p) => {
                  const titre =
                    [p.nom_voie, p.complement_adresse].filter(Boolean).join(' — ') ||
                    `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
                  return (
                    <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {titre}
                          </p>
                          <p className="text-xs text-slate-400">
                            {p.commune ? `${p.commune} · ` : ''}Dépt{' '}
                            {p.departement ?? '—'}
                          </p>
                        </div>
                      </div>
                      {confirmId === p.id ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => supprimerPanneau(p.id)}
                            disabled={busyId === p.id}
                            className="flex-1 rounded-xl bg-perime px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {busyId === p.id ? 'Suppression…' : 'Oui, supprimer'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={busyId === p.id}
                            className="flex-1 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(p.id)}
                          className="mt-3 text-sm font-medium text-perime underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Formulaire d'invitation (admin national) → Edge Function `invite-member`. */
function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [departement, setDepartement] = useState('')
  const [role, setRole] = useState<Role>('militant')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const mail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setMsg({ ok: false, text: 'E-mail invalide.' })
      return
    }
    if (role === 'referent' && !departement) {
      setMsg({ ok: false, text: 'Choisissez un département pour le référent.' })
      return
    }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-member', {
      body: {
        email: mail,
        prenom: prenom.trim() || null,
        nom: nom.trim() || null,
        departement: departement || null,
        role,
        referent_departement: role === 'referent' ? departement : null,
      },
    })
    setBusy(false)
    if (error) {
      let text = "Échec de l'invitation."
      try {
        const j = await (error as { context?: Response }).context?.json()
        if (j?.error) text = j.error
      } catch {
        /* corps non lisible */
      }
      setMsg({ ok: false, text })
      return
    }
    setMsg({
      ok: true,
      text:
        data?.statut === 'déjà inscrit'
          ? 'Personne déjà inscrite — profil mis à jour.'
          : 'Invitation envoyée ✓',
    })
    setEmail('')
    setPrenom('')
    setNom('')
    setDepartement('')
    setRole('militant')
    onInvited()
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-900">Inviter un membre</h2>
      <p className="mb-3 text-sm text-slate-500">
        Un e-mail d'invitation est envoyé ; le profil (prénom, nom, département,
        rôle) est pré-rempli pour sa première connexion.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemple.fr"
          autoCapitalize="none"
          className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="flex gap-2">
          <input
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Prénom"
            className="w-1/2 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-brand"
          />
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom"
            className="w-1/2 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand"
          >
            <option value="militant">Militant</option>
            <option value="referent">Référent</option>
            <option value="admin_national">Admin national</option>
          </select>
          <select
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand"
          >
            <option value="">
              Département{role === 'referent' ? ' (obligatoire)' : ''}…
            </option>
            {DEPARTEMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} - {d.nom}
              </option>
            ))}
          </select>
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-fait' : 'text-perime'}`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Envoi…' : "Envoyer l'invitation"}
        </button>
      </form>
    </section>
  )
}

/** Contrôle de changement de rôle (admin national uniquement). */
function RoleEditor({
  membre,
  onSave,
}: {
  membre: Membre
  onSave: (userId: string, role: Role, dept: string) => Promise<void>
}) {
  const [role, setRole] = useState<Role>(membre.role)
  const [dept, setDept] = useState(
    membre.referent_departement ?? membre.departement ?? '',
  )
  const [saving, setSaving] = useState(false)

  const dirty =
    role !== membre.role ||
    (role === 'referent' && dept !== (membre.referent_departement ?? ''))
  const invalide = role === 'referent' && !dept

  async function save() {
    setSaving(true)
    await onSave(membre.id, role, dept)
    setSaving(false)
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Rôle
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="militant">Militant</option>
          <option value="referent">Référent</option>
          <option value="admin_national">Admin national</option>
        </select>
        {role === 'referent' && (
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="" disabled>
              Département…
            </option>
            {DEPARTEMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} - {d.nom}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={save}
          disabled={!dirty || invalide || saving}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
