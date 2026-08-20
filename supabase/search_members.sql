-- =============================================================================
-- Recherche de membres (partenaires de collage) côté serveur
-- À exécuter dans le SQL Editor de Supabase.
-- =============================================================================

-- 1) Extension « unaccent » (recherche insensible aux accents)
create extension if not exists unaccent with schema extensions;

-- 2) Backfill de sécurité : copie l'e-mail depuis auth.users si jamais il manque
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- 3) Fonction de recherche : e-mail OU prénom OU nom, correspondance PARTIELLE,
--    insensible à la casse ET aux accents. SECURITY DEFINER : ne renvoie que les
--    membres correspondants (n'expose pas toute la table au client).
create or replace function public.search_members(q text)
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    coalesce(
      nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''),
      p.email
    ) as display_name
  from public.profiles p
  where public.is_member()              -- l'appelant doit être membre
    and p.id <> auth.uid()              -- exclut soi-même
    and length(trim(q)) > 0
    and unaccent(
          coalesce(p.prenom, '') || ' ' ||
          coalesce(p.nom, '')    || ' ' ||
          coalesce(p.email, '')
        ) ilike ('%' || unaccent(q) || '%')
  order by display_name
  limit 20;
$$;

-- « security definer » : révoquer l'EXECUTE accordé par défaut à PUBLIC.
revoke all on function public.search_members(text) from public, anon;
grant execute on function public.search_members(text) to authenticated;
