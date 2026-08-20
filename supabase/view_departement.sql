-- Recrée v_panneaux_dernier_collage pour exposer la colonne `departement`
-- (le `select p.*` ne se ré-élargit pas tout seul après l'ajout de la colonne).
-- DROP nécessaire car la position des colonnes change (create or replace échouerait).
drop view if exists public.v_panneaux_dernier_collage;

create view public.v_panneaux_dernier_collage as
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

grant select on public.v_panneaux_dernier_collage to authenticated;
