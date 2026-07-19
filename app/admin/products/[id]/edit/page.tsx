import { notFound } from "next/navigation";
import { EditProductForm, type EditableProduct } from "../../../../../components/edit-product-form";
import { Shell } from "../../../../../components/shell";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

type ProductRow = {
  id: string;
  sku: string;
  product_name_zh: string;
  product_name_en: string | null;
  primary_ip_id: string | null;
  product_type: string;
  units_per_inner: number | null;
  inners_per_carton: number | null;
  quantity_per_carton_source: number | null;
  size_text: string | null;
  details_raw: string | null;
  wholesale_price: number | string | null;
  retail_price: number | string | null;
  product_images: Array<{ id: string; storage_path: string; is_primary: boolean; sort_order: number }>;
};

export default async function EditProductPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: ips, error: ipError }, { data: balances, error: balanceError }] = await Promise.all([
    supabase.from("products").select("id,sku,product_name_zh,product_name_en,primary_ip_id,product_type,units_per_inner,inners_per_carton,quantity_per_carton_source,size_text,details_raw,wholesale_price,retail_price,product_images(id,storage_path,is_primary,sort_order)").eq("id", id).maybeSingle(),
    supabase.from("ips").select("id,name,display_name").eq("is_active", true).order("sort_order").order("display_name"),
    supabase.from("inventory_balances").select("carton_qty,inner_qty,unit_qty").eq("product_id", id),
  ]);
  if (error) throw new Error(`Unable to load product: ${error.message}`);
  if (ipError) throw new Error(`Unable to load IP options: ${ipError.message}`);
  if (balanceError) throw new Error(`Unable to load product inventory: ${balanceError.message}`);
  if (!data) notFound();

  const row = data as unknown as ProductRow;
  const image = [...row.product_images].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order)[0] ?? null;
  const { data: signedImage, error: imageError } = image
    ? await supabase.storage.from("product-images").createSignedUrl(image.storage_path, 60 * 60)
    : { data: null, error: null };
  if (imageError) throw new Error(`Unable to load product image: ${imageError.message}`);

  const product: EditableProduct = {
    id: row.id,
    sku: row.sku,
    nameZh: row.product_name_zh,
    nameEn: row.product_name_en ?? "",
    ipId: row.primary_ip_id ?? "",
    productType: row.product_type,
    unitsPerInner: row.units_per_inner ?? 1,
    innersPerCarton: row.inners_per_carton ?? 1,
    quantityPerCartonSource: row.quantity_per_carton_source ?? (row.units_per_inner ?? 1) * (row.inners_per_carton ?? 1),
    sizeText: row.size_text ?? "",
    detailsRaw: row.details_raw ?? "",
    wholesalePrice: row.wholesale_price === null ? null : Number(row.wholesale_price),
    retailPrice: row.retail_price === null ? null : Number(row.retail_price),
    currentImageUrl: signedImage?.signedUrl ?? null,
    currentImageRecordId: image?.id ?? null,
    currentStoragePath: image?.storage_path ?? null,
    hasInventory: (balances ?? []).some((balance) => balance.carton_qty > 0 || balance.inner_qty > 0 || balance.unit_qty > 0),
  };

  return <Shell title={`${row.sku} · 编辑商品`}><EditProductForm product={product} ips={ips ?? []} /></Shell>;
}
