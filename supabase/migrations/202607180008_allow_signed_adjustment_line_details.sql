do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.stock_operation_items'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) like '%requested_carton_qty%>= 0%'
        or pg_get_constraintdef(oid) like '%requested_inner_qty%>= 0%'
        or pg_get_constraintdef(oid) like '%requested_unit_qty%>= 0%'
      )
  loop
    execute format('alter table public.stock_operation_items drop constraint %I', constraint_name);
  end loop;
end;
$$;
