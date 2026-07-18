-- Preserve the reviewed supplier fields alongside the normalized package hierarchy.
alter table public.products
  add column if not exists quantity_per_carton_source integer check (quantity_per_carton_source is null or quantity_per_carton_source > 0),
  add column if not exists size_text text,
  add column if not exists details_raw text,
  add column if not exists image_source text;
