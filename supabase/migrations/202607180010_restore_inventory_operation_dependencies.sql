-- Migration 006 was recorded by the remote project before these dependencies
-- were added locally. Restore the warehouse and physical package input columns
-- without changing any existing balance values.
insert into public.warehouses (name, code, is_active)
values ('Montery Park', 'MONTERY-PARK', true)
on conflict (name) do update set is_active = true;

alter table public.stock_operation_items
  add column if not exists requested_carton_qty integer not null default 0,
  add column if not exists requested_inner_qty integer not null default 0,
  add column if not exists requested_unit_qty integer not null default 0;
