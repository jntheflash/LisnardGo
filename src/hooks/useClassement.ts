import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ClassementEntry } from '../types'

/**
 * Lit le classement (vue SQL v_classement) trié par points décroissants.
 * Total = 10 × nombre de collages auxquels la personne a participé (valideur ou
 * partenaire), calculé en base — pas de compteur stocké, pas de bonus.
 */
export function useClassement() {
  const [rows, setRows] = useState<ClassementEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    // Tri par défaut (points) ; la page ré-ordonne selon l'onglet choisi.
    const { data, error } = await supabase
      .from('v_classement')
      .select('*')
      .order('total_points', { ascending: false })
      .order('display_name', { ascending: true })
    if (error) {
      setError('Impossible de charger le classement. Vérifiez votre connexion.')
      setLoading(false)
      return
    }
    setRows(data as ClassementEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { rows, loading, error, refresh: load }
}
