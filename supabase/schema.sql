-- =============================================================================
-- LisnardGo — Schéma Supabase / Postgres
-- À exécuter dans le SQL Editor du projet Supabase (région EU).
-- Idempotent : peut être ré-exécuté sans casse.
-- S'exécute d'une traite sur une base VIERGE (l'ordre des objets est respecté).
-- =============================================================================
--
-- PARAMÈTRES MÉTIER (doivent rester synchronisés avec src/config.ts) :
--   • Seuil "périmé"  : 14 jours → calculé côté client (calculerEtat)
--   • Points          : 10 par collage, pour CHAQUE personne présente
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- Profils publics des militants (1 ligne par utilisateur auth)
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  prenom       text,
  nom          text,
  display_name text, -- maintenu par l'app = « Prénom Nom »
  twitter      text, -- pseudo X/Twitter (sans @), optionnel
  linkedin     text, -- URL du profil LinkedIn, optionnel
  role         text not null default 'militant', -- militant | referent | admin_national
  created_at   timestamptz not null default now()
);
-- Pour les bases déjà créées :
alter table public.profiles add column if not exists prenom   text;
alter table public.profiles add column if not exists nom      text;
alter table public.profiles add column if not exists twitter  text;
alter table public.profiles add column if not exists linkedin text;
alter table public.profiles add column if not exists role     text not null default 'militant';

-- Le rôle est la SOURCE UNIQUE des droits d'administration (cf. is_admin()).
-- Les colonnes de périmètre (departement, referent_departement) sont ajoutées
-- par add_departement.sql et roles_admin.sql.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('militant', 'referent', 'admin_national'));

create index if not exists idx_profiles_role on public.profiles (role);

-- Panneaux d'affichage libre (statut "Monté" uniquement, importés via script)
create table if not exists public.panneaux (
  id                 uuid primary key default gen_random_uuid(), -- globalid (officiels) ou généré (manuels)
  id_inventaire      text,                         -- ex. AL_NM_08_0009 (officiels)
  commune            text,
  quartier           text,
  secteur            text,
  nom_voie           text,
  complement_adresse text,
  lat                double precision not null,
  lng                double precision not null,
  source             text not null default 'officiel', -- 'officiel' | 'manuel'
  created_by         uuid references public.profiles (id) on delete set null,
  deleted_at         timestamptz,                  -- suppression douce (manuels)
  created_at         timestamptz not null default now()
);
-- Pour les bases déjà créées :
alter table public.panneaux add column if not exists source     text not null default 'officiel';
alter table public.panneaux add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.panneaux add column if not exists deleted_at timestamptz;
alter table public.panneaux alter column id set default gen_random_uuid();
alter table public.panneaux alter column id_inventaire drop not null;
alter table public.panneaux alter column commune       drop not null;

-- Historique des collages (un panneau peut avoir plusieurs collages dans le temps)
create table if not exists public.collages (
  id         uuid primary key default gen_random_uuid(),
  panneau_id uuid not null references public.panneaux (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Index pour les calculs de points et d'états
create index if not exists idx_collages_user_created
  on public.collages (user_id, created_at);
create index if not exists idx_collages_panneau_created
  on public.collages (panneau_id, created_at desc);

-- Liste blanche : seuls ces e-mails peuvent se connecter et utiliser l'app.
create table if not exists public.allowed_emails (
  email      text primary key,         -- toujours en minuscule
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- L'ancienne colonne « is_admin » constituait un SECOND système d'administration,
-- parallèle à profiles.role, jamais alimenté par l'application (donc toujours
-- false) mais suffisant pour donner tous les droits sur la liste blanche à qui
-- l'aurait positionnée à la main. Supprimée : profiles.role fait autorité.
alter table public.allowed_emails drop column if exists is_admin;

-- ----------------------------------------------------------------------------
-- 1b. CONTRÔLE D'ACCÈS (fonctions, définies AVANT les vues qui s'en servent)
-- ----------------------------------------------------------------------------
-- Toutes ces fonctions sont « security definer » : elles s'exécutent avec les
-- droits du propriétaire pour éviter la récursion des policies. On RÉVOQUE donc
-- explicitement l'EXECUTE accordé par défaut à PUBLIC, puis on l'accorde au
-- seul rôle qui en a besoin.

-- E-mail (minuscule) de l'utilisateur courant, lu depuis son jeton.
create or replace function public.current_email()
returns text language sql stable security definer set search_path = public as
$$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- L'utilisateur courant est-il dans la liste blanche ?
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.allowed_emails a where a.email = public.current_email()
   ) $$;

