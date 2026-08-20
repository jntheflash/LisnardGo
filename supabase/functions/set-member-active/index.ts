// Edge Function : set-member-active
// Désactive (soft-delete réversible) ou réactive un membre. RÉSERVÉ aux
// admin_national (rôle revérifié CÔTÉ SERVEUR → 403 sinon).
// Désactiver = is_active=false + BAN auth (ne peut plus se connecter). Réactiver = inverse.
// Garde-fous : pas d'auto-désactivation, pas de désactivation du DERNIER admin national.
// La clé service_role est injectée par Supabase (jamais dans le dépôt).
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    // 1) Appelant authentifié + admin_national (vérifié côté serveur)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!jwt) return json(401, { error: 'Non authentifié.' })
    const { data: u, error: uErr } = await admin.auth.getUser(jwt)
    if (uErr || !u?.user) return json(401, { error: 'Session invalide.' })
    const callerId = u.user.id
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()
    if (caller?.role !== 'admin_national') {
      return json(403, { error: 'Réservé aux administrateurs nationaux.' })
    }

    // 2) Entrée
    const body = await req.json().catch(() => ({}))
    const userId = String(body.user_id ?? '')
    const activate = body.active === true
    if (!userId) return json(400, { error: 'user_id manquant.' })

    const { data: target } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .maybeSingle()
    if (!target) return json(404, { error: 'Membre introuvable.' })

    // 3) Garde-fous (uniquement à la désactivation)
    if (!activate) {
      if (userId === callerId) {
        return json(400, { error: 'Vous ne pouvez pas vous désactiver vous-même.' })
      }
      if (target.role === 'admin_national') {
        const { count } = await admin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin_national')
          .eq('is_active', true)
        if ((count ?? 0) <= 1) {
          return json(400, {
            error: 'Impossible de désactiver le dernier administrateur national.',
          })
        }
      }
    }

    // 4) Bascule de l'état + ban/déban de l'authentification
    const { error: pErr } = await admin
      .from('profiles')
      .update({ is_active: activate })
      .eq('id', userId)
    if (pErr) return json(500, { error: pErr.message })

    const { error: bErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: activate ? 'none' : '876000h', // ~100 ans = bloqué
    })
    if (bErr) {
      return json(500, {
        error: 'Profil mis à jour mais ban/déban échoué : ' + bErr.message,
      })
    }

    return json(200, { ok: true, active: activate })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})
