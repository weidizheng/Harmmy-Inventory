-- Supabase Auth owns credentials. The staff table remains the application roster
-- and audit identity; all enabled staff receive the same operational permissions.
alter table public.staff add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.staff alter column password_hash drop not null;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_staff_id uuid references public.staff(id) on delete set null,
  actor_name text not null default 'System',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where auth_user_id = auth.uid()
      and is_active
  );
$$;

create or replace function public.create_staff_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff (auth_user_id, display_name, password_hash, role, is_active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'New staff'), '@', 1)),
    null,
    'admin',
    false
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_staff_for_auth_user();

create or replace function public.capture_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  staff_id uuid;
  staff_name text := 'System';
  entity uuid;
  before_row jsonb;
  after_row jsonb;
begin
  if actor_id is not null then
    select id, display_name into staff_id, staff_name
    from public.staff
    where auth_user_id = actor_id;
  end if;

  if tg_op = 'DELETE' then
    entity := old.id;
    before_row := to_jsonb(old) - 'password_hash';
  else
    entity := new.id;
    after_row := to_jsonb(new) - 'password_hash';
    if tg_op = 'UPDATE' then
      before_row := to_jsonb(old) - 'password_hash';
    end if;
  end if;

  insert into public.activity_logs (
    actor_user_id, actor_staff_id, actor_name, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, staff_id, coalesce(staff_name, 'System'), tg_op, tg_table_name, entity, before_row, after_row
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'brands', 'ips', 'products', 'product_images', 'warehouses', 'inventory_balances',
    'staff', 'stock_operations', 'stock_operation_items', 'import_batches', 'import_batch_items'
  ]
  loop
    execute format('drop trigger if exists activity_log_%1$s on public.%1$I', target_table);
    execute format(
      'create trigger activity_log_%1$s after insert or update or delete on public.%1$I for each row execute procedure public.capture_activity_log()',
      target_table
    );
  end loop;
end;
$$;

alter table public.activity_logs enable row level security;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.brands, public.ips, public.products, public.product_images,
  public.warehouses, public.inventory_balances, public.staff, public.stock_operations,
  public.stock_operation_items, public.import_batches, public.import_batch_items to authenticated;
grant select on table public.activity_logs to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'brands', 'ips', 'products', 'product_images', 'warehouses', 'inventory_balances',
    'staff', 'stock_operations', 'stock_operation_items', 'import_batches', 'import_batch_items'
  ]
  loop
    execute format('drop policy if exists "Active staff full access" on public.%I', target_table);
    execute format(
      'create policy "Active staff full access" on public.%1$I for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff())',
      target_table
    );
  end loop;
end;
$$;

drop policy if exists "Active staff can read activity logs" on public.activity_logs;
create policy "Active staff can read activity logs"
  on public.activity_logs for select to authenticated
  using (public.is_active_staff());

drop policy if exists "Active staff can manage product images" on storage.objects;
create policy "Active staff can manage product images"
  on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_active_staff())
  with check (bucket_id = 'product-images' and public.is_active_staff());
