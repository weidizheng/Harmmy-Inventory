"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

interface IpOption { id: string; name: string; display_name: string }

async function prepareImage(file: File): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("原始图片不能超过 20 MB。");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("无法读取该图片格式，请改用 JPEG、PNG 或 WebP。"); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("图片压缩失败，请换一张图片重试。");
  if (blob.size > 5 * 1024 * 1024) throw new Error("压缩后的图片仍超过 5 MB，请换一张较小的图片。");
  return blob;
}

const optionalNumber = (value: FormDataEntryValue | null) => value && String(value).trim() ? Number(value) : null;

export function AddProductForm({ ips }: Readonly<{ ips: IpOption[] }>) {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectImage = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setMessage(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!imageFile) { setMessage("请选择或拍摄一张商品图片。"); return; }
    const form = new FormData(event.currentTarget);
    const sku = String(form.get("sku") ?? "").trim().toUpperCase();
    const nameZh = String(form.get("nameZh") ?? "").trim();
    const unitsPerInner = Number(form.get("unitsPerInner"));
    const innersPerCarton = Number(form.get("innersPerCarton"));
    if (!sku || !nameZh || !Number.isInteger(unitsPerInner) || unitsPerInner < 1 || !Number.isInteger(innersPerCarton) || innersPerCarton < 1) {
      setMessage("请填写 SKU、中文名，以及有效的每端件数和每箱端数。"); return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    let storagePath: string | null = null;
    let productId: string | null = null;
    try {
      const image = await prepareImage(imageFile);
      const safeSku = sku.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      storagePath = `products/${safeSku}/${crypto.randomUUID()}-main.jpg`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(storagePath, image, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;

      const details = String(form.get("details") ?? "").trim();
      const { data: product, error: productError } = await supabase.from("products").insert({
        sku,
        product_name_zh: nameZh,
        product_name_en: String(form.get("nameEn") ?? "").trim() || null,
        primary_ip_id: String(form.get("ipId") ?? "") || null,
        product_type: String(form.get("productType") ?? "").trim() || "Other",
        units_per_inner: unitsPerInner,
        inners_per_carton: innersPerCarton,
        quantity_per_carton_source: unitsPerInner * innersPerCarton,
        size_text: String(form.get("sizeText") ?? "").trim() || null,
        details_raw: details || null,
        image_source: "Mobile upload",
        wholesale_price: optionalNumber(form.get("wholesalePrice")),
        retail_price: optionalNumber(form.get("retailPrice")),
        notes: details || null,
      }).select("id").single();
      if (productError) throw productError;
      productId = product.id;
      const { error: imageRecordError } = await supabase.from("product_images").insert({ product_id: productId, storage_path: storagePath, is_primary: true, sort_order: 0, image_type: "product", is_active: true });
      if (imageRecordError) throw imageRecordError;
      setMessage(`已添加 ${sku} · ${nameZh}`);
      router.push("/inventory");
      router.refresh();
    } catch (error) {
      if (productId) await supabase.from("products").delete().eq("id", productId);
      if (storagePath) await supabase.storage.from("product-images").remove([storagePath]);
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text.includes("duplicate") ? "该 SKU 已存在，请检查后再提交。" : `添加失败：${text}`);
    } finally {
      setSubmitting(false);
    }
  };

  return <form className="panel add-product-form" onSubmit={submit}>
    <section className="image-uploader"><label htmlFor="product-image">商品图片（必填）</label><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />{previewUrl ? <img src={previewUrl} alt="待上传商品图片预览" /> : <div className="upload-placeholder">手机可直接拍照或从相册选择</div>}<small>上传前会自动压缩；支持 JPEG、PNG、WebP。</small></section>
    <div className="form-grid"><label>SKU（必填）<input name="sku" required autoCapitalize="characters" placeholder="例如：EAKI1234" /></label><label>中文商品名（主名，必填）<input name="nameZh" required /></label><label>英文商品名（副名）<input name="nameEn" /></label><label>IP<select name="ipId" defaultValue=""><option value="">暂不选择</option>{ips.map((ip) => <option value={ip.id} key={ip.id}>{ip.display_name || ip.name}</option>)}</select></label><label>商品类型<input name="productType" placeholder="例如：Plush / Figure / Badge" /></label><label>尺寸<input name="sizeText" placeholder="例如：Approx. 10cm" /></label><label>每端件数（必填）<input name="unitsPerInner" type="number" min="1" step="1" required /></label><label>每箱端数（必填）<input name="innersPerCarton" type="number" min="1" step="1" required /></label><label>批发价<input name="wholesalePrice" type="number" min="0" step="0.01" /></label><label>零售价<input name="retailPrice" type="number" min="0" step="0.01" /></label></div>
    <label className="full-field">原始 Details<textarea name="details" placeholder="例如：72 pcs/carton, 6 pcs per middle box, 12 middle boxes/carton" /></label>
    <p className="notice">每箱总数会自动按“每端件数 × 每箱端数”计算。新商品库存默认为 0，之后在库存页调整。</p>
    {message && <p className={message.startsWith("已添加") ? "operation-message" : "operation-message error"}>{message}</p>}
    <button className="primary" type="submit" disabled={submitting}>{submitting ? "正在压缩并上传…" : "添加到后台系统"}</button>
  </form>;
}
