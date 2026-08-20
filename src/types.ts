/** État calculé d'un panneau à partir de son dernier collage. */
export type PanneauEtat = 'a_faire' | 'fait' | 'perime'

/** Panneau d'affichage libre (officiel) ou ajouté manuellement. */
export interface Panneau {
  id: string // uuid
  id_inventaire: string | null // ex. AL_NM_08_0009 (officiels)
  commune: string | null
  quartier: string | null
  secteur: string | null
  nom_voie: string | null
  complement_adresse: string | null
  lat: number
  lng: number
  source: 'officiel' | 'manuel'
  created_by: string | null // user_id du créateur (panneaux manuels)
  departement: string | null // code département (ex. '44', '35')
}

/** Un collage = une validation d'affichage par un militant à un instant donné. */
export interface Collage {
  id: string
  panneau_id: string
  user_id: string
  created_at: string // ISO timestamptz
}

/** Profil public d'un militant. */
export interface Profile {
  id: string // = auth.users.id
  email: string
  prenom: string | null
  nom: string | null
  departement: string | null // code du département de référence (ex. '44', '2A', '971')
  role: 'militant' | 'referent' | 'admin_national'
  referent_departement: string | null // dépt administré (uniquement pour les référents)
  display_name: string | null // = « Prénom Nom », maintenu par l'app
  twitter: string | null // pseudo X/Twitter (sans @)
  linkedin: string | null // URL du profil LinkedIn
  created_at: string
}

/** Panneau enrichi de l'info de son dernier collage (pour la carte). */
export interface PanneauAvecEtat extends Panneau {
  dernier_collage: string | null // ISO ou null si jamais collé
  dernier_collage_par: string | null // user_id du dernier collage (null si jamais collé)
  dernier_collage_par_nom: string | null // display_name du dernier colleur
  dernier_collage_par_twitter: string | null
  dernier_collage_par_linkedin: string | null
  etat: PanneauEtat
}

/** Ligne du classement. */
export interface ClassementEntry {
  user_id: string
  display_name: string
  total_points: number
  nb_collages: number
  nb_collages_mois: number
  nb_sorties: number
}
