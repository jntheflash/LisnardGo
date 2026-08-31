-- =============================================================================
-- LisnardGo — Durcissement des droits d'accès (audit du 31/08/2026)
--
-- Ce fichier consigne les correctifs RÉELLEMENT appliqués à la base de
-- production, dans l'ordre où ils l'ont été. Il s'exécute APRÈS schema.sql,
-- add_departement.sql, roles_admin.sql, disable_member.sql, search_members.sql
-- et view_departement.sql, dont il modifie certains objets.
--
-- ⚠️ Les définitions concernées dans ces fichiers-là ne sont plus à jour : en cas
-- de reconstruction d'une base vierge, exécuter ce fichier EN DERNIER.
--
-- Failles corrigées (numérotation du rapport d'audit) :
--   R1  Vérification publique d'appartenance (énumération de la liste blanche)
--   R2  Annuaire exposant l'e-mail de tous les membres
--   R3  Points falsifiables (collages en série, panneaux manuels illimités)
--   R4  Membre désactivé capable de se réactiver lui-même
--   R6  Département modifiable par le membre (périmètre non contraignant)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- R4 + R6 — Verrouillage des colonnes sensibles de `profiles`
-- -----------------------------------------------------------------------------
-- Étend le garde-fou existant (rôle) à `is_active` et `departement`.
-- `departement` reste renseignable UNE fois — sans quoi l'inscription, qui
-- l'exige (cf. OnboardingPage), serait impossible à terminer.

create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  privilegie boolean;
begin
  -- service_role / SQL Editor (auth.uid() null) et admin national : autorisés.
  -- Indispensable aux Edge Functions (invite-member, set-member-active), à
  -- admin_set_role() et à l'amorçage du premier administrateur.
  privilegie := (auth.uid() is null) or public.is_admin_national();
  if privilegie then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'militant'
       or new.referent_departement is not null then
      raise exception 'Attribution de rôle réservée à un administrateur national';
    end if;
    if new.is_active is distinct from true then
      raise exception 'Le statut actif ne peut pas être choisi par un membre';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.role is distinct from old.role
     or new.referent_departement is distinct from old.referent_departement then
    raise exception 'Modification du rôle réservée à un administrateur national';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Le statut actif ne peut être modifié que par un administrateur national';
  end if;

  -- Département : renseignable UNE fois (inscription), puis figé.
  if old.departement is not null
     and new.departement is distinct from old.departement then
    raise exception 'Le département ne peut être modifié que par un administrateur national';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- Seconde moitié de R4 : la règle de modification ne vérifiait pas que l'auteur
-- était encore membre. Un compte désactivé pouvait donc écrire dans sa fiche
-- tant que sa session vivait.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id and public.is_member())
  with check (auth.uid() = id and public.is_member());


-- -----------------------------------------------------------------------------
-- R2 — L'annuaire n'expose plus d'e-mail et ne peut plus être listé en bloc
-- -----------------------------------------------------------------------------
-- La vue exposait `email` et permettait de récupérer tout l'annuaire d'un coup.
-- Elle est supprimée : toute recherche passe par search_members(), plafonnée.
drop view if exists public.v_members;

-- Recherche : prénom/nom uniquement, 2 caractères minimum, 10 résultats maximum.
-- Le repli `coalesce(display_name, email)` disparaît : il affichait l'e-mail des
-- membres sans nom. L'inscription rendant prénom et nom obligatoires, ce repli
-- n'a plus d'objet.
drop function if exists public.search_members(text);

create function public.search_members(q text)
returns table (id uuid, prenom text, nom text, display_name text)
language sql stable security definer set search_path = public, extensions as $$
  select
    p.id, p.prenom, p.nom,
    trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')) as display_name
  from public.profiles p
  where public.is_member()
    and coalesce(p.is_active, true)
    and p.id <> auth.uid()
    and length(trim(coalesce(q, ''))) >= 2
    and nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '') is not null
    and unaccent(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''))
        ilike ('%' || unaccent(trim(q)) || '%')
  order by p.prenom, p.nom
  limit 10;
$$;

revoke all on function public.search_members(text) from public, anon;
grant execute on function public.search_members(text) to authenticated;

-- Suggestions « Récemment » : même repli sur l'e-mail à supprimer.
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
  select
    r.user_id as id,
    trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')) as display_name
  from ranked r
  join public.profiles p on p.id = r.user_id
  where public.is_member()
    and r.user_id <> auth.uid()
    and coalesce(p.is_active, true)
    and nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '') is not null
  order by r.src asc, r.last_at desc
  limit 8;
$$;

