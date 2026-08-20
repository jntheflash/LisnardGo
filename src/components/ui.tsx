import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  children: ReactNode
}

/** Bouton plein, zone tactile large (mobile-first). */
export function Button({
  loading,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {loading && <Spinner className="h-5 w-5" />}
      {children}
    </button>
  )
}

/** Pleine page de chargement / centrage vertical. */
export function FullScreenCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </div>
  )
}
