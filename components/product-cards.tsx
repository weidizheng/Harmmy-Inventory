"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogProduct } from "../lib/catalog";
import { matchesProductSearch } from "../lib/product-search";

export type InventoryAdjustment = { carton: number; inner: number; unit: number };

const emptyAdjustment: InventoryAdjustment = { carton: 0, inner: 0, unit: 0 };

export function ProductCards({
  products,
  adjustmentMode = false,
  adjustments = {},
  onAdjust,
}: Readonly<{
  products: CatalogProduct[];
  adjustmentMode?: boolean;
  adjustments?: Record<string, InventoryAdjustment>;
  onAdjust?: (productId: string, unit: keyof InventoryAdjustment, change: number) => void;
}>) {
  const [query, setQuery] = useState("");
  const visibleProducts = products.filter((product) => matchesProductSearch(product, query));
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
          {product.imageUrl ? <img className="product-image" src={product.imageUrl} alt={`${product.nameZh} 商品图片`} /> : <div className="image-placeholder" aria-label="暂无商品图片">{product.ipZh.slice(0, 2)}</div>}
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
              <strong>调整后库存</strong>
              {([['carton', '箱'], ['inner', '端'], ['unit', '盒']] as const).map(([unit, label]) => <div className="adjust-unit" key={unit}><span>{label}</span><button type="button" disabled={projected[unit] <= 0} onClick={() => onAdjust?.(product.id, unit, -1)}>−</button><b>{projected[unit]}</b><button type="button" onClick={() => onAdjust?.(product.id, unit, 1)}>＋</button></div>)}
            </div> : product.warehouseId && <Link className="operation-link" href={`/operations/new?product=${product.id}`}>库存操作</Link>}
          </div>
        </article>;
      })}
    </div>
    {visibleProducts.length === 0 && <p className="notice">没有匹配商品。可尝试 SKU、中文名、英文名或 IP 关键词。</p>}
  </>;
}
