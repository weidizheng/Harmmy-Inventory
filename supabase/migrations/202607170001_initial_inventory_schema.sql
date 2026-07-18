-- Harmmy Inventory local-first schema. Apply only after explicit approval to use Supabase.
create extension if not exists pgcrypto;

create type public.catalog_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.staff_role as enum ('admin', 'warehouse', 'sales', 'viewer');
create type public.stock_operation_type as enum (
  'RECEIPT', 'OUTBOUND', 'SPLIT_CARTON', 'SPLIT_INNER', 'RETURN', 'DAMAGE',
  'ADJUSTMENT', 'TRANSFER', 'REVERSAL', 'CORRECTION'
);
create type public.stock_operation_status as enum ('DRAFT', 'PREVIEWED', 'CONFIRMED', 'VOIDED');
create type public.requested_unit as enum ('carton', 'inner', 'unit');
create type public.import_status as enum ('DRAFT', 'VALIDATED', 'IMPORTED', 'REJECTED');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug = lower(slug)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ips (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug = lower(slug)),
  display_name text not null,
  sort_order integer not null default 0,
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku = upper(trim(sku))),
  product_name text not null,
  brand_id uuid references public.brands(id),
  primary_ip_id uuid references public.ips(id),
  product_type text not null default 'Other',
  category text,
  units_per_inner integer check (units_per_inner is null or units_per_inner > 0),
  inners_per_carton integer check (inners_per_carton is null or inners_per_carton > 0),
  units_per_carton integer generated always as (units_per_inner * inners_per_carton) stored,
  wholesale_price numeric(12,2) check (wholesale_price is null or wholesale_price >= 0),
  retail_price numeric(12,2) check (retail_price is null or retail_price >= 0),
  is_pinned boolean not null default false,
  sort_weight integer not null default 0,
  catalog_status public.catalog_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((units_per_inner is null and inners_per_carton is null) or
         (units_per_inner is not null and inners_per_carton is not null))
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  storage_path text not null unique,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  image_type text not null default 'product',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index product_images_one_primary_per_product
  on public.product_images(product_id) where is_primary and is_active;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique check (code = upper(code)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  carton_qty integer not null default 0 check (carton_qty >= 0),
  inner_qty integer not null default 0 check (inner_qty >= 0),
  unit_qty integer not null default 0 check (unit_qty >= 0),
  reserved_unit_qty integer not null default 0 check (reserved_unit_qty >= 0),
  is_enabled boolean not null default true,
  location_code text,
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  password_hash text not null,
  role public.staff_role not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.stock_operations (
  id uuid primary key default gen_random_uuid(),
  operation_number text not null unique,
  operation_type public.stock_operation_type not null,
  status public.stock_operation_status not null default 'DRAFT',
  operator_id uuid references public.staff(id),
  warehouse_id uuid not null references public.warehouses(id),
  reference_no text,
  customer_name text,
  notes text,
  reverses_operation_id uuid references public.stock_operations(id),
  client_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.stock_operation_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.stock_operations(id),
  product_id uuid not null references public.products(id),
  requested_unit public.requested_unit not null,
  requested_qty integer not null check (requested_qty > 0),
  delta_carton_qty integer not null default 0,
  delta_inner_qty integer not null default 0,
  delta_unit_qty integer not null default 0,
  before_carton_qty integer not null check (before_carton_qty >= 0),
  before_inner_qty integer not null check (before_inner_qty >= 0),
  before_unit_qty integer not null check (before_unit_qty >= 0),
  after_carton_qty integer not null check (after_carton_qty >= 0),
  after_inner_qty integer not null check (after_inner_qty >= 0),
  after_unit_qty integer not null check (after_unit_qty >= 0),
  system_message text
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  status public.import_status not null default 'DRAFT',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.staff(id),
  created_at timestamptz not null default now()
);

create table public.import_batch_items (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id),
  source_row integer,
  normalized_data jsonb not null,
  validation_status text not null,
  validation_notes text,
  product_id uuid references public.products(id)
);

create table public.product_audit_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  actor_id uuid references public.staff(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index products_catalog_order_idx on public.products
  (is_pinned desc, sort_weight desc, product_name asc);
create index stock_operation_items_operation_idx on public.stock_operation_items(operation_id);
create index inventory_balances_product_idx on public.inventory_balances(product_id);

-- Production RPCs must lock balance rows, validate all lines, write snapshots and update balances in one transaction.
-- Do not grant browser clients direct access to password_hash, token_hash, or balance-changing writes.
alter table public.brands enable row level security;
alter table public.ips enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.staff enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.stock_operations enable row level security;
alter table public.stock_operation_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_batch_items enable row level security;
alter table public.product_audit_logs enable row level security;
