import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  loading: boolean // chargement initial de la session
  session: Session | null
  user: User | null
  profile: Profile | null
  isMember: boolean | null // null = en cours de vérification
  isAdmin: boolean
  /** Recharge le profil depuis la base (après onboarding p.ex.). */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isMember, setIsMember] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[Auth] Lecture du profil échouée :', error.message)
      return
    }
    setProfile(data as Profile | null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id)
  }, [session, fetchProfile])

  useEffect(() => {
    // Session initiale (persistée)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Écoute des changements (login, logout, refresh token)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Charge le profil + l'appartenance à la liste blanche quand l'utilisateur change
  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setIsMember(null)
      setIsAdmin(false)
      return
    }
    // Filet de sécurité : garantit une ligne profiles pour ce membre (en plus du
    // trigger), pour qu'il soit toujours recherchable comme partenaire.
    supabase
      .from('profiles')
      .upsert(
        { id: session.user.id, email: session.user.email },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .then(() => fetchProfile(session.user.id))
    fetchProfile(session.user.id)
    Promise.all([
      supabase.rpc('is_member'),
      supabase.rpc('is_admin'),
    ]).then(([m, a]) => {
      setIsMember(m.data === true)
      setIsAdmin(a.data === true)
    })
  }, [session, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setIsMember(null)
    setIsAdmin(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        profile,
        isMember,
        isAdmin,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
