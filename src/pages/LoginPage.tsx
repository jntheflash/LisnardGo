import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

type Step = 'email' | 'code'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Adresse e-mail invalide.')
      return
    }
    setLoading(true)
    // Accès sur invitation : on vérifie que l'e-mail est autorisé avant tout envoi.
    const { data: autorise, error: checkErr } = await supabase.rpc(
      'is_email_allowed',
      { p_email: trimmed },
    )
    if (checkErr) {
      setLoading(false)
      setError('Problème de réseau. Vérifiez votre connexion.')
      return
    }
    if (autorise !== true) {
      setLoading(false)
      setError(
        "Cet e-mail n'est pas autorisé. Contactez l'organisateur pour être ajouté.",
      )
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setError(traduireErreur(error.message))
      return
    }
    setEmail(trimmed)
    setStep('code')
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const token = code.trim()
    if (token.length !== 6) {
      setError('Entrez les 6 chiffres du code reçu par e-mail.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setError(traduireErreur(error.message))
      return
    }
    // La session est posée → AuthProvider prend le relais (onAuthStateChange).
  }

  return (
    <div className="flex h-dvh flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="mx-auto mb-3 rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-slate-900">LisnardGo</h1>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Votre e-mail
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.fr"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {error && <p className="text-sm text-perime">{error}</p>}
            <Button type="submit" loading={loading}>
              Recevoir mon code
            </Button>
            <p className="text-center text-xs text-slate-400">
              Nous vous envoyons un code par e-mail. Pas de mot de passe.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-center text-sm text-slate-600">
              Code envoyé à <span className="font-medium">{email}</span>
            </p>
            <div>
              <label
                htmlFor="code"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Code reçu par e-mail
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="••••••"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-center text-2xl tracking-[0.3em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {error && <p className="text-sm text-perime">{error}</p>}
            <Button type="submit" loading={loading} disabled={code.length !== 6}>
              Se connecter
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              className="w-full text-center text-sm text-slate-500 underline"
            >
              Changer d'e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/** Messages d'erreur Supabase → français lisible. */
function traduireErreur(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('token has expired') || m.includes('expired'))
    return 'Code expiré. Demandez un nouveau code.'
  if (m.includes('invalid') && m.includes('token'))
    return 'Code incorrect. Vérifiez les 6 chiffres.'
  if (
    m.includes('security purposes') ||
    (m.includes('after') && m.includes('second'))
  )
    return 'Patientez une minute avant de redemander un code.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Trop de demandes de code. Réessayez dans quelques minutes.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Problème de réseau. Vérifiez votre connexion.'
  return 'Une erreur est survenue. Réessayez.'
}
