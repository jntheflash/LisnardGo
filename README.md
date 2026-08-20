<div align="center">

<img src="public/icons/icon.svg" width="96" alt="">

# LisnardGo

**Application web mobile (PWA) de suivi de collage sur les panneaux
d'affichage libre, pour une campagne électorale.**

Les militants ouvrent la carte, voient les panneaux autour d'eux, et valident
un collage d'un tap. L'équipe voit en temps réel ce qui est couvert, ce qui est
à refaire, et qui a fait quoi.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)

</div>

---

## Le problème

Coller des affiches sur les panneaux d'affichage libre, c'est une opération de
terrain qui échoue toujours au même endroit : **personne ne sait qui a collé
quoi, ni quand**. On recolle trois fois le même panneau du centre-ville, on
oublie ceux de la périphérie, et les affiches d'un quartier entier sont
périmées depuis trois semaines sans que personne ne s'en aperçoive.

LisnardGo transforme ça en une carte à trois couleurs, mise à jour par les
militants eux-mêmes, sans coordination manuelle.

| État | Signification |
|---|---|
| 🟢 **À faire** | Jamais collé, ou aucun collage enregistré |
| 🔵 **Fait** | Collé il y a **14 jours ou moins** |
| 🔴 **Périmé** | Dernier collage il y a **plus de 14 jours** — à refaire |

Le seuil est un paramètre unique (`REFRESH_THRESHOLD_DAYS` dans
[`src/config.ts`](src/config.ts)).

---

## Captures d'écran

> Déposez vos captures dans [`docs/screenshots/`](docs/screenshots/) — les
> emplacements ci-dessous sont déjà câblés.

<div align="center">

| Carte | Fiche panneau | Partenaires |
|:---:|:---:|:---:|
| <img src="docs/screenshots/carte.png" width="240" alt="Carte des panneaux"> | <img src="docs/screenshots/panneau.png" width="240" alt="Fiche d'un panneau"> | <img src="docs/screenshots/partenaires.png" width="240" alt="Sélection des partenaires"> |

| Classement | Statistiques | Calque électoral |
|:---:|:---:|:---:|
| <img src="docs/screenshots/classement.png" width="240" alt="Classement"> | <img src="docs/screenshots/stats.png" width="240" alt="Statistiques"> | <img src="docs/screenshots/electoral.png" width="240" alt="Calque électoral"> |

</div>

---

## Fonctionnalités

### 🔐 Connexion par code OTP, sur liste blanche

Pas de mot de passe. On saisit son e-mail, on reçoit un **code à 6 chiffres**,
on entre dans l'app. L'e-mail est vérifié **avant** l'envoi du code contre une
liste blanche (`allowed_emails`) : un e-mail non autorisé ne reçoit jamais de
message. À la première connexion, un **onboarding** demande prénom, nom et
département de rattachement.

### 🗺️ Carte Leaflet, pensée pour le terrain

- Fond de carte **CartoDB** (tuiles OSM), **mises en cache par le service
  worker** — la carte reste lisible avec un réseau instable.
- **Clustering** (`leaflet.markercluster`) : au-dessus d'un certain zoom, les
  panneaux se regroupent ; un cluster dont **tous** les panneaux sont collés
  prend le marqueur « fait ».
- **Filtres d'état** (Tout / À faire / Fait / Périmé) et sélecteur de zone.
- **Halo de diffusion** de 250 m autour des panneaux collés, pour visualiser la
  couverture réelle plutôt que des points isolés.
- **Géolocalisation** et recentrage ; la position de carte est **mémorisée**
  entre deux sessions.
- **Appui long** sur la carte (0,8 s, immobile) → **création d'un panneau
  manuel** là où il en manque un dans l'inventaire officiel.

### ✅ Validation d'un collage en deux étapes

La fiche d'un panneau est une *bottom sheet* à étapes : détails du panneau →
**« avec qui ? »** → confirmation.

### 👥 Tagging de partenaires

On ne colle jamais seul. À la validation, on **tague les personnes présentes** :
recherche serveur insensible à la casse et **aux accents** (fonction
`search_members`, extension `unaccent`), plus des **suggestions** basées sur
vos partenaires récents puis les colleurs récents (`suggested_partners`).
Chaque personne taguée marque les points du collage, exactement comme le
valideur.

