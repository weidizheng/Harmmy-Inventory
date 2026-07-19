-- The original operation migration was recorded remotely before this sequence
-- was included. Restore it without changing any existing inventory data.
create sequence if not exists public.stock_operation_number_seq;
