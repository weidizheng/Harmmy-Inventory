-- Draft-cart adjustments may contain both positive and negative changes.
alter table public.stock_operation_items drop constraint if exists stock_operation_items_requested_carton_qty_check;
alter table public.stock_operation_items drop constraint if exists stock_operation_items_requested_inner_qty_check;
alter table public.stock_operation_items drop constraint if exists stock_operation_items_requested_unit_qty_check;

create or replace function public.confirm_stock_operation(
  p_operation_type public.stock_operation_type,
  p_warehouse_id uuid,
  p_lines jsonb,
  p_notes text default null,
  p_is_count boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_product_id uuid;
  v_carton_qty integer;
  v_inner_qty integer;
  v_unit_qty integer;
  v_before public.inventory_balances%rowtype;
  v_after_carton integer;
  v_after_inner integer;
  v_after_unit integer;
  v_operation_id uuid := gen_random_uuid();
  v_operation_number text := format('OP-%s-%s', to_char(current_date, 'YYYYMMDD'), lpad(nextval('public.stock_operation_number_seq')::text, 6, '0'));
  v_staff_id uuid;
  v_requested_qty integer;
begin
  if not public.is_active_staff() then raise exception 'Only active staff can confirm inventory operations'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'At least one product line is required'; end if;
  if p_operation_type not in ('RECEIPT', 'OUTBOUND', 'ADJUSTMENT') then raise exception 'Unsupported operation type: %', p_operation_type; end if;
  if p_is_count and p_operation_type <> 'ADJUSTMENT' then raise exception 'Physical counting must use an adjustment operation'; end if;
  if exists (select 1 from jsonb_array_elements(p_lines) as entry group by entry ->> 'product_id' having count(*) > 1) then raise exception 'Each product may appear only once in an operation'; end if;

  select id into v_staff_id from public.staff where auth_user_id = auth.uid();
  insert into public.stock_operations (id, operation_number, operation_type, status, operator_id, warehouse_id, notes, confirmed_at)
  values (v_operation_id, v_operation_number, p_operation_type, 'CONFIRMED', v_staff_id, p_warehouse_id, nullif(trim(p_notes), ''), now());

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_carton_qty := coalesce((v_line ->> 'carton_qty')::integer, 0);
    v_inner_qty := coalesce((v_line ->> 'inner_qty')::integer, 0);
    v_unit_qty := coalesce((v_line ->> 'unit_qty')::integer, 0);
    if (p_is_count or p_operation_type in ('RECEIPT', 'OUTBOUND')) and (v_carton_qty < 0 or v_inner_qty < 0 or v_unit_qty < 0) then raise exception 'Quantities cannot be negative for this operation'; end if;
    if not p_is_count and abs(v_carton_qty) + abs(v_inner_qty) + abs(v_unit_qty) = 0 then raise exception 'At least one quantity is required for every product line'; end if;

    if p_operation_type in ('RECEIPT', 'ADJUSTMENT') or p_is_count then
      insert into public.inventory_balances (warehouse_id, product_id, is_enabled)
      values (p_warehouse_id, v_product_id, true)
      on conflict (warehouse_id, product_id) do nothing;
    end if;
    select * into v_before from public.inventory_balances where warehouse_id = p_warehouse_id and product_id = v_product_id for update;
    if not found then raise exception 'This product is not enabled at the selected warehouse'; end if;
    if not v_before.is_enabled and not (p_operation_type in ('RECEIPT', 'ADJUSTMENT') or p_is_count) then raise exception 'This product is not enabled at the selected warehouse'; end if;

    if p_is_count then
      v_after_carton := v_carton_qty; v_after_inner := v_inner_qty; v_after_unit := v_unit_qty;
    elsif p_operation_type = 'RECEIPT' then
      v_after_carton := v_before.carton_qty + v_carton_qty; v_after_inner := v_before.inner_qty + v_inner_qty; v_after_unit := v_before.unit_qty + v_unit_qty;
    elsif p_operation_type = 'OUTBOUND' then
      v_after_carton := v_before.carton_qty - v_carton_qty; v_after_inner := v_before.inner_qty - v_inner_qty; v_after_unit := v_before.unit_qty - v_unit_qty;
    else
      v_after_carton := v_before.carton_qty + v_carton_qty; v_after_inner := v_before.inner_qty + v_inner_qty; v_after_unit := v_before.unit_qty + v_unit_qty;
    end if;
    if v_after_carton < 0 or v_after_inner < 0 or v_after_unit < 0 then raise exception 'Insufficient stock for product %', v_product_id; end if;

    update public.inventory_balances set carton_qty = v_after_carton, inner_qty = v_after_inner, unit_qty = v_after_unit, is_enabled = true, updated_at = now() where id = v_before.id;
    v_requested_qty := case when p_is_count then v_carton_qty + v_inner_qty + v_unit_qty else abs(v_carton_qty) + abs(v_inner_qty) + abs(v_unit_qty) end;
    insert into public.stock_operation_items (
      operation_id, product_id, requested_unit, requested_qty, requested_carton_qty, requested_inner_qty, requested_unit_qty,
      delta_carton_qty, delta_inner_qty, delta_unit_qty, before_carton_qty, before_inner_qty, before_unit_qty, after_carton_qty, after_inner_qty, after_unit_qty
    ) values (
      v_operation_id, v_product_id,
      case when abs(v_carton_qty) > 0 then 'carton'::public.requested_unit when abs(v_inner_qty) > 0 then 'inner'::public.requested_unit else 'unit'::public.requested_unit end,
      v_requested_qty, v_carton_qty, v_inner_qty, v_unit_qty,
      v_after_carton - v_before.carton_qty, v_after_inner - v_before.inner_qty, v_after_unit - v_before.unit_qty,
      v_before.carton_qty, v_before.inner_qty, v_before.unit_qty, v_after_carton, v_after_inner, v_after_unit
    );
  end loop;
  return jsonb_build_object('operation_id', v_operation_id, 'operation_number', v_operation_number);
end;
$$;