### 🏆 Classement par points

**10 points par collage, pour chaque personne présente.** Pas de bonus, pas de
compteur stocké : tout est recalculé en base par la vue `v_classement`
(mois / total / sorties / points). Le classement n'expose **jamais** d'adresse
e-mail — uniquement le nom d'affichage.

### 📊 Statistiques

Collages totaux, colleurs distincts, panneaux couverts au moins une fois, et
**série mensuelle** jusqu'à l'échéance de campagne.

### 🏛️ Calque de résultats électoraux

Superposition des **résultats par bureau de vote** — présidentielle 2022 et
européennes 2024 — agrégés en quatre blocs (gauche / centre / droite / extrême
droite), avec un mode **« droites uniquement »** et le détail parti par parti
au clic. Sert à prioriser le collage sur les bureaux stratégiques.

### 🎖️ Rôles et périmètres

| Rôle | Périmètre |
|---|---|
| `militant` | Voit la carte, valide ses collages, gère ses propres panneaux manuels |
| `referent` | + voit les profils **de son département** et modère leurs panneaux manuels |
| `admin_national` | + voit tous les profils, invite, désactive, modère partout |

Les droits sont appliqués **côté serveur** par des policies RLS Postgres, pas
côté client : masquer un bouton ne protège rien.

### 🛠️ Tableau de bord d'administration

Invitation de membres par e-mail (avec pré-remplissage prénom / nom /
département / rôle), attribution des rôles, **désactivation douce et
réversible** d'un membre (ses collages passés continuent de compter), et
modération des panneaux manuels. Les opérations sensibles passent par des
**Edge Functions** qui **revérifient le rôle de l'appelant côté serveur**.

### 🏙️ Multi-villes

Rien n'est câblé sur une ville. Les panneaux portent un `departement`, les
profils aussi, les référents WhatsApp sont résolus par département, et le
sélecteur de zones est une simple liste dans
[`src/data/zones.ts`](src/data/zones.ts). Le jeu de données fourni couvre
Nantes Métropole ; en ajouter d'autres ne demande qu'un import.

### 📱 PWA installable et tolérante au réseau

Manifest, icônes, installation sur l'écran d'accueil, mise à jour automatique,
bandeau « hors ligne » explicite, et cache des tuiles pour 30 jours.

---

## Stack

| Couche | Choix |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite 8 · React Router 7 |
| **Style** | Tailwind CSS v4 (plugin Vite, sans fichier de config) |
| **Carte** | Leaflet 1.9 · react-leaflet 5 · leaflet.markercluster · tuiles CartoDB/OSM |
| **PWA** | `vite-plugin-pwa` (Workbox) |
| **Backend** | Supabase — Postgres, Auth OTP e-mail, **RLS**, vues, RPC, Edge Functions (Deno) |
| **Hébergement** | Vercel (frontend) · Supabase région EU (backend) |
| **Outillage** | ESLint 10 · tsx · sharp (génération d'icônes) |

Aucun backend maison : **il n'y a pas de serveur applicatif à opérer**.

---

## Choix d'architecture

Les décisions structurantes, et pourquoi.

**La sécurité vit dans la base, pas dans le client.**
Toutes les règles d'accès sont des policies RLS Postgres. Le client Supabase
utilise la clé anonyme et n'a littéralement pas les droits de faire ce qu'il ne
doit pas faire. Les fonctions d'appartenance (`is_member`, `is_admin_national`,
`is_referent`) sont `security definer` pour éviter la récursion des policies.
Les deux Edge Functions revérifient le rôle de l'appelant à partir de son JWT
avant d'agir : **on ne fait jamais confiance au client**.

**Aucun compteur stocké.**
Points, classements et statistiques sont des **vues calculées à la volée**.
Il n'existe pas de colonne `total_points` à maintenir, donc pas de compteur qui
dérive, pas de tâche de recalcul, pas de désynchronisation après une
suppression. Le prix : quelques agrégats à chaque chargement — négligeable à
l'échelle d'une campagne.

