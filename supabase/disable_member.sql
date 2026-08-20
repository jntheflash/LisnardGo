-- =============================================================================
-- Désactivation douce (réversible) d'un membre. À exécuter dans le SQL Editor.
-- Suppression DOUCE uniquement : aucune donnée/collage n'est effacé.
-- =============================================================================

-- 1) Indicateur de désactivation (actif par défaut)
alter table public.profiles add column if not exists is_active boolean not null default true;
create index if not exists idx_profiles_is_active on public.profiles (is_active);

-- 2) is_member() : un membre DÉSACTIVÉ n'est plus membre → la RLS le bloque
--    partout (lecture panneaux/collages, vues), même avec une session encore valide.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.allowed_emails a where a.email = public.current_email()
   ) and not exists (
     select 1 from public.profiles p
     where lower(p.email) = public.current_email() and p.is_active = false
   ) $$;

-- 3) is_email_allowed() : on n'envoie même plus de code OTP à un membre désactivé.
create or replace function public.is_email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.allowed_emails a where a.email = lower(trim(p_email))
   ) and not exists (
     select 1 from public.profiles p
     where lower(p.email) = lower(trim(p_email)) and p.is_active = false
   ) $$;

-- 4) v_members : recherche de partenaires → exclut les désactivés.
create or replace view public.v_members as
  select p.id,
    coalesce(p.display_name, p.email) as display_name,
    p.prenom, p.nom, p.email
  from public.profiles p
  where public.is_member() and coalesce(p.is_active, true);

-- 5) suggested_partners() : suggestions « Récemment » → exclut les désactivés.
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
  where public.is_member() and r.user_id <> auth.uid() and coalesce(p.is_active, true)
  order by r.src asc, r.last_at desc
  limit 8;
$$;

-- 6) DROITS : « create or replace » conserve les ACL, mais on les réaffirme
--    pour que ce fichier reste sûr même exécuté isolément.
revoke all on function public.is_member()            from public, anon;
revoke all on function public.is_email_allowed(text) from public;
revoke all on function public.suggested_partners()   from public, anon;

grant execute on function public.is_member()            to authenticated;
grant execute on function public.is_email_allowed(text) to anon, authenticated;
grant execute on function public.suggested_partners()   to authenticated;

-- NB : v_classement N'EST PAS modifiée → les collages d'un membre désactivé
-- continuent de compter (pour lui et pour ses anciens partenaires).
