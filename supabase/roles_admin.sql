-- =============================================================================
-- LisnardGo — Rôles & administration (droits appliqués CÔTÉ SERVEUR via RLS)
-- À RELIRE, puis exécuter dans le SQL Editor de Supabase. Idempotent.
-- =============================================================================

-- 1) COLONNES -----------------------------------------------------------------
-- profiles : rôle (défaut 'militant') + département administré par un référent.
-- NB : la colonne `role` et sa contrainte sont désormais déclarées dans
-- schema.sql (is_admin() s'appuie dessus). Les instructions ci-dessous sont
-- conservées, idempotentes, pour les bases créées avec une version antérieure.
alter table public.profiles add column if not exists role text not null default 'militant';
alter table public.profiles add column if not exists referent_departement text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('militant', 'referent', 'admin_national'));

-- panneaux : département (sert au périmètre des référents).
alter table public.panneaux add column if not exists departement text;

-- 2) BACKFILL -----------------------------------------------------------------
update public.panneaux set departement = '44' where departement is null;

create index if not exists idx_panneaux_departement on public.panneaux (departement);
create index if not exists idx_profiles_role on public.profiles (role);

-- 3) FONCTIONS D'ACCÈS (security definer → évite la récursion des policies) ----
create or replace function public.is_admin_national()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles where id = auth.uid() and role = 'admin_national'
   ) $$;

create or replace function public.is_referent()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles where id = auth.uid() and role = 'referent'
   ) $$;

create or replace function public.current_referent_departement()
returns text language sql stable security definer set search_path = public as
$$ select referent_departement from public.profiles
   where id = auth.uid() and role = 'referent' $$;

-- « security definer » : on révoque l'EXECUTE accordé par défaut à PUBLIC
-- (donc à anon) avant de l'accorder au seul rôle authentifié.
revoke all on function public.is_admin_national()            from public, anon;
revoke all on function public.is_referent()                  from public, anon;
revoke all on function public.current_referent_departement() from public, anon;

grant execute on function public.is_admin_national()            to authenticated;
grant execute on function public.is_referent()                  to authenticated;
grant execute on function public.current_referent_departement() to authenticated;

-- 4) PROTECTION DES COLONNES SENSIBLES (role, referent_departement) -----------
-- Un utilisateur connecté NON admin national ne peut JAMAIS toucher role ni
-- referent_departement (création ou mise à jour). Le contexte privilégié du
-- SQL Editor / service_role (auth.uid() IS NULL) reste autorisé : indispensable
-- pour amorcer le premier admin.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (new.role is distinct from 'militant' or new.referent_departement is not null)
       and auth.uid() is not null and not public.is_admin_national() then
      raise exception 'Attribution de rôle réservée à un administrateur national';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.role is distinct from old.role
        or new.referent_departement is distinct from old.referent_departement)
       and auth.uid() is not null and not public.is_admin_national() then
      raise exception 'Modification du rôle réservée à un administrateur national';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- 5) RPC : ASSIGNATION DES RÔLES (admin national UNIQUEMENT) -------------------
create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role text,
  p_referent_departement text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_national() then
    raise exception 'Réservé aux administrateurs nationaux';
  end if;
  if p_role not in ('militant', 'referent', 'admin_national') then
    raise exception 'Rôle invalide';
  end if;
  if p_role = 'referent' and coalesce(trim(p_referent_departement), '') = '' then
    raise exception 'Un référent doit avoir un département';
  end if;
  update public.profiles
     set role = p_role,
         referent_departement = case when p_role = 'referent'
                                     then p_referent_departement else null end
   where id = p_user_id;
end;
$$;
revoke all on function public.admin_set_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text, text) to authenticated;

-- 6) DÉPARTEMENT AUTO DES PANNEAUX MANUELS ------------------------------------
-- À la création, departement = département du profil du créateur (si non fourni).
create or replace function public.set_panneau_departement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.departement is null and new.created_by is not null then
    select departement into new.departement
    from public.profiles where id = new.created_by;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_set_panneau_departement on public.panneaux;
create trigger trg_set_panneau_departement
  before insert on public.panneaux
  for each row execute function public.set_panneau_departement();

-- 7) RLS : PROFILES (lecture élargie référent de son dépt / admin national) ----
-- (profiles_select_own / insert_own / update_own existantes : CONSERVÉES.)
drop policy if exists "profiles_select_referent_dept" on public.profiles;
create policy "profiles_select_referent_dept" on public.profiles
  for select to authenticated
  using (
    public.is_referent()
    and departement is not null
    and departement = public.current_referent_departement()
  );

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin_national());

-- 8) RLS : PANNEAUX (soft-delete des MANUELS : référent de son dépt + admin) ---
-- Soft-delete = mise à jour de deleted_at. UNIQUEMENT source='manuel'.
-- (panneaux_update_own_manuel CONSERVÉE : un militant gère ses propres panneaux.)
-- (Aucune policy ne permet de modifier un panneau 'officiel' → jamais supprimable.)
drop policy if exists "panneaux_update_referent_dept" on public.panneaux;
create policy "panneaux_update_referent_dept" on public.panneaux
  for update to authenticated
  using (
    source = 'manuel'
    and public.is_referent()
    and departement is not null
    and departement = public.current_referent_departement()
  )
  with check (
    source = 'manuel'
    and public.is_referent()
    and departement is not null
    and departement = public.current_referent_departement()
  );

drop policy if exists "panneaux_update_admin" on public.panneaux;
create policy "panneaux_update_admin" on public.panneaux
  for update to authenticated
  using (source = 'manuel' and public.is_admin_national())
  with check (source = 'manuel' and public.is_admin_national());

-- =============================================================================
-- AMORÇAGE (à lancer SÉPARÉMENT, une seule fois) : définir le premier admin.
-- Remplacez l'e-mail ci-dessous par le vôtre avant d'exécuter.
-- =============================================================================
-- update public.profiles
--   set role = 'admin_national'
--   where id = (select id from auth.users where lower(email) = 'votre-email@exemple.fr');
