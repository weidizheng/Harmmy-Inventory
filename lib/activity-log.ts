import { createSupabaseServerClient } from "./supabase/server";

type JsonRow = Record<string, unknown>;
type AuditRow = {
  id: string;
  actor_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity_type: string;
  entity_id: string | null;
  before_data: JsonRow | null;
  after_data: JsonRow | null;
  created_at: string;
};

export interface ActivityEntry {
  id: string;
  actorName: string;
  actionLabel: string;
  description: string;
  detail: string | null;
  createdAt: string;
  tone: "add" | "change" | "remove";
}

const text = (row: JsonRow | null, key: string) => typeof row?.[key] === "string" ? row[key] as string : "";
const number = (row: JsonRow | null, key: string) => typeof row?.[key] === "number" ? row[key] as number : Number(row?.[key] ?? 0);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

export async function getActivityTimeline(): Promise<ActivityEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("activity_logs")
    .select("id,actor_name,action,entity_type,entity_id,before_data,after_data,created_at")
    .in("entity_type", ["products", "stock_operations", "stock_operation_items", "warehouses", "staff", "import_batches"])
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(`Unable to load activity logs: ${error.message}`);
  const logs = (data ?? []) as AuditRow[];
  const productIds = [...new Set(logs.flatMap((log) => {
    const row = log.after_data ?? log.before_data;
    const productId = log.entity_type === "products" ? log.entity_id : text(row, "product_id");
    return productId ? [productId] : [];
  }))];
  const { data: products, error: productError } = productIds.length
    ? await supabase.from("products").select("id,sku,product_name_zh").in("id", productIds)
    : { data: [], error: null };
  if (productError) throw new Error(`Unable to resolve log products: ${productError.message}`);
  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  return logs.map((log) => {
    const row = log.after_data ?? log.before_data;
    const tone = log.action === "INSERT" ? "add" : log.action === "DELETE" ? "remove" : "change";
    if (log.entity_type === "products") {
      const product = productById.get(log.entity_id ?? "");
      const productName = product ? `${product.sku} · ${product.product_name_zh}` : `${text(row, "sku")} · ${text(row, "product_name_zh")}`;
      return { id: log.id, actorName: log.actor_name, actionLabel: log.action === "INSERT" ? "添加商品" : log.action === "DELETE" ? "删除商品" : "修改商品", description: productName, detail: null, createdAt: log.created_at, tone };
    }
    if (log.entity_type === "stock_operation_items") {
      const product = productById.get(text(row, "product_id"));
      const detail = `箱 ${signed(number(row, "delta_carton_qty"))} · 端 ${signed(number(row, "delta_inner_qty"))} · 盒 ${signed(number(row, "delta_unit_qty"))}`;
      return { id: log.id, actorName: log.actor_name, actionLabel: "调整库存", description: product ? `${product.sku} · ${product.product_name_zh}` : "商品库存", detail, createdAt: log.created_at, tone: "change" };
    }
    if (log.entity_type === "stock_operations") return { id: log.id, actorName: log.actor_name, actionLabel: "确认操作单", description: text(row, "operation_number") || "库存操作", detail: text(row, "notes") || null, createdAt: log.created_at, tone: "change" };
    if (log.entity_type === "warehouses") return { id: log.id, actorName: log.actor_name, actionLabel: log.action === "INSERT" ? "添加仓库" : "修改仓库", description: text(row, "name"), detail: null, createdAt: log.created_at, tone };
    if (log.entity_type === "staff") return { id: log.id, actorName: log.actor_name, actionLabel: log.action === "INSERT" ? "添加员工" : "修改员工", description: text(row, "display_name"), detail: null, createdAt: log.created_at, tone };
    return { id: log.id, actorName: log.actor_name, actionLabel: "导入数据", description: text(row, "source_filename") || "商品导入", detail: text(row, "status") || null, createdAt: log.created_at, tone };
  });
}
