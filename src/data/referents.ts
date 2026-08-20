/**
 * Référents WhatsApp qui distribuent les affiches.
 *
 * Données 100 % statiques : pour mettre à jour, éditer CE seul fichier.
 * - REFERENT_NATIONAL : repli par défaut, toujours présent.
 * - REFERENTS_PAR_DEPARTEMENT : un référent par code département ('44', '75',
 *   '2A', '971'...). Les départements non listés retombent sur le national.
 *
 * Le contact affiché dépend du champ `departement` du profil du membre.
 */

export interface Referent {
  nom: string
  /** Format international, ex. « +33612345678 ». */
  telephone: string
  /** Message pré-rempli à l'ouverture de WhatsApp (facultatif). */
  messageWhatsappPreRempli?: string
}

/**
 * Référent national — repli quand le département n'a pas de référent.
 * ⚠️ Numéro de démonstration : remplacez-le par le vôtre avant tout déploiement.
 */
export const REFERENT_NATIONAL: Referent = {
  nom: 'Référent national',
  telephone: '+33600000000',
  messageWhatsappPreRempli:
    'Bonjour, je souhaite recevoir des affiches à coller.',
}

/**
 * Référents par code département. À compléter au fil de l'eau.
 * ⚠️ Numéros de démonstration : à remplacer par de vrais contacts.
 */
export const REFERENTS_PAR_DEPARTEMENT: Record<string, Referent> = {
  '44': {
    nom: 'Référent Loire-Atlantique',
    telephone: '+33600000000',
    messageWhatsappPreRempli:
      'Bonjour, je souhaite recevoir des affiches à coller à Nantes.',
  },
}

export interface ReferentResolu {
  referent: Referent
  estNational: boolean
}

/**
 * Résout le référent à afficher pour un département donné.
 * Renvoie TOUJOURS un référent (repli national si le département est absent).
 */
export function resoudreReferent(departement?: string | null): ReferentResolu {
  if (departement && REFERENTS_PAR_DEPARTEMENT[departement]) {
    return { referent: REFERENTS_PAR_DEPARTEMENT[departement], estNational: false }
  }
  return { referent: REFERENT_NATIONAL, estNational: true }
}

/**
 * Lien wa.me : numéro en chiffres seuls (sans « + » ni symboles) + message
 * pré-rempli encodé s'il existe.
 */
export function lienWhatsapp(referent: Referent): string {
  const numero = referent.telephone.replace(/\D/g, '')
  const base = `https://wa.me/${numero}`
  return referent.messageWhatsappPreRempli
    ? `${base}?text=${encodeURIComponent(referent.messageWhatsappPreRempli)}`
    : base
}
