import { REFRESH_THRESHOLD_DAYS } from '../config'
import type { PanneauEtat } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Nombre de jours entiers écoulés entre `date` et maintenant. */
export function joursDepuis(date: string | Date, now: Date = new Date()): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY)
}

/**
 * Calcule l'état d'un panneau à partir de la date de son dernier collage.
 * - null               → a_faire (jamais collé)
 * - ≤ seuil jours       → fait
 * - > seuil jours       → perime
 */
export function calculerEtat(
  dernierCollage: string | null,
  now: Date = new Date(),
): PanneauEtat {
  if (!dernierCollage) return 'a_faire'
  return joursDepuis(dernierCollage, now) <= REFRESH_THRESHOLD_DAYS
    ? 'fait'
    : 'perime'
}

/**
 * Compte à rebours avant péremption (dernier collage + seuil de 14 j).
 * S'affine selon le temps restant : « 12 jours » → « 22 h » → « 11 min » → « 30 s ».
 */
export function formatExpiration(
  dernierCollage: string,
  now: Date = new Date(),
): string {
  const expire =
    new Date(dernierCollage).getTime() + REFRESH_THRESHOLD_DAYS * MS_PER_DAY
  const ms = expire - now.getTime()
  if (ms <= 0) return 'Périmé'
  const heure = 3_600_000
  const minute = 60_000
  if (ms >= MS_PER_DAY) {
    const j = Math.floor(ms / MS_PER_DAY)
    return `Expire dans ${j} jour${j > 1 ? 's' : ''}`
  }
  if (ms >= heure) return `Expire dans ${Math.floor(ms / heure)} h`
  if (ms >= minute) return `Expire dans ${Math.floor(ms / minute)} min`
  return `Expire dans ${Math.floor(ms / 1000)} s`
}

/** Début de journée locale (minuit) d'une date. */
function debutDeJournee(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Formate une date ISO en libellé court FR, ou « jamais ».
 * Compte en jours DU CALENDRIER (minuit à minuit) : un collage fait hier soir
 * affiche « Hier », pas « Aujourd'hui ».
 */
export function formatDernierCollage(dernierCollage: string | null): string {
  if (!dernierCollage) return 'Jamais collé'
  const j = Math.round(
    (debutDeJournee(new Date()) - debutDeJournee(new Date(dernierCollage))) /
      MS_PER_DAY,
  )
  if (j <= 0) return "Aujourd'hui"
  if (j === 1) return 'Hier'
  return `Il y a ${j} jours`
}
