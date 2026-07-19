"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validatePackagingSource } from "../lib/inventory-rules";
import { createProductImagePath, prepareProductImage } from "../lib/product-image";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

interface IpOption { id: string; name: string; display_name: string }

export interface EditableProduct {
  id: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  ipId: string;
  productType: string;
  unitsPerInner: number;
  innersPerCarton: number;
  quantityPerCartonSource: number;
  sizeText: string;
  detailsRaw: string;
  wholesalePrice: number | null;
  retailPrice: number | null;
  currentImageUrl: string | null;
  currentImageRecordId: string | null;
  currentStoragePath: string | null;
  hasInventory: boolean;
}

const optionalNumber = (value: FormDataEntryValue | null) => value && String(value).trim() ? Number(value) : null;

export function EditProductForm({ product, ips }: Readonly<{ product: EditableProduct; ips: IpOption[] }>) {
  const router = useRouter();
  const [unitsPerInner, setUnitsPerInner] = useState(String(product.unitsPerInner));
  const [innersPerCarton, setInnersPerCarton] = useState(String(product.innersPerCarton));
  const [sourceTotal, setSourceTotal] = useState(String(product.quantityPerCartonSource));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const packaging = validatePackagingSource(Number(unitsPerInner), Number(innersPerCarton), Number(sourceTotal));

  const selectImage = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setMessage(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const sku = String(form.get("sku") ?? "").trim().toUpperCase();
    const nameZh = String(form.get("nameZh") ?? "").trim();
    const parsedUnits = Number(unitsPerInner);
    const parsedInners = Number(innersPerCarton);
    const parsedSourceTotal = Number(sourceTotal);
    const validation = validatePackagingSource(parsedUnits, parsedInners, parsedSourceTotal);
    if (!sku || !nameZh) { setMessage("SKU 和中文商品名不能为空。"); return; }
    if (validation.error) { setMessage(validation.error); return; }

    const packagingChanged = parsedUnits !== product.unitsPerInner
      || parsedInners !== product.innersPerCarton
      || parsedSourceTotal !== product.quantityPerCartonSource;
    if (packagingChanged && product.hasInventory && !window.confirm("该商品已有库存。修改箱规会改变折合总数和商品排序，但不会自动改变现有箱、端、盒数量。确认继续吗？")) return;

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    let newStoragePath: string | null = null;
    let insertedImageId: string | null = null;
    let imageRecordApplied = false;
    try {
      if (imageFile) {
        const image = await prepareProductImage(imageFile);
        newStoragePath = createProductImagePath(sku);
        const { error: uploadError } = await supabase.storage.from("product-images").upload(newStoragePath, image, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
        if (product.currentImageRecordId) {
          const { error: imageUpdateError } = await supabase.from("product_images").update({ storage_path: newStoragePath }).eq("id", product.currentImageRecordId);
          if (imageUpdateError) throw imageUpdateError;
          imageRecordApplied = true;
        } else {
          const { data: insertedImage, error: imageInsertError } = await supabase.from("product_images").insert({ product_id: product.id, storage_path: newStoragePath, is_primary: true, sort_order: 0, image_type: "product", is_active: true }).select("id").single();
          if (imageInsertError) throw imageInsertError;
          insertedImageId = insertedImage.id;
          imageRecordApplied = true;
        }
      }

      const details = String(form.get("details") ?? "").trim();
      const { error: productError } = await supabase.from("products").update({
        sku,
        product_name_zh: nameZh,
        product_name_en: String(form.get("nameEn") ?? "").trim() || null,
        primary_ip_id: String(form.get("ipId") ?? "") || null,
        product_type: String(form.get("productType") ?? "").trim() || "Other",
        units_per_inner: parsedUnits,
        inners_per_carton: parsedInners,
        quantity_per_carton_source: parsedSourceTotal,
        size_text: String(form.get("sizeText") ?? "").trim() || null,
        details_raw: details || null,
        wholesale_price: optionalNumber(form.get("wholesalePrice")),
        retail_price: optionalNumber(form.get("retailPrice")),
      }).eq("id", product.id);
      if (productError) throw productError;

      if (newStoragePath && product.currentStoragePath) {
        await supabase.storage.from("product-images").remove([product.currentStoragePath]);
      }
      router.push("/inventory");
      router.refresh();
    } catch (error) {
      if (newStoragePath) {
        if (imageRecordApplied && product.currentImageRecordId && product.currentStoragePath) {
          await supabase.from("product_images").update({ storage_path: product.currentStoragePath }).eq("id", product.currentImageRecordId);
        } else if (imageRecordApplied && insertedImageId) {
          await supabase.from("product_images").delete().eq("id", insertedImageId);
        }
        await supabase.storage.from("product-images").remove([newStoragePath]);
      }
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text.includes("duplicate") ? "该 SKU 已被其他商品使用。" : `保存失败：${text}`);
    } finally {
      setSubmitting(false);
    }
  };

  const shownImage = previewUrl || product.currentImageUrl;
  return <form className="panel add-product-form edit-product-form" onSubmit={submit}>
    <div className="edit-form-heading"><div><code>{product.sku}</code><h2>编辑商品资料</h2></div><Link className="history-link" href="/inventory">返回库存</Link></div>
    <section className="image-uploader"><label htmlFor="product-image">商品图片（不选择则保留原图）</label><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />{shownImage ? <img src={shownImage} alt={`${product.nameZh} 商品图片预览`} /> : <div className="upload-placeholder">当前没有商品图片，可从手机拍照或相册选择</div>}<small>新图片会自动压缩并替换主图；支持 JPEG、PNG、WebP。</small></section>
    <div className="form-grid"><label>SKU（必填）<input name="sku" required autoCapitalize="characters" defaultValue={product.sku} /></label><label>中文商品名（主名，必填）<input name="nameZh" required defaultValue={product.nameZh} /></label><label>英文商品名（副名）<input name="nameEn" defaultValue={product.nameEn} /></label><label>IP<select name="ipId" defaultValue={product.ipId}><option value="">暂不选择</option>{ips.map((ip) => <option value={ip.id} key={ip.id}>{ip.display_name || ip.name}</option>)}</select></label><label>商品类型<input name="productType" defaultValue={product.productType} /></label><label>尺寸<input name="sizeText" defaultValue={product.sizeText} placeholder="例如：Approx. 10cm" /></label><label>中盒件数（必填）<input name="unitsPerInner" type="number" min="1" step="1" required value={unitsPerInner} onChange={(event) => setUnitsPerInner(event.target.value)} /></label><label>每箱中盒（必填）<input name="innersPerCarton" type="number" min="1" step="1" required value={innersPerCarton} onChange={(event) => setInnersPerCarton(event.target.value)} /></label><label>原表 Quantity/Carton（必填）<input name="sourceTotal" type="number" min="1" step="1" required value={sourceTotal} onChange={(event) => setSourceTotal(event.target.value)} /></label><label>批发价<input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={product.wholesalePrice ?? ""} /></label><label>零售价<input name="retailPrice" type="number" min="0" step="0.01" defaultValue={product.retailPrice ?? ""} /></label></div>
    <div className={packaging.error ? "package-check error" : "package-check"}><span>箱规计算</span><b>{Number(unitsPerInner) || 0} × {Number(innersPerCarton) || 0} = {packaging.computedTotal || 0}</b><small>{packaging.error || "与原表 Quantity/Carton 一致，可以保存。"}</small></div>
    <label className="full-field">原表 Details<textarea name="details" defaultValue={product.detailsRaw} placeholder="例如：72 pcs/carton, 6 pcs per middle box, 12 middle boxes/carton" /></label>
    {product.hasInventory && <p className="notice">该商品已有实际库存。这里修改的是商品资料和箱规；如需增加或扣减箱、端、盒，请返回库存页使用“调整库存”。</p>}
    {message && <p className="operation-message error">{message}</p>}
    <button className="primary" type="submit" disabled={submitting || Boolean(packaging.error)}>{submitting ? "正在保存…" : "保存商品资料"}</button>
  </form>;
}
