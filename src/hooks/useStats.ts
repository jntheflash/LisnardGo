import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface MonthBucket {
  key: string // "YYYY-M"
  label: string // "juin", "mai 27"…
  count: number // collages réalisés CE mois (non cumulé)
}

export interface Stats {
  totalCollages: number // nombre total de collages (actions)
  nbArtistes: number // colleurs distincts
  panneauxCollesEver: number // panneaux distincts collés au moins une fois
  serie: MonthBucket[] // collages par mois jusqu'à mai 2027
}

const MOIS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]
const FIN_ANNEE = 2027
const FIN_MOIS = 4 // mai (0-indexé)

interface Row {
  created_at: string
  user_id: string
  panneau_id: string
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('collages')
        .select('created_at, user_id, panneau_id')
      if (error) {
        if (!cancelled) {
          setError('Impossible de charger les statistiques.')
          setLoading(false)
        }
        return
      }
      const rows = data as Row[]
      const now = new Date()

      const artistes = new Set<string>()
      const panneaux = new Set<string>()
      const counts = new Map<string, number>()
      // Début de la série = mois du 1er collage (ou mois courant si aucun)
      let startY = now.getFullYear()
      let startM = now.getMonth()

      for (const r of rows) {
        artistes.add(r.user_id)
        panneaux.add(r.panneau_id)
        const d = new Date(r.created_at)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
        if (
          d.getFullYear() < startY ||
          (d.getFullYear() === startY && d.getMonth() < startM)
        ) {
          startY = d.getFullYear()
          startM = d.getMonth()
        }
      }

      const serie: MonthBucket[] = []
      let y = startY
      let m = startM
      while (y < FIN_ANNEE || (y === FIN_ANNEE && m <= FIN_MOIS)) {
        const key = `${y}-${m}`
        const label =
          y === now.getFullYear()
            ? MOIS[m]
            : `${MOIS[m]} ${String(y).slice(2)}`
        serie.push({ key, label, count: counts.get(key) ?? 0 })
        m += 1
        if (m > 11) {
          m = 0
          y += 1
        }
      }

      if (!cancelled) {
        setStats({
          totalCollages: rows.length,
          nbArtistes: artistes.size,
          panneauxCollesEver: panneaux.size,
          serie,
        })
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { stats, loading, error }
}