**L'état d'un panneau est calculé, pas stocké.**
`a_faire` / `fait` / `perime` se déduit de la date du dernier collage
([`src/lib/etat.ts`](src/lib/etat.ts)). Changer le seuil de fraîcheur est un
changement d'une ligne, sans migration.

**Suppression douce partout.**
Désactiver un membre ne détruit rien : ses collages continuent de compter, pour
lui comme pour ses anciens partenaires. Supprimer un panneau manuel pose un
`deleted_at`. Les panneaux **officiels** ne sont modifiables par personne —
aucune policy ne l'autorise.

**La table `profiles` est verrouillée, les vues sont le point d'attention.**
`profiles` est en « chacun ne lit que sa ligne », élargie explicitement au
référent de son département et à l'admin national ; les colonnes `email`,
`role` et `referent_departement` sont en plus protégées par des triggers, car
une policy RLS ne peut pas comparer l'ancienne et la nouvelle valeur. En
revanche les **vues Postgres contournent la RLS par construction** (elles
s'exécutent avec les droits de leur propriétaire) : leur clause
`where is_member()` est le seul filtre. `v_classement` et la vue de carte
n'exposent que `display_name` ; `v_members` expose délibérément l'e-mail aux
autres membres, pour la recherche de partenaires.

**Les données de référence sont des fichiers TypeScript, pas des tables.**
Départements, zones, référents WhatsApp, blocs électoraux : des constantes
typées dans [`src/data/`](src/data/). Elles changent une fois par campagne — une
table et une interface d'admin auraient coûté plus cher que le problème.

**Un seul jeu de couleurs.**
[`src/config.ts`](src/config.ts) est la source unique pour les couleurs d'état,
partagée par le DOM et par Leaflet. Pas de hex dupliqué entre le CSS et le JS.

**Hors ligne assumé, pas simulé.**
Les tuiles sont cachées pour que la carte reste lisible sur le terrain, mais
les écritures nécessitent le réseau et le disent franchement (bandeau « hors
ligne ») plutôt que de faire semblant avec une file de synchronisation.

---

## Installation

### Prérequis

- **Node.js ≥ 20** (testé avec Node 24) — avec `nvm` : `nvm use` lit
  [`.nvmrc`](.nvmrc).
- Un projet **Supabase** (l'offre gratuite suffit), de préférence en **région
  EU** si vous traitez des données de militants européens.
- La **CLI Supabase** pour déployer les Edge Functions.

### 1. Cloner et installer

```bash
npm install
```

### 2. Créer le schéma

Dans le **SQL Editor** de Supabase, exécutez les fichiers de
[`supabase/`](supabase/) **dans cet ordre** (chacun est idempotent) :

| Ordre | Fichier | Rôle |
|---|---|---|
| 1 | [`schema.sql`](supabase/schema.sql) | Tables, RLS, vues de calcul, RPC, suppression de compte |
| 2 | [`add_departement.sql`](supabase/add_departement.sql) | Colonne `departement` sur les profils |
| 3 | [`roles_admin.sql`](supabase/roles_admin.sql) | Rôles, référents, policies d'administration |
| 4 | [`search_members.sql`](supabase/search_members.sql) | Recherche de partenaires (extension `unaccent`) |
| 5 | [`view_departement.sql`](supabase/view_departement.sql) | Recrée la vue carte avec le département |
| 6 | [`disable_member.sql`](supabase/disable_member.sql) | Désactivation douce d'un membre |

Chaque fichier s'exécute **d'une traite sur une base vierge** et peut être
rejoué sans effet de bord.

### 3. Configurer l'authentification

1. **Authentication → Providers → Email** : désactivez *Confirm email*
   (connexion par code OTP).
2. **Authentication → Email Templates → Magic Link** : incluez `{{ .Token }}`
   pour que le code à 6 chiffres apparaisse dans l'e-mail.
3. Configurez un **SMTP** (l'envoi par défaut de Supabase est fortement limité).

### 4. Renseigner les variables d'environnement

```bash
cp .env.example .env
```

Puis remplissez depuis **Project Settings → API** :

| Variable | Où | Nature |
|---|---|---|
| `VITE_SUPABASE_URL` | navigateur | publique |
| `VITE_SUPABASE_ANON_KEY` | navigateur | publique (protégée par la RLS) |
| `SUPABASE_URL` | script d'import | — |
| `SUPABASE_SERVICE_ROLE_KEY` | script d'import | 🔴 **secrète** — ignore la RLS, jamais côté client |
| `APP_URL` | Edge Function | secret de fonction (voir ci-dessous) |

### 5. Importer les panneaux

```bash
npm run import
```

Lit [`data/panneaux.geojson`](data/panneaux.geojson), ne garde que les panneaux
de statut **« Monté »** (468 sur 489 — les *Démonté / Supprimé / Projet*
n'existent pas physiquement), et fait un **upsert idempotent** : ré-exécutable
sans créer de doublon.

### 6. Déployer les Edge Functions

```bash
supabase functions deploy invite-member
supabase functions deploy set-member-active
supabase secrets set APP_URL=https://mon-app.exemple.fr
```

`APP_URL` est l'URL publique de l'app : c'est la cible de redirection du lien
d'invitation. Sans ce secret, `invite-member` renvoie une erreur explicite.

### 7. Créer le premier administrateur

Connectez-vous une première fois pour que votre profil existe, puis exécutez
dans le SQL Editor (bloc commenté en fin de
[`roles_admin.sql`](supabase/roles_admin.sql)) :

```sql
insert into public.allowed_emails (email) values ('votre-email@exemple.fr')
  on conflict do nothing;

update public.profiles
   set role = 'admin_national'
 where id = (select id from auth.users
              where lower(email) = 'votre-email@exemple.fr');
```

À partir de là, tout se fait depuis l'onglet **Administration** de l'app.

### 8. Lancer en local

```bash
npm run dev
```

→ http://localhost:5173

---

## Déploiement (Vercel)

```bash
npm run build
```

Importez le dépôt sur Vercel — le framework **Vite** est détecté
automatiquement. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans
*Settings → Environment Variables*. Build : `npm run build`, sortie : `dist`.

[`vercel.json`](vercel.json) réécrit toutes les routes vers `index.html` (SPA).

---

## Marqueur : utiliser le visage de votre candidat

Le dépôt est livré avec un **marqueur générique** — aucune photo de personne
n'y est distribuée. Pour afficher un portrait à la place :

1. déposez l'image dans `public/markers/portrait.png` (carrée, visage centré) ;
2. générez les variantes :
   ```bash
   npm run marker
   ```
   → `portrait-marker.png` (pin de carte) et `portrait-round.png` (clusters) ;
3. dans [`src/lib/markers.ts`](src/lib/markers.ts), pointez les deux constantes
   `ICONE_FAIT_URL` et `ICONE_FAIT_RONDE_URL` vers ces fichiers ;
4. facultatif — icônes PWA dérivées du portrait : `npm run appicons`
   (⚠️ écrase les icônes génériques de `public/icons/`).

Les fichiers `portrait*` sont **exclus du dépôt** par
[`.gitignore`](.gitignore) : l'image reste locale.

> ⚖️ **Droits.** Un portrait engage à la fois le droit d'auteur du photographe
> et le droit à l'image de la personne. Assurez-vous d'être autorisé à
> l'utiliser : il n'est couvert ni par la licence MIT de ce dépôt, ni par les
> licences des jeux de données.

---

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (`tsc -b` + Vite) |
| `npm run preview` | Prévisualise le build |
| `npm run lint` | ESLint |
| `npm run import` | Importe les panneaux dans Supabase (idempotent) |
| `npm run icons` | Régénère les icônes PWA génériques depuis les SVG |
| `npm run marker` | Génère le marqueur à partir d'un portrait (optionnel) |
| `npm run appicons` | Génère les icônes PWA à partir d'un portrait (optionnel) |

---

## Structure

```
src/
  config.ts              seuils, couleurs, emprise de carte — source unique
  types.ts               types partagés
  auth/                  AuthProvider (session, profil, appartenance)
  lib/                   client Supabase, calcul d'état, icônes, vue de carte
  hooks/                 usePanneaux, useClassement, useStats, useOnline
  components/            carte (marqueurs, filtres, calque électoral, appui long),
                         bottom sheet de validation, navigation
  pages/                 Login, Onboarding, Map, Stats, Leaderboard,
                         Profile, Administration, Privacy
  data/                  référentiels statiques (départements, zones,
                         référents, blocs électoraux, comptes à suivre)

supabase/
  schema.sql             tables, RLS, vues de calcul, RPC
  roles_admin.sql        rôles, périmètres, policies d'administration
  search_members.sql     recherche de partenaires (unaccent)
  disable_member.sql     désactivation douce
  functions/             Edge Functions Deno (invite-member, set-member-active)

scripts/                 import des panneaux, génération d'icônes
data/panneaux.geojson    inventaire source des panneaux
public/data/             résultats électoraux par bureau de vote
docs/screenshots/        captures d'écran du README
```

---

## Confidentialité (RGPD)

- **Données minimales** : e-mail, prénom, nom, département, et facultativement
  X et LinkedIn. Rien d'autre — pas de géolocalisation stockée, pas de photo,
  pas de traceur.
- **Hébergement EU** recommandé (région Supabase au choix à la création).
- L'**e-mail n'est jamais exposé** dans le classement ni sur la carte, ni à un
  visiteur non connecté. Il **est** en revanche visible des **autres membres**
  via la recherche de partenaires : c'est ce qui permet de retrouver quelqu'un
  qui n'a pas encore renseigné son nom (vue `v_members`, fonction
  `search_members`). À mentionner dans votre politique de confidentialité.
- Un visiteur non connecté peut vérifier si une adresse figure dans la liste
  blanche (nécessaire pour ne pas envoyer de code à une adresse non autorisée).
  Dans un contexte politique, l'appartenance étant une donnée sensible, pesez
  ce compromis avant un déploiement à grande échelle.
- **Suppression de compte en autonomie** depuis l'app (Profil →
  Confidentialité), via la fonction `delete_own_account()` : cascade sur le
  profil, les collages et les participations.
- La page **Confidentialité** intégrée détaille le traitement et crédite les
  fournisseurs de tuiles.

Ce dépôt ne contient **aucune donnée personnelle** : ni compte, ni militant, ni
contact réel. Les numéros et e-mails présents dans le code sont des
**placeholders** à remplacer (`src/data/referents.ts`).

---

## Données et sources

| Jeu de données | Source | Licence |
|---|---|---|
| [`data/panneaux.geojson`](data/panneaux.geojson) — 489 panneaux d'affichage libre | **Nantes Métropole**, open data | Licence Ouverte / Open Licence (Etalab) |
| [`public/data/bureaux-vote-44.geojson`](public/data/) — résultats par bureau de vote (présidentielle 2022, européennes 2024) | **Ministère de l'Intérieur** + contours de bureaux de vote en open data | Licence Ouverte / Open Licence (Etalab) |
| Fond de carte | **OpenStreetMap** · rendu **CartoDB** | ODbL · [attribution](https://carto.com/attributions) |

Ces jeux de données décrivent du **mobilier urbain public** et des **résultats
électoraux agrégés** : ils ne contiennent aucune donnée personnelle.

> **Réutilisation.** L'inventaire fourni couvre Nantes Métropole. Pour une autre
> ville, produisez un GeoJSON de points avec les mêmes propriétés (cf. l'en-tête
> de [`scripts/import-panneaux.ts`](scripts/import-panneaux.ts)) — la plupart
> des métropoles publient cet inventaire en open data.

---

## Contribuer

Les *issues* et *pull requests* sont bienvenues. Avant d'ouvrir une PR :

```bash
npm run lint
npm run build
```

Si votre changement touche à la sécurité, il doit se traduire par une **policy
RLS** ou une vérification serveur — pas seulement par un bouton masqué dans
l'interface.

---

## Licence

[MIT](LICENSE) — © 2026 Jean-Nicolas HINARD.

La licence couvre le **code**. Les jeux de données conservent leur licence
d'origine (Licence Ouverte / Etalab), et tout portrait que vous ajouteriez
reste sous son propre régime de droits.
