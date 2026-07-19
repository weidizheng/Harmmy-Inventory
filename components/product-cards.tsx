"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogProduct } from "../lib/catalog";
import { matchesProductSearch } from "../lib/product-search";

export type InventoryAdjustment = { carton: number; inner: number; unit: number };

const emptyAdjustment: InventoryAdjustment = { carton: 0, inner: 0, unit: 0 };

export function ProductCards({
  products,
  adjustmentMode = false,
  adjustments = {},
  onAdjust,
  onSetAdjustment,
}: Readonly<{
  products: CatalogProduct[];
  adjustmentMode?: boolean;
  adjustments?: Record<string, InventoryAdjustment>;
  onAdjust?: (productId: string, unit: keyof InventoryAdjustment, change: number) => void;
  onSetAdjustment?: (productId: string, unit: keyof InventoryAdjustment, value: number) => void;
}>) {
  const [query, setQuery] = useState("");
  const [largeImage, setLargeImage] = useState<{ url: string; alt: string; name: string } | null>(null);
  const visibleProducts = products.filter((product) => matchesProductSearch(product, query));

  useEffect(() => {
    if (!largeImage) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setLargeImage(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [largeImage]);

  return <>
    <div className="toolbar">
      <input aria-label="搜索产品" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU、中文名、英文名或 IP，例如：火影 / Naruto" />
      <span className="search-count">{visibleProducts.length} 个结果</span>
    </div>
    <div className="cards">
      {visibleProducts.map((product) => {
        const adjustment = adjustments[product.id] ?? emptyAdjustment;
        const packageTotal = product.unitsPerInner && product.innersPerCarton
          ? product.unitsPerInner * product.innersPerCarton
          : null;
        const packageMatchesSource = packageTotal !== null && packageTotal === product.quantityPerCarton;
        const projected = {
          carton: product.inventory.cartonQty + adjustment.carton,
          inner: product.inventory.innerQty + adjustment.inner,
          unit: product.inventory.unitQty + adjustment.unit,
        };
        return <article className="card" key={product.id}>
          {product.imageUrl ? <button type="button" className="product-image-button" title="点按查看大图" aria-label={`查看 ${product.nameZh} 大图`} onClick={() => setLargeImage({ url: product.imageUrl!, alt: `${product.nameZh} 商品图片`, name: `${product.sku} · ${product.nameZh}` })}><img className="product-image" src={product.imageUrl} alt={`${product.nameZh} 商品图片`} loading="lazy" decoding="async" /></button> : <div className="image-placeholder" aria-label="暂无商品图片">{product.ipZh.slice(0, 2)}</div>}
          <div className="card-copy">
            <div className="card-title"><div><code>{product.sku}</code><h3>{product.nameZh}</h3>{product.nameEn && <p className="secondary-name">{product.nameEn}</p>}</div><div className="card-actions">{product.isPinned && <span title="重点商品">★</span>}{!adjustmentMode && <Link className="edit-product-link" href={`/admin/products/${product.id}/edit`}>编辑商品</Link>}</div></div>
            <p>{product.ipZh}{product.ipEn && product.ipEn !== product.ipZh ? ` / ${product.ipEn}` : ""} · {product.productType}</p>
            {product.sizeText && <p className="product-size">尺寸：{product.sizeText}</p>}
            <div className="quantities" aria-label="箱规"><span>中盒件数<b>{product.unitsPerInner ?? "—"}</b></span><span>每箱中盒<b>{product.innersPerCarton ?? "—"}</b></span><span>每箱总数<b>{product.quantityPerCarton ?? "—"}</b></span></div>
            <section className="source-audit" aria-label="原表审核信息">
              <div><span>原表 Quantity/Carton</span><b>{product.quantityPerCarton ?? "未填写"}</b></div>
              <div><span>箱规计算</span><b className={packageTotal !== null && !packageMatchesSource ? "package-mismatch" : ""}>{packageTotal === null ? "箱规未完整" : `${product.unitsPerInner} × ${product.innersPerCarton} = ${packageTotal}`}{packageTotal !== null && !packageMatchesSource ? "（不一致）" : ""}</b></div>
              <p><span>原表 Details</span>{product.detailsRaw || "未填写原始 Details"}</p>
            </section>
            {product.warehouseName && <p className="inventory-summary">{product.warehouseName} 库存：箱 {product.inventory.cartonQty} · 端 {product.inventory.innerQty} · 盒 {product.inventory.unitQty} · 折合总数 {product.inventoryTotalUnits}</p>}
            {adjustmentMode ? <div className="card-adjuster" aria-label={`${product.nameZh} 库存调整`}>
              <strong>本次调整量 <small>正数入库，负数出库</small></strong>
              {([['carton', '箱', product.inventory.cartonQty], ['inner', '端', product.inventory.innerQty], ['unit', '盒', product.inventory.unitQty]] as const).map(([unit, label, currentQty]) => <div className="adjust-unit" key={unit}><span>{label}<small>当前 {currentQty}</small></span><div><button type="button" disabled={projected[unit] <= 0} onClick={() => onAdjust?.(product.id, unit, -1)}>−</button><input type="number" step="1" min={-currentQty} value={adjustment[unit]} aria-label={`${product.nameZh} ${label}本次调整量`} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && currentQty + value >= 0) onSetAdjustment?.(product.id, unit, value); }} /><button type="button" onClick={() => onAdjust?.(product.id, unit, 1)}>＋</button></div><small>提交后 {projected[unit]}</small></div>)}
            </div> : product.warehouseId && <Link className="operation-link" href={`/operations/new?product=${product.id}`}>库存操作</Link>}
          </div>
        </article>;
      })}
    </div>
    {visibleProducts.length === 0 && <p className="notice">没有匹配商品。可尝试 SKU、中文名、英文名或 IP 关键词。</p>}
    {largeImage && <div className="image-lightbox" role="presentation" onClick={() => setLargeImage(null)}><section role="dialog" aria-modal="true" aria-label={`${largeImage.name} 大图`} onClick={(event) => event.stopPropagation()}><button type="button" className="image-lightbox-close" aria-label="关闭大图" onClick={() => setLargeImage(null)}>×</button><img src={largeImage.url} alt={largeImage.alt} /><p>{largeImage.name}</p></section></div>}
  </>;
}
