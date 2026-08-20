import L from 'leaflet'
import { COLORS } from '../config'
import type { PanneauEtat } from '../types'

/**
 * Images du marqueur « fait ».
 *
 * Par défaut : marqueur générique livré avec le dépôt (aucun droit à l'image
 * en jeu). Pour afficher le visage de votre candidat à la place :
 *   1. déposez son portrait dans `public/markers/portrait.png` ;
 *   2. lancez `npm run marker` (génère portrait-marker.png + portrait-round.png) ;
 *   3. remplacez les deux constantes ci-dessous par :
 *        '/markers/portrait-marker.png'  et  '/markers/portrait-round.png'.
 * Ces fichiers `portrait*` sont exclus du dépôt par `.gitignore` : l'image
 * reste locale et n'est jamais publiée.
 */
export const ICONE_FAIT_URL = '/markers/marqueur-fait.svg'
export const ICONE_FAIT_RONDE_URL = '/markers/marqueur-fait-rond.svg'

/** Pin coloré (SVG) pour les états a_faire / perime. */
function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'panneau-pin',
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 37C14 37 26 22 26 13A12 12 0 1 0 2 13C2 22 14 37 14 37Z"
            fill="${color}" stroke="white" stroke-width="2.5"/>
      <circle cx="14" cy="13" r="4.5" fill="white"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 37],
    popupAnchor: [0, -34],
  })
}

/** Marqueur « fait » (cf. ICONE_FAIT_URL pour le personnaliser). */
const faitIcon: L.Icon = L.icon({
  iconUrl: ICONE_FAIT_URL,
  iconSize: [44, 55],
  iconAnchor: [22, 55], // pointe en bas au centre
  popupAnchor: [0, -52],
})

const aFaireIcon = pinIcon(COLORS.a_faire) // vert
const perimeIcon = pinIcon(COLORS.perime) // rouge

export function iconPourEtat(etat: PanneauEtat): L.Icon | L.DivIcon {
  switch (etat) {
    case 'fait':
      return faitIcon
    case 'perime':
      return perimeIcon
    case 'a_faire':
    default:
      return aFaireIcon
  }
}
