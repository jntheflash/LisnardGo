/** Construit l'URL X/Twitter à partir d'un pseudo (avec ou sans @). */
export function twitterUrl(handle: string): string {
  return `https://x.com/${handle.trim().replace(/^@/, '')}`
}

/** Normalise une valeur LinkedIn (URL complète ou identifiant) en URL. */
export function linkedinUrl(value: string): string {
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  return `https://www.linkedin.com/in/${v.replace(/^\/+/, '')}`
}