revoke all on function public.suggested_partners() from public, anon;
grant execute on function public.suggested_partners() to authenticated;


-- -----------------------------------------------------------------------------
-- R1 — Plus de vérification publique d'appartenance
-- -----------------------------------------------------------------------------
-- is_email_allowed() était ouverte au rôle `anon` par nécessité : l'écran de
-- connexion s'en servait pour ne pas envoyer de code à une adresse non
-- autorisée. Contrepartie : n'importe qui pouvait tester une adresse, donc
-- vérifier une appartenance politique.
--
-- L'écran de connexion ne fait plus aucune pré-vérification : il appelle
-- directement signInWithOtp avec `shouldCreateUser: false` et affiche le même
-- écran quelle que soit l'adresse. Les comptes étant créés par l'invitation
-- (Edge Function invite-member), aucun e-mail ne part vers une adresse inconnue.
--
-- La fonction est supprimée plutôt que révoquée : la laisser accessible aux
-- membres connectés recréerait un oracle d'énumération.
drop function if exists public.is_email_allowed(text);


-- -----------------------------------------------------------------------------
-- R3 — Points non falsifiables
-- -----------------------------------------------------------------------------

-- a) Traçabilité : qui a tagué qui.
alter table public.collage_participants
  add column if not exists added_by uuid references public.profiles (id) on delete set null;

create or replace function public.set_participant_added_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Non falsifiable : toute valeur fournie par le client est ignorée.
  if auth.uid() is not null then
    new.added_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participant_added_by on public.collage_participants;
create trigger trg_participant_added_by
  before insert on public.collage_participants
  for each row execute function public.set_participant_added_by();

-- b) Un collage par membre et par panneau sur 14 jours.
-- C'est le vrai levier anti-triche : les points viennent des collages, pas des
-- panneaux. Rien n'empêchait de valider indéfiniment le même panneau officiel.
-- Le panneau restant « fait » pendant la fenêtre, la carte demeure exacte ;
-- seuls les points supplémentaires sont refusés.
create or replace function public.limite_collage_par_panneau()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service_role / SQL Editor : import et corrections d'administration.
  if auth.uid() is null then return new; end if;

  if exists (
    select 1 from public.collages c
    where c.panneau_id = new.panneau_id
      and c.user_id    = new.user_id
      and c.created_at > now() - interval '14 days'   -- fenêtre de fraîcheur métier
  ) then
    raise exception 'Vous avez déjà collé ce panneau il y a moins de 14 jours.'
      using errcode = '45001';   -- traduit par le front (MapPage)
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limite_collage_par_panneau on public.collages;
create trigger trg_limite_collage_par_panneau
  before insert on public.collages
  for each row execute function public.limite_collage_par_panneau();

-- c) Plafond de création de panneaux manuels : 15 par membre et par 24 h.
create or replace function public.limite_panneaux_manuels()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return new; end if;
  if new.source is distinct from 'manuel' then return new; end if;

  -- Les panneaux supprimés en douceur restent comptés : supprimer ne doit pas
  -- réinitialiser le quota.
  select count(*) into n
  from public.panneaux p
  where p.created_by = new.created_by
    and p.source = 'manuel'
    and p.created_at > now() - interval '24 hours';

  if n >= 15 then
    raise exception 'Limite de 15 panneaux ajoutés par 24 heures atteinte.'
      using errcode = '45002';   -- traduit par le front (MapPage)
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limite_panneaux_manuels on public.panneaux;
create trigger trg_limite_panneaux_manuels
  before insert on public.panneaux
  for each row execute function public.limite_panneaux_manuels();


-- =============================================================================
-- RESTE À FAIRE (constaté à l'audit, non corrigé ici)
-- =============================================================================
-- • R5 partiel : is_member(), is_admin() et current_email() restent exécutables
--   par le rôle `anon` — les `revoke` de schema.sql n'ont jamais pris effet sur
--   cette base. Sans danger (elles renvoient false / chaîne vide à un visiteur),
--   mais la défense en profondeur annoncée n'existe pas. Correctif :
--     revoke all on function public.is_member()    from public, anon;
--     revoke all on function public.is_admin()     from public, anon;
--     revoke all on function public.current_email() from public, anon;
-- • R7 : aucun rôle ne peut modérer (supprimer le collage ou le tag d'autrui).
-- • R8 : admin_set_role() n'empêche pas de rétrograder le dernier admin national.
-- • R9 : le rôle « référent » ne peut pas inviter ; tout l'onboarding national
--   passe par un seul administrateur.
-- • R10 / R11 : Edge Functions en CORS ouvert, et sans vérification du statut
--   actif de l'appelant.
