/**
 * Paramètres métier centralisés — ajustables sans toucher au reste du code.
 */

/** Au-delà de ce nombre de jours depuis le dernier collage, un panneau est « périmé » (à refaire). */
export const REFRESH_THRESHOLD_DAYS = 14

/** Points gagnés par collage, pour chaque personne présente (calcul réel en base). */
export const POINTS_PAR_COLLAGE = 10

/** Couleurs des états — source unique (utilisée par le DOM et par Leaflet). */
export const COLORS = {
  a_faire: '#16a34a', // vert
  fait: '#2563eb', // bleu
  perime: '#dc2626', // rouge
} as const

/** Rayon (en mètres) du halo de « diffusion » dessiné autour des panneaux collés. */
export const DIFFUSION_RADIUS_M = 250

/** Réglages de la carte (emprise Nantes Métropole). */
export const MAP = {
  center: [47.23, -1.585] as [number, number],
  zoom: 11,
  minZoom: 9,
  maxZoom: 19,
} as const

/** Libellés et couleurs des états (pour filtres + légende). */
export const ETATS = {
  a_faire: { label: 'À faire', color: COLORS.a_faire },
  fait: { label: 'Fait', color: COLORS.fait },
  perime: { label: 'Périmé', color: COLORS.perime },
} as const
