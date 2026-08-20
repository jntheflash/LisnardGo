import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Message explicite plutôt qu'un crash opaque si le .env n'est pas configuré.
  console.error(
    '[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant. Copiez .env.example vers .env et renseignez vos clés.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** True si les variables d'environnement Supabase sont présentes. */
export const isSupabaseConfigured = Boolean(url && anonKey)
