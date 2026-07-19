import { createSupabaseServerClient } from "./supabase/server";

export const OPERATION_LOG_PAGE_SIZE = 20;

export interface QuantitySnapshot {
  carton: number;
  inner: number;
  unit: number;
}

export interface OperationLogItem {
  id: string;
  sku: string;
  nameZh: string;
  imageUrl: string | null;
  before: QuantitySnapshot;
  delta: QuantitySnapshot;
  after: QuantitySnapshot;
}

export interface OperationLogEntry {
  id: string;
  operationNumber: string;
  operationType: string;
  operationLabel: string;
  status: string;
  statusLabel: string;
  actorName: string;
  warehouseName: string;
  notes: string | null;
  createdAt: string;
  itemCount: number;
  totals: QuantitySnapshot;
  items: OperationLogItem[];
}

export interface OperationLogResult {
  entries: OperationLogEntry[];
  actorNames: string[];
  total: number;
  page: number;
  pageSize: number;
}

type RawImage = { storage_path: string; is_primary: boolean; sort_order: number };
type RawItem = {
  id: string;
  before_carton_qty: number;
  before_inner_qty: number;
  before_unit_qty: number;
  delta_carton_qty: number;
  delta_inner_qty: number;
  delta_unit_qty: number;
  after_carton_qty: number;
  after_inner_qty: number;
  after_unit_qty: number;
  product: { sku: string; product_name_zh: string; product_images: RawImage[] } | null;
};
type RawOperation = {
  id: string;
  operation_number: string;
  operation_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  warehouse: { name: string } | null;
  operator: { display_name: string } | null;
  stock_operation_items: RawItem[];
};

export function summarizeOperationItems(items: Array<{ delta: QuantitySnapshot }>): QuantitySnapshot {
  return items.reduce((totals, item) => ({
    carton: totals.carton + item.delta.carton,
    inner: totals.inner + item.delta.inner,
    unit: totals.unit + item.delta.unit,
  }), { carton: 0, inner: 0, unit: 0 });
}

export function operationTypeLabel(type: string, itemCount: number) {
  const prefix = itemCount > 1 ? "批量" : "单品";
  if (type === "RECEIPT") return `${prefix}入库`;
  if (type === "OUTBOUND") return `${prefix}出库`;
  if (type === "ADJUSTMENT") return `${prefix}库存调整`;
  if (type === "CORRECTION") return `${prefix}库存更正`;
  if (type === "REVERSAL") return `${prefix}库存冲销`;
  return `${prefix}库存操作`;
}

export function operationStatusLabel(status: string) {
  if (status === "CONFIRMED") return "已确认";
  if (status === "VOIDED") return "已作废";
  if (status === "PREVIEWED") return "待确认";
  if (status === "DRAFT") return "草稿";
  return status;
}

function primaryImagePath(images: RawImage[]) {
  return [...images].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order)[0]?.storage_path ?? null;
}

export async function getOperationLogs({ page = 1, actor }: { page?: number; actor?: string } = {}): Promise<OperationLogResult> {
  const supabase = await createSupabaseServerClient();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * OPERATION_LOG_PAGE_SIZE;
  const { data: staff, error: staffError } = await supabase.from("staff").select("id,display_name").order("display_name");
  if (staffError) throw new Error(`Unable to load operation log actors: ${staffError.message}`);
  const actorNames = [...new Set((staff ?? []).map((row) => row.display_name).filter(Boolean))];
  const actorIds = actor ? (staff ?? []).filter((row) => row.display_name === actor).map((row) => row.id) : [];
  if (actor && actorIds.length === 0) return { entries: [], actorNames, total: 0, page: safePage, pageSize: OPERATION_LOG_PAGE_SIZE };

  let query = supabase.from("stock_operations").select(`
    id, operation_number, operation_type, status, notes, created_at, confirmed_at,
    warehouse:warehouses!stock_operations_warehouse_id_fkey(name),
    operator:staff!stock_operations_operator_id_fkey(display_name),
    stock_operation_items(
      id,
      before_carton_qty, before_inner_qty, before_unit_qty,
      delta_carton_qty, delta_inner_qty, delta_unit_qty,
      after_carton_qty, after_inner_qty, after_unit_qty,
      product:products!stock_operation_items_product_id_fkey(
        sku, product_name_zh,
        product_images(storage_path, is_primary, sort_order)
      )
    )
  `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + OPERATION_LOG_PAGE_SIZE - 1);
  if (actorIds.length === 1) query = query.eq("operator_id", actorIds[0]);
  if (actorIds.length > 1) query = query.in("operator_id", actorIds);

  const { data, error, count } = await query;
  if (error) throw new Error(`Unable to load operation logs: ${error.message}`);
  const operations = (data ?? []) as unknown as RawOperation[];
  const imagePaths = [...new Set(operations.flatMap((operation) => operation.stock_operation_items.flatMap((item) => {
    const path = primaryImagePath(item.product?.product_images ?? []);
    return path ? [path] : [];
  })))];
  const { data: signedImages, error: imageError } = imagePaths.length
    ? await supabase.storage.from("product-images").createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null };
  if (imageError) throw new Error(`Unable to load operation product images: ${imageError.message}`);
  const imageByPath = new Map(imagePaths.map((path, index) => [path, signedImages?.[index]?.signedUrl ?? null]));

  const entries = operations.map((operation): OperationLogEntry => {
    const items = operation.stock_operation_items.map((item): OperationLogItem => {
      const imagePath = primaryImagePath(item.product?.product_images ?? []);
      return {
        id: item.id,
        sku: item.product?.sku ?? "未知 SKU",
        nameZh: item.product?.product_name_zh ?? "商品资料已移除",
        imageUrl: imagePath ? imageByPath.get(imagePath) ?? null : null,
        before: { carton: item.before_carton_qty, inner: item.before_inner_qty, unit: item.before_unit_qty },
        delta: { carton: item.delta_carton_qty, inner: item.delta_inner_qty, unit: item.delta_unit_qty },
        after: { carton: item.after_carton_qty, inner: item.after_inner_qty, unit: item.after_unit_qty },
      };
    });
    return {
      id: operation.id,
      operationNumber: operation.operation_number,
      operationType: operation.operation_type,
      operationLabel: operationTypeLabel(operation.operation_type, items.length),
      status: operation.status,
      statusLabel: operationStatusLabel(operation.status),
      actorName: operation.operator?.display_name ?? "System",
      warehouseName: operation.warehouse?.name ?? "未设置仓库",
      notes: operation.notes,
      createdAt: operation.confirmed_at ?? operation.created_at,
      itemCount: items.length,
      totals: summarizeOperationItems(items),
      items,
    };
  });

  return { entries, actorNames, total: count ?? 0, page: safePage, pageSize: OPERATION_LOG_PAGE_SIZE };
}
