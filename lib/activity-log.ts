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

export const ACTIVITY_PAGE_SIZE = 100;

export const activityCategories = {
  inventory: { label: "库存操作", entityTypes: ["stock_operations", "stock_operation_items"] },
  products: { label: "商品资料", entityTypes: ["products"] },
  warehouses: { label: "仓库管理", entityTypes: ["warehouses"] },
  staff: { label: "员工管理", entityTypes: ["staff"] },
  imports: { label: "数据导入", entityTypes: ["import_batches"] },
} as const;

export type ActivityCategory = keyof typeof activityCategories;

const importantEntityTypes = Object.values(activityCategories).flatMap((category) => [...category.entityTypes]);

export interface ActivityEntry {
  id: string;
  actorName: string;
  categoryLabel: string;
  actionLabel: string;
  description: string;
  detail: string | null;
  createdAt: string;
  tone: "add" | "change" | "remove";
}

export interface ActivityTimelineResult {
  entries: ActivityEntry[];
  actorNames: string[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityTimelineFilters {
  page?: number;
  actor?: string;
  category?: ActivityCategory;
}

const text = (row: JsonRow | null, key: string) => typeof row?.[key] === "string" ? row[key] as string : "";
const number = (row: JsonRow | null, key: string) => typeof row?.[key] === "number" ? row[key] as number : Number(row?.[key] ?? 0);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

function categoryLabel(entityType: string) {
  const match = Object.values(activityCategories).find((category) => (category.entityTypes as readonly string[]).includes(entityType));
  return match?.label ?? "其他操作";
}

export async function getActivityTimeline(filters: ActivityTimelineFilters = {}): Promise<ActivityTimelineResult> {
  const supabase = await createSupabaseServerClient();
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page as number : 1;
  const offset = (page - 1) * ACTIVITY_PAGE_SIZE;
  const selectedEntityTypes = filters.category
    ? [...activityCategories[filters.category].entityTypes]
    : importantEntityTypes;

  let query = supabase.from("activity_logs")
    .select("id,actor_name,action,entity_type,entity_id,before_data,after_data,created_at", { count: "exact" })
    .in("entity_type", selectedEntityTypes)
    .order("created_at", { ascending: false })
    .range(offset, offset + ACTIVITY_PAGE_SIZE - 1);
  if (filters.actor) query = query.eq("actor_name", filters.actor);

  const [{ data, error, count }, { data: staff, error: staffError }] = await Promise.all([
    query,
    supabase.from("staff").select("display_name").order("display_name"),
  ]);
  if (error) throw new Error(`Unable to load activity logs: ${error.message}`);
  if (staffError) throw new Error(`Unable to load activity log actors: ${staffError.message}`);

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

  const entries = logs.map((log): ActivityEntry => {
    const row = log.after_data ?? log.before_data;
    const tone: ActivityEntry["tone"] = log.action === "INSERT" ? "add" : log.action === "DELETE" ? "remove" : "change";
    const common = { id: log.id, actorName: log.actor_name, categoryLabel: categoryLabel(log.entity_type), createdAt: log.created_at, tone };
    if (log.entity_type === "products") {
      const product = productById.get(log.entity_id ?? "");
      const productName = product ? `${product.sku} · ${product.product_name_zh}` : `${text(row, "sku")} · ${text(row, "product_name_zh")}`;
      return { ...common, actionLabel: log.action === "INSERT" ? "添加商品" : log.action === "DELETE" ? "删除商品" : "修改商品", description: productName, detail: null };
    }
    if (log.entity_type === "stock_operation_items") {
      const product = productById.get(text(row, "product_id"));
      const detail = `箱 ${signed(number(row, "delta_carton_qty"))} · 端 ${signed(number(row, "delta_inner_qty"))} · 盒 ${signed(number(row, "delta_unit_qty"))}`;
      return { ...common, tone: "change", actionLabel: "调整库存", description: product ? `${product.sku} · ${product.product_name_zh}` : "商品库存", detail };
    }
    if (log.entity_type === "stock_operations") return { ...common, tone: "change", actionLabel: "确认操作单", description: text(row, "operation_number") || "库存操作", detail: text(row, "notes") || null };
    if (log.entity_type === "warehouses") return { ...common, actionLabel: log.action === "INSERT" ? "添加仓库" : log.action === "DELETE" ? "删除仓库" : "修改仓库", description: text(row, "name"), detail: null };
    if (log.entity_type === "staff") return { ...common, actionLabel: log.action === "INSERT" ? "添加员工" : log.action === "DELETE" ? "删除员工" : "修改员工", description: text(row, "display_name"), detail: null };
    return { ...common, actionLabel: "导入数据", description: text(row, "source_filename") || "商品导入", detail: text(row, "status") || null };
  });

  const actorNames = [...new Set((staff ?? []).map((row) => row.display_name).filter(Boolean))];
  if (!actorNames.includes("System")) actorNames.push("System");

  return { entries, actorNames, total: count ?? 0, page, pageSize: ACTIVITY_PAGE_SIZE };
}
