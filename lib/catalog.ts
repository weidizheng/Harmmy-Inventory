import { createSupabaseServerClient } from "./supabase/server";

export interface CatalogProduct {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  ipZh: string;
  ipEn: string;
  productType: string;
  unitsPerInner: number | null;
  innersPerCarton: number | null;
  quantityPerCarton: number | null;
  sizeText: string | null;
  detailsRaw: string | null;
  isPinned: boolean;
  imageUrl: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  inventory: { cartonQty: number; innerQty: number; unitQty: number; isEnabled: boolean };
}

type CatalogRow = {
  id: string;
  sku: string;
  product_name_zh: string;
  product_name_en: string | null;
  product_type: string;
  units_per_inner: number | null;
  inners_per_carton: number | null;
  quantity_per_carton_source: number | null;
  size_text: string | null;
  details_raw: string | null;
  is_pinned: boolean;
  primary_ip: { name: string; display_name: string } | null;
  product_images: Array<{ storage_path: string; is_primary: boolean; sort_order: number }>;
};

/** Returns the active catalog and short-lived URLs for private product images. */
export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: warehouse, error: warehouseError }] = await Promise.all([
    supabase
    .from("products")
    .select(`
      id, sku, product_name_zh, product_name_en, product_type,
      units_per_inner, inners_per_carton, quantity_per_carton_source,
      size_text, details_raw, is_pinned,
      primary_ip:ips!products_primary_ip_id_fkey(name, display_name),
      product_images(storage_path, is_primary, sort_order)
    `)
    .eq("catalog_status", "ACTIVE")
    .order("is_pinned", { ascending: false })
    .order("sort_weight", { ascending: false })
    .order("product_name_zh", { ascending: true }),
    supabase.from("warehouses").select("id,name").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  if (error) throw new Error(`Unable to load product catalog: ${error.message}`);
  if (warehouseError) throw new Error(`Unable to load warehouse: ${warehouseError.message}`);

  const rows = (data ?? []) as unknown as CatalogRow[];
  const { data: balances, error: balancesError } = warehouse
    ? await supabase.from("inventory_balances").select("product_id,carton_qty,inner_qty,unit_qty,is_enabled").eq("warehouse_id", warehouse.id)
    : { data: [], error: null };
  if (balancesError) throw new Error(`Unable to load inventory balances: ${balancesError.message}`);
  const balanceByProduct = new Map((balances ?? []).map((balance) => [balance.product_id, balance]));
  const imageUrls = await Promise.all(rows.map(async (product) => {
    const image = [...product.product_images]
      .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order)[0];
    if (!image) return null;
    const { data: signedImage, error: imageError } = await supabase.storage
      .from("product-images")
      .createSignedUrl(image.storage_path, 60 * 60);
    if (imageError) throw new Error(`Unable to load image for ${product.sku}: ${imageError.message}`);
    return signedImage.signedUrl;
  }));

  return rows.map((product, index) => ({
    id: product.id,
    sku: product.sku,
    nameZh: product.product_name_zh,
    nameEn: product.product_name_en ?? "",
    ipZh: product.primary_ip?.display_name ?? product.primary_ip?.name ?? "未分类 IP",
    ipEn: product.primary_ip?.name ?? "",
    productType: product.product_type,
    unitsPerInner: product.units_per_inner,
    innersPerCarton: product.inners_per_carton,
    quantityPerCarton: product.quantity_per_carton_source,
    sizeText: product.size_text,
    detailsRaw: product.details_raw,
    isPinned: product.is_pinned,
    imageUrl: imageUrls[index],
    warehouseId: warehouse?.id ?? null,
    warehouseName: warehouse?.name ?? null,
    inventory: {
      cartonQty: balanceByProduct.get(product.id)?.carton_qty ?? 0,
      innerQty: balanceByProduct.get(product.id)?.inner_qty ?? 0,
      unitQty: balanceByProduct.get(product.id)?.unit_qty ?? 0,
      isEnabled: balanceByProduct.get(product.id)?.is_enabled ?? false,
    },
  }));
}
