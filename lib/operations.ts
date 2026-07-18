import { createSupabaseServerClient } from "./supabase/server";

type OperationRow = {
  id: string;
  operation_number: string;
  operation_type: "RECEIPT" | "OUTBOUND" | "ADJUSTMENT";
  status: string;
  notes: string | null;
  created_at: string;
  warehouse: { name: string } | null;
  operator: { display_name: string } | null;
  stock_operation_items: Array<{
    requested_carton_qty: number;
    requested_inner_qty: number;
    requested_unit_qty: number;
    product: { sku: string; product_name_zh: string } | null;
  }>;
};

export async function getRecentOperations() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("stock_operations").select(`
    id, operation_number, operation_type, status, notes, created_at,
    warehouse:warehouses!stock_operations_warehouse_id_fkey(name),
    operator:staff!stock_operations_operator_id_fkey(display_name),
    stock_operation_items(
      requested_carton_qty, requested_inner_qty, requested_unit_qty,
      product:products!stock_operation_items_product_id_fkey(sku, product_name_zh)
    )
  `).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`Unable to load operations: ${error.message}`);
  return (data ?? []) as unknown as OperationRow[];
}

export function operationLabel(type: OperationRow["operation_type"]) {
  return type === "RECEIPT" ? "入库" : type === "OUTBOUND" ? "出库" : "库存盘点";
}
