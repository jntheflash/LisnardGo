import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calculerEtat } from '../lib/etat'
import type { PanneauAvecEtat } from '../types'

/** Infos minimales du colleur pour la mise à jour optimiste. */
export interface Collageur {
  id: string
  nom: string | null
  twitter: string | null
  linkedin: string | null
}

interface Row {
  id: string
  id_inventaire: string | null
  commune: string | null
  quartier: string | null
  secteur: string | null
  nom_voie: string | null
  complement_adresse: string | null
  lat: number
  lng: number
  source: 'officiel' | 'manuel'
  created_by: string | null
  departement: string | null
  dernier_collage: string | null
  dernier_collage_par: string | null
  dernier_collage_par_nom: string | null
  dernier_collage_par_twitter: string | null
  dernier_collage_par_linkedin: string | null
}

/**
 * Charge tous les panneaux + leur dernier collage, et calcule l'état côté client
 * (seuil 14 j → src/config.ts). Expose une mise à jour optimiste après un collage.
 */
export function usePanneaux() {
  const [panneaux, setPanneaux] = useState<PanneauAvecEtat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase
      .from('v_panneaux_dernier_collage')
      .select('*')
    if (error) {
      setError('Impossible de charger les panneaux. Vérifiez votre connexion.')
      setLoading(false)
      return
    }
    const rows = (data as Row[]).map((r) => ({
      ...r,
      etat: calculerEtat(r.dernier_collage),
    }))
    setPanneaux(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Met à jour localement un panneau comme "fait" à l'instant (après un collage). */
  const marquerFait = useCallback(
    (panneauId: string, dateISO: string, collageur: Collageur) => {
      setPanneaux((prev) =>
        prev.map((p) =>
          p.id === panneauId
            ? {
                ...p,
                dernier_collage: dateISO,
                dernier_collage_par: collageur.id,
                dernier_collage_par_nom: collageur.nom,
                dernier_collage_par_twitter: collageur.twitter,
                dernier_collage_par_linkedin: collageur.linkedin,
                etat: calculerEtat(dateISO),
              }
            : p,
        ),
      )
    },
    [],
  )

  /** Recharge l'état réel d'un seul panneau (après une annulation de collage). */
  const rafraichirPanneau = useCallback(
    async (panneauId: string): Promise<PanneauAvecEtat | null> => {
      const { data, error } = await supabase
        .from('v_panneaux_dernier_collage')
        .select('*')
        .eq('id', panneauId)
        .maybeSingle()
      if (error || !data) return null
      const r = data as Row
      const updated: PanneauAvecEtat = {
        ...r,
        etat: calculerEtat(r.dernier_collage),
      }
      setPanneaux((prev) => prev.map((p) => (p.id === panneauId ? updated : p)))
      return updated
    },
    [],
  )

  /** Ajoute un panneau localement (après création manuelle). */
  const ajouterPanneau = useCallback((p: PanneauAvecEtat) => {
    setPanneaux((prev) => [...prev, p])
  }, [])

  /** Retire un panneau localement (après suppression manuelle). */
  const retirerPanneau = useCallback((panneauId: string) => {
    setPanneaux((prev) => prev.filter((p) => p.id !== panneauId))
  }, [])

  return {
    panneaux,
    loading,
    error,
    refresh: load,
    marquerFait,
    rafraichirPanneau,
    ajouterPanneau,
    retirerPanneau,
  }
}