-- … et est-il administrateur national ?
-- SOURCE UNIQUE des droits d'admin : profiles.role. (roles_admin.sql expose la
-- même information sous le nom is_admin_national() ; les deux lisent la même
-- colonne, il n'existe pas de second système de droits.)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin_national'
   ) $$;

-- Vérif avant l'envoi du code OTP (appelée par un visiteur NON connecté).
-- ⚠️ Accessible au rôle « anon » par nécessité : c'est le seul moyen de ne pas
-- envoyer de code à une adresse non autorisée. Contrepartie assumée : un
-- visiteur peut tester si une adresse figure dans la liste blanche.
create or replace function public.is_email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.allowed_emails a where a.email = lower(trim(p_email))
   ) $$;

revoke all on function public.current_email()        from public, anon;
revoke all on function public.is_member()            from public, anon;
revoke all on function public.is_admin()             from public, anon;
revoke all on function public.is_email_allowed(text) from public;

grant execute on function public.current_email()        to authenticated;
grant execute on function public.is_member()            to authenticated;
grant execute on function public.is_admin()             to authenticated;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- Seuls les administrateurs nationaux lisent / modifient la liste blanche.
drop policy if exists "allowed_emails_admin_all" on public.allowed_emails;
create policy "allowed_emails_admin_all" on public.allowed_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. PROFIL : CRÉATION AUTOMATIQUE + PROTECTION DE L'E-MAIL
-- ----------------------------------------------------------------------------
-- À la 1re connexion OTP, une ligne profiles est créée (display_name à compléter).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles.email doit TOUJOURS refléter l'adresse du compte auth.
--
-- Sans ce garde-fou, la policy profiles_update_own (« chacun modifie sa propre
-- ligne ») permettrait à un membre de réécrire son e-mail — et donc de casser
-- la correspondance sur laquelle repose la désactivation douce
-- (cf. disable_member.sql : is_member() cherche le profil dont l'e-mail vaut
-- celui du jeton). Un membre désactivé pouvait ainsi redevenir membre.
-- Interdit aussi d'inscrire l'adresse de quelqu'un d'autre (usurpation dans la
-- recherche de partenaires, qui affiche l'e-mail à défaut de nom).
--
-- Le contexte privilégié (SQL Editor / service_role, auth.uid() IS NULL) reste
-- autorisé : indispensable au trigger d'inscription et à l'Edge Function
-- d'invitation qui pré-remplit les profils.
create or replace function public.guard_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- service_role / SQL Editor
  end if;

  -- Une adresse déjà renseignée ne change plus.
  -- (IF imbriqué : en INSERT, l'enregistrement OLD n'est pas assigné et y faire
  --  référence lèverait « record "old" is not assigned yet ».)
  if tg_op = 'UPDATE' then
    if old.email is not null and new.email is distinct from old.email then
      raise exception 'L''adresse e-mail du profil ne peut pas être modifiée';
    end if;
  end if;

  -- Renseignement initial : uniquement avec sa propre adresse (celle du jeton).
  if new.email is not null
     and lower(new.email) <> public.current_email() then
    raise exception 'L''adresse e-mail du profil doit être celle du compte';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_email on public.profiles;
create trigger trg_guard_profile_email
  before insert or update on public.profiles
  for each row execute function public.guard_profile_email();

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.panneaux enable row level security;
alter table public.collages enable row level security;

-- profiles : chacun lit / crée / modifie UNIQUEMENT sa propre ligne.
-- (roles_admin.sql élargit la LECTURE au référent de son département et à
--  l'admin national.)
--
-- ⚠️ PORTÉE RÉELLE DE CETTE RESTRICTION — à lire avant de s'y fier.
-- Elle protège l'accès DIRECT à la table. Elle ne s'applique PAS aux vues et
-- fonctions ci-dessous, qui sont « security definer » / détenues par le
-- propriétaire et contournent donc la RLS par construction :
--   • v_classement       n'expose que display_name → aucun e-mail. ✅
--   • v_panneaux_dernier_collage  n'expose que display_name / réseaux sociaux. ✅
--   • v_members et search_members() exposent VOLONTAIREMENT l'e-mail de tous
--     les membres aux autres membres : c'est ce qui permet de retrouver un
--     partenaire de collage qui n'a pas encore renseigné son nom.
--   • suggested_partners() affiche l'e-mail à défaut de nom, même raison.
-- Autrement dit : l'e-mail n'est jamais public ni visible dans le classement,
-- mais il EST visible des autres membres authentifiés via la recherche de
-- partenaires. À refléter dans votre politique de confidentialité.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- La colonne email est en outre verrouillée par trg_guard_profile_email, et
-- role / referent_departement par trg_guard_profile_role (roles_admin.sql) :
-- une policy RLS ne peut pas comparer l'ancienne et la nouvelle valeur.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- panneaux : lecture pour les membres de la liste blanche uniquement.
-- (L'import se fait avec la clé service_role, qui ignore la RLS.)
drop policy if exists "panneaux_select_auth" on public.panneaux;
drop policy if exists "panneaux_select_member" on public.panneaux;
create policy "panneaux_select_member" on public.panneaux
  for select to authenticated using (public.is_member());

-- Tout membre peut créer un panneau MANUEL (à son nom).
drop policy if exists "panneaux_insert_manuel" on public.panneaux;
create policy "panneaux_insert_manuel" on public.panneaux
  for insert to authenticated
  with check (public.is_member() and source = 'manuel' and created_by = auth.uid());

-- Seul le créateur, ET s'il est toujours membre, peut modifier (soft-delete)
-- son propre panneau manuel. Sans is_member(), un membre révoqué ou désactivé
-- gardait un droit d'écriture alors qu'il ne peut plus rien lire.
drop policy if exists "panneaux_update_own_manuel" on public.panneaux;
create policy "panneaux_update_own_manuel" on public.panneaux
  for update to authenticated
  using (public.is_member() and source = 'manuel' and created_by = auth.uid())
  with check (public.is_member() and source = 'manuel' and created_by = auth.uid());

-- collages : lecture pour les membres ; insertion de SON propre collage (si membre).
drop policy if exists "collages_select_auth" on public.collages;
drop policy if exists "collages_select_member" on public.collages;
create policy "collages_select_member" on public.collages
  for select to authenticated using (public.is_member());

drop policy if exists "collages_insert_own" on public.collages;
create policy "collages_insert_own" on public.collages
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member());

-- Annulation : chacun peut supprimer SES propres collages (correction d'erreur),
-- tant qu'il est membre — cohérent avec la policy d'insertion.
drop policy if exists "collages_delete_own" on public.collages;
create policy "collages_delete_own" on public.collages
  for delete to authenticated
  using (public.is_member() and auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. VUE : DERNIER COLLAGE PAR PANNEAU (pour les états sur la carte)
-- ----------------------------------------------------------------------------
-- L'état (a_faire / fait / perime) est calculé côté client à partir de
-- dernier_collage (cf. src/lib/etat.ts), pour garder le seuil de 14 j en un
-- seul endroit (src/config.ts).

create or replace view public.v_panneaux_dernier_collage as
select
  p.*,
  lc.created_at   as dernier_collage,
  lc.user_id      as dernier_collage_par,
  pr.display_name as dernier_collage_par_nom,
  pr.twitter      as dernier_collage_par_twitter,
  pr.linkedin     as dernier_collage_par_linkedin
from public.panneaux p
left join lateral (
  select created_at, user_id
  from public.collages c
  where c.panneau_id = p.id
  order by c.created_at desc
  limit 1
) lc on true
left join public.profiles pr on pr.id = lc.user_id
where public.is_member() and p.deleted_at is null;

-- ----------------------------------------------------------------------------
-- 5. PARTICIPANTS D'UN COLLAGE (sécurité : on ne colle jamais seul)
-- ----------------------------------------------------------------------------
-- Défini AVANT v_classement, qui agrège cette table pour attribuer les points.

create table if not exists public.collage_participants (
  collage_id uuid not null references public.collages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collage_id, user_id)
);
alter table public.collage_participants enable row level security;

-- Lecture : pour les membres (cohérent avec collages).
drop policy if exists "cp_select_member" on public.collage_participants;
create policy "cp_select_member" on public.collage_participants
  for select to authenticated using (public.is_member());

-- Insertion : on ne peut ajouter des participants qu'à SON propre collage.
drop policy if exists "cp_insert_own_collage" on public.collage_participants;
create policy "cp_insert_own_collage" on public.collage_participants
  for insert to authenticated
  with check (
    public.is_member()
    and exists (
      select 1 from public.collages c
      where c.id = collage_id and c.user_id = auth.uid()
    )
  );

-- Suppression : correction d'une erreur de saisie. Deux cas légitimes —
--   • l'auteur du collage retire quelqu'un qu'il a tagué par erreur ;
--   • une personne taguée à tort se retire elle-même.
-- Retirer un participant lui retire mécaniquement les points du collage
-- (v_classement recalcule tout à la volée).
drop policy if exists "cp_delete_own_collage" on public.collage_participants;
create policy "cp_delete_own_collage" on public.collage_participants
  for delete to authenticated
  using (
    public.is_member()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.collages c
        where c.id = collage_id and c.user_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. VUE : CLASSEMENT (10 points par collage, pour CHAQUE personne présente)
-- ----------------------------------------------------------------------------
-- Règle simple, SANS bonus : chaque personne présente sur un collage (valideur
-- OU partenaire) gagne 10 points. Total = 10 × nombre de collages auxquels la
-- personne a participé (comptée une seule fois par collage).
-- N'expose QUE display_name (jamais l'e-mail).

create or replace view public.v_classement as
with participations as (
  -- Valideur + partenaires, dédoublonné par (user_id, collage_id) via UNION
  select user_id, id as collage_id, created_at from public.collages
  union
  select cp.user_id, cp.collage_id, c.created_at
  from public.collage_participants cp
  join public.collages c on c.id = cp.collage_id
),
agg as (
  select
    user_id,
    count(*)::int as nb_collages,
    count(*) filter (where created_at >= date_trunc('month', now()))::int
      as nb_collages_mois,
    count(distinct (created_at at time zone 'Europe/Paris')::date)::int
      as nb_sorties
  from participations
  group by user_id
)
select
  p.id                                 as user_id,
  coalesce(p.display_name, 'Militant') as display_name,
  (coalesce(a.nb_collages, 0) * 10)    as total_points,
  coalesce(a.nb_collages, 0)           as nb_collages,
  coalesce(a.nb_collages_mois, 0)      as nb_collages_mois,
  coalesce(a.nb_sorties, 0)            as nb_sorties
from public.profiles p
left join agg a on a.user_id = p.id
where public.is_member();

-- ----------------------------------------------------------------------------
-- 7. PERMISSIONS SUR LES VUES
-- ----------------------------------------------------------------------------
-- Les vues s'exécutent avec les droits de leur propriétaire (security_invoker
-- off par défaut) : elles CONTOURNENT la RLS des tables sous-jacentes. Leur
-- clause « where public.is_member() » est donc le seul filtre d'accès — ne
-- jamais l'enlever, et vérifier les colonnes exposées avant d'en ajouter.

grant select on public.v_panneaux_dernier_collage to authenticated;
grant select on public.v_classement              to authenticated;

-- ----------------------------------------------------------------------------
-- 8. SUPPRESSION DE COMPTE (RGPD)
-- ----------------------------------------------------------------------------
-- L'utilisateur supprime son propre compte. La suppression de auth.users
-- cascade sur profiles puis collages (FK on delete cascade) → toutes ses
-- données sont effacées.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ----------------------------------------------------------------------------
-- 9. RECHERCHE DE PARTENAIRES
-- ----------------------------------------------------------------------------
-- Liste des membres pour la recherche de partenaires. Réservée aux membres
-- (is_member). Expose prénom/nom/e-mail pour permettre de chercher sur les trois
-- (un membre sans nom reste trouvable par son e-mail) — cf. l'avertissement de
-- la section 3 sur la visibilité des e-mails entre membres.
create or replace view public.v_members as
  select p.id,
    coalesce(p.display_name, p.email) as display_name, -- pour l'affichage
    p.prenom,
    p.nom,
    p.email
  from public.profiles p
  where public.is_member();
grant select on public.v_members to authenticated;

-- Suggestions de partenaires : d'abord MES partenaires récents, puis les
-- colleurs récents. Dédoublonné, sans moi, max 8.
create or replace function public.suggested_partners()
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  with recent_partners as (
    select cp.user_id, max(c.created_at) as last_at, 1 as src
    from public.collage_participants cp
    join public.collages c on c.id = cp.collage_id
    where c.user_id = auth.uid()
    group by cp.user_id
  ),
  recent_collers as (
    select c.user_id, max(c.created_at) as last_at, 2 as src
    from public.collages c
    where c.user_id <> auth.uid()
    group by c.user_id
  ),
  ranked as (
    select user_id, min(src) as src, max(last_at) as last_at
    from (select * from recent_partners union all select * from recent_collers) u
    group by user_id
  )
  select r.user_id as id, coalesce(p.display_name, p.email) as display_name
  from ranked r
  join public.profiles p on p.id = r.user_id
  where public.is_member() and r.user_id <> auth.uid()
  order by r.src asc, r.last_at desc
  limit 8;
$$;

revoke all on function public.suggested_partners() from public, anon;
grant execute on function public.suggested_partners() to authenticated;
