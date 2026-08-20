// Edge Function : invite-member
// Invite un membre par e-mail (API admin), pré-remplit son profil (prenom/nom/
// departement/role) et l'ajoute à la liste blanche. RÉSERVÉ aux admin_national :
// le rôle de l'APPELANT est revérifié CÔTÉ SERVEUR (on ne fait pas confiance au client).
//
// La clé service_role n'est PAS dans le code : Supabase l'injecte automatiquement
// dans l'environnement de la fonction (SUPABASE_SERVICE_ROLE_KEY).
//
// APP_URL — URL publique de l'app, vers laquelle l'invité est redirigé après
// avoir cliqué dans l'e-mail d'invitation. À définir comme secret de fonction :
//   supabase secrets set APP_URL=https://mon-app.exemple.fr
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES = ['militant', 'referent', 'admin_national']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const appUrl = Deno.env.get('APP_URL')
  if (!appUrl) {
    return json(500, {
      error:
        "Configuration incomplète : le secret APP_URL n'est pas défini pour cette fonction.",
    })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    // 1) Identifier l'appelant via son JWT, et VÉRIFIER son rôle côté serveur.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!jwt) return json(401, { error: 'Non authentifié.' })
    const { data: u, error: uErr } = await admin.auth.getUser(jwt)
    if (uErr || !u?.user) return json(401, { error: 'Session invalide.' })

    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', u.user.id)
      .maybeSingle()
    if (caller?.role !== 'admin_national') {
      return json(403, { error: 'Réservé aux administrateurs nationaux.' })
    }

    // 2) Entrée
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return json(400, { error: 'E-mail invalide.' })
    const prenom = body.prenom ? String(body.prenom).trim() : null
    const nom = body.nom ? String(body.nom).trim() : null
    const departement = body.departement ? String(body.departement).trim() : null
    const role = ROLES.includes(body.role) ? body.role : 'militant'
    const referent_departement =
      role === 'referent'
        ? (body.referent_departement ? String(body.referent_departement).trim() : departement)
        : null
    if (role === 'referent' && !referent_departement) {
      return json(400, { error: 'Un référent doit avoir un département.' })
    }

    // 3) Liste blanche (pour passer is_member()).
    await admin
      .from('allowed_emails')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })

    // 4) Invitation par e-mail (API admin) → SMTP du projet (Brevo).
    let statut = 'invité'
    let userId: string | null = null
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: appUrl },
    )
    if (invErr) {
      const m = invErr.message.toLowerCase()
      if (m.includes('already') || m.includes('registered') || m.includes('exist')) {
        statut = 'déjà inscrit'
      } else {
        return json(400, { error: invErr.message })
      }
    } else {
      userId = inv?.user?.id ?? null
    }

    // Retrouver l'id si déjà inscrit (via le profil, alimenté par le trigger).
    if (!userId) {
      const { data: ex } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      userId = ex?.id ?? null
    }

    // 5) Pré-remplir le profil (le trigger guard_profile_role autorise le rôle
    //    car l'appel service_role a auth.uid() = null).
    if (userId) {
      const patch: Record<string, unknown> = { id: userId, email, role, referent_departement }
      if (prenom !== null) patch.prenom = prenom
      if (nom !== null) patch.nom = nom
      if (departement !== null) patch.departement = departement
      if (prenom && nom) patch.display_name = `${prenom} ${nom}`
      const { error: pErr } = await admin
        .from('profiles')
        .upsert(patch, { onConflict: 'id' })
      if (pErr) return json(500, { error: 'Profil non pré-rempli : ' + pErr.message })
    }

    return json(200, { ok: true, statut, email })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})
