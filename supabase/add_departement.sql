-- Ajoute la colonne « departement » (code du département de référence) à profiles.
-- Obligatoire au niveau de l'app (onboarding) ; pas de contrainte NOT NULL en base
-- pour ne pas bloquer les lignes existantes encore vides.
alter table public.profiles add column if not exists departement text;
