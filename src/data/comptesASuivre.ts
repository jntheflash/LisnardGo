/**
 * Annuaire « À suivre » — comptes officiels à suivre (national + local).
 *
 * Données 100 % statiques : pour mettre à jour l'annuaire, il suffit d'éditer
 * CE seul fichier (ajouter/retirer un compte, coller les vraies URLs).
 * Les réseaux dont l'URL est vide ne sont pas affichés sur la page.
 */

export type Reseau = 'x' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'site'

export interface LienCompte {
  reseau: Reseau
  url: string
}

export interface Compte {
  id: string
  nom: string
  role: string // courte description
  liens: LienCompte[]
}

export const COMPTES_NATIONAL: Compte[] = [
  {
    id: 'national-1',
    nom: 'Compte national 1',
    role: 'Courte description (à compléter)',
    liens: [
      { reseau: 'x', url: '' },
      { reseau: 'instagram', url: '' },
      { reseau: 'facebook', url: '' },
      { reseau: 'youtube', url: '' },
      { reseau: 'site', url: '' },
    ],
  },
  {
    id: 'national-2',
    nom: 'Compte national 2',
    role: 'Courte description (à compléter)',
    liens: [
      { reseau: 'x', url: '' },
      { reseau: 'tiktok', url: '' },
      { reseau: 'site', url: '' },
    ],
  },
]

export const COMPTES_LOCAL: Compte[] = [
  {
    id: 'local-1',
    nom: 'Compte local 1',
    role: 'Courte description (à compléter)',
    liens: [
      { reseau: 'x', url: '' },
      { reseau: 'instagram', url: '' },
      { reseau: 'facebook', url: '' },
    ],
  },
  {
    id: 'local-2',
    nom: 'Compte local 2',
    role: 'Courte description (à compléter)',
    liens: [
      { reseau: 'instagram', url: '' },
      { reseau: 'site', url: '' },
    ],
  },
]
