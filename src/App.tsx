import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { useOnline } from './hooks/useOnline'
import { FullScreenCenter, Spinner } from './components/ui'
import { isSupabaseConfigured } from './lib/supabase'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import MapPage from './pages/MapPage'
import StatsPage from './pages/StatsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import AdministrationPage from './pages/AdministrationPage'
import PrivacyPage from './pages/PrivacyPage'

export default function App() {
  const { loading, session, profile, isMember, signOut } = useAuth()
  const online = useOnline()

  // Garde-fou : .env non configuré
  if (!isSupabaseConfigured) {
    return (
      <FullScreenCenter>
        <p className="text-perime">
          Configuration Supabase manquante. Copiez <code>.env.example</code> vers{' '}
          <code>.env</code> et renseignez vos clés.
        </p>
      </FullScreenCenter>
    )
  }

  // Chargement initial de la session
  if (loading) {
    return (
      <FullScreenCenter>
        <Spinner className="h-8 w-8 text-brand" />
      </FullScreenCenter>
    )
  }

  // Non connecté → écran de connexion OTP
  if (!session) return <LoginPage />

  // Vérification de l'appartenance à la liste blanche en cours
  if (isMember === null) {
    return (
      <FullScreenCenter>
        <Spinner className="h-8 w-8 text-brand" />
      </FullScreenCenter>
    )
  }

  // E-mail non autorisé → accès refusé
  if (!isMember) {
    return (
      <FullScreenCenter>
        <div className="space-y-3">
          <p className="text-2xl">🔒</p>
          <h1 className="text-xl font-bold text-slate-900">Accès réservé</h1>
          <p className="text-sm text-slate-500">
            Votre e-mail n'est pas (encore) autorisé à utiliser l'application.
            Contactez l'organisateur pour être ajouté à la liste des adhérents.
          </p>
          <button
            onClick={signOut}
            className="mt-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Se déconnecter
          </button>
        </div>
      </FullScreenCenter>
    )
  }

  // Connecté mais prénom/nom/département manquant → profil à compléter
  if (!profile?.prenom || !profile?.nom || !profile?.departement)
    return <OnboardingPage />

  // App principale
  return (
    <div className="flex h-full flex-col bg-slate-100">
      {!online && (
        <div className="shrink-0 bg-perime px-4 py-1.5 text-center text-xs font-medium text-white">
          Hors ligne — les actions seront indisponibles tant que le réseau ne
          revient pas.
        </div>
      )}
      <main className="relative min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/classement" element={<LeaderboardPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/administration" element={<AdministrationPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
          {/* Ancienne route fusionnée : on redirige vers la page unique */}
          <Route path="/admin" element={<Navigate to="/administration" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
