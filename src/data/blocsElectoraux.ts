/** Constantes du calque électoral (blocs, couleurs, scrutins). */

export type BlocKey = 'G' | 'C' | 'D' | 'ED'
export type Scrutin = 'p22' | 'e24'

export const BLOC_LABELS: Record<BlocKey, string> = {
  G: 'Gauche',
  C: 'Centre',
  D: 'Droite',
  ED: 'Extrême droite',
}

export const BLOC_COLORS: Record<BlocKey, string> = {
  G: '#e23b3b', // rouge
  C: '#f4a91f', // orange/ambre
  D: '#2f6fed', // bleu
  ED: '#5b3a29', // brun foncé
}

/** Couleur des bureaux sans résultat pour le scrutin (gris neutre). */
export const BLOC_NEUTRE = '#cbd5e1'

export const SCRUTINS: { key: Scrutin; label: string }[] = [
  { key: 'p22', label: 'Présidentielle 2022' },
  { key: 'e24', label: 'Européennes 2024' },
]

export const ORDRE_BLOCS: BlocKey[] = ['G', 'C', 'D', 'ED']
/** Sous-ensemble « droites » (mode « Droites uniquement »). */
export const DROITE_BLOCS: BlocKey[] = ['C', 'D', 'ED']

/**
 * Opacité du remplissage selon le score (%) du bloc en tête : un bureau gagné
 * de justesse est plus pâle qu'un bastion. Bornée pour rester lisible.
 */
export const opaciteBloc = (pct: number) =>
  Math.max(0.15, Math.min(0.78, (pct - 25) / 45))

/**
 * Mode « droites » : opacité selon la PART AU SEIN DES DROITES (Centre+Droite+
 * Extrême droite ramenés à 100 %) du bloc en tête, sinon la carte serait pâle.
 */
export const opaciteDroites = (partPct: number) =>
  Math.max(0.18, Math.min(0.85, (partPct - 34) / 56))

/** Métadonnée d'un candidat/liste (libellé + bloc), partagée pour tous les bureaux. */
export interface PartiMeta {
  l: string
  b: BlocKey | 'AUTRE'
}

/** Score pré-calculé d'un bureau pour un scrutin (cf. GeoJSON enrichi). */
export interface ScoreBureau {
  lead: BlocKey
  leadPct: number
  G: number
  C: number
  D: number
  ED: number
  v: number[] // % exprimés par candidat/liste, dans l'ordre de PARTIES[scrutin]
}
