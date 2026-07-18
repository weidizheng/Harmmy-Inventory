-- Chinese is the canonical display name; English remains searchable supporting data.
alter table public.products rename column product_name to product_name_zh;
alter table public.products add column product_name_en text;
alter table public.products add column search_aliases text[] not null default '{}';

create extension if not exists pg_trgm;

drop index if exists public.products_catalog_order_idx;
create index products_catalog_order_idx on public.products
  (is_pinned desc, sort_weight desc, product_name_zh asc);
create index products_name_zh_trgm_idx on public.products using gin (lower(product_name_zh) gin_trgm_ops);
create index products_name_en_trgm_idx on public.products using gin (lower(coalesce(product_name_en, '')) gin_trgm_ops);
create index products_search_aliases_idx on public.products using gin (search_aliases);

-- ILIKE supports both Chinese character queries and English keywords.
create or replace function public.search_products(search_term text)
returns setof public.products
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.products p
  left join public.ips ip on ip.id = p.primary_ip_id
  where nullif(trim(search_term), '') is null
     or p.sku ilike '%' || trim(search_term) || '%'
     or p.product_name_zh ilike '%' || trim(search_term) || '%'
     or coalesce(p.product_name_en, '') ilike '%' || trim(search_term) || '%'
     or coalesce(ip.name, '') ilike '%' || trim(search_term) || '%'
     or coalesce(ip.display_name, '') ilike '%' || trim(search_term) || '%'
     or array_to_string(p.search_aliases, ' ') ilike '%' || trim(search_term) || '%'
  order by p.is_pinned desc, p.sort_weight desc, p.product_name_zh asc;
$$;
