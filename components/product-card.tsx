"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { CatalogProduct } from "../lib/catalog";
import type { InventoryAdjustment, InventoryUnit } from "../lib/inventory-workspace-ui";
import { InventoryQuantitySummary } from "./inventory-quantity-summary";
import { ProductDetailsDisclosure } from "./product-details-disclosure";
import { SingleProductAdjustment } from "./single-product-adjustment";

const unitRows: Array<{ unit: InventoryUnit; label: string; inventoryKey: "cartonQty" | "innerQty" | "unitQty" }> = [
  { unit: "carton", label: "箱", inventoryKey: "cartonQty" },
  { unit: "inner", label: "端", inventoryKey: "innerQty" },
  { unit: "unit", label: "盒", inventoryKey: "unitQty" },
];

export function ProductCard({
  product,
  adjustmentMode,
  adjustment,
  onAdjust,
  onSetAdjustment,
  onOpenImage,
}: Readonly<{
  product: CatalogProduct;
  adjustmentMode: boolean;
  adjustment: InventoryAdjustment;
  onAdjust?: (productId: string, unit: InventoryUnit, change: number) => void;
  onSetAdjustment?: (productId: string, unit: InventoryUnit, value: number) => void;
  onOpenImage: (image: { url: string; alt: string; name: string }) => void;
}>) {
  const [singleAdjustmentOpen, setSingleAdjustmentOpen] = useState(false);
  const singleAdjustmentId = useId();

  useEffect(() => {
    if (adjustmentMode) setSingleAdjustmentOpen(false);
  }, [adjustmentMode]);

  return <article className="card product-card">
    <div className="product-card-main">
      {product.imageUrl
        ? <button type="button" className="product-image-button" title="点击查看大图" aria-label={`查看 ${product.nameZh} 大图`} onClick={() => onOpenImage({ url: product.imageUrl!, alt: `${product.nameZh} 商品图片`, name: `${product.sku} · ${product.nameZh}` })}>
          <img className="product-image" src={product.imageUrl} alt={`${product.nameZh} 商品图片`} loading="lazy" decoding="async" />
        </button>
        : <div className="image-placeholder" aria-label="暂无商品图片">{product.ipZh.slice(0, 2)}</div>}

      <div className="card-copy">
        <div className="card-title">
          <div>
            <code>{product.sku}</code>
            <h3>{product.nameZh}</h3>
            {product.nameEn && <p className="secondary-name">{product.nameEn}</p>}
          </div>
          <div className="card-actions">
            {product.isPinned && <span title="重点商品" aria-label="重点商品">★</span>}
            {!adjustmentMode && <Link className="edit-product-link" href={`/admin/products/${product.id}/edit`}>编辑资料</Link>}
          </div>
        </div>
        <p className="product-classification"><span>{product.ipZh}{product.ipEn && product.ipEn !== product.ipZh ? ` / ${product.ipEn}` : ""}</span><span>{product.productType}</span></p>
        {product.sizeText && <p className="product-size">尺寸：{product.sizeText}</p>}
        <InventoryQuantitySummary product={product} />
      </div>
    </div>

    {adjustmentMode && <div className="card-adjuster" aria-label={`${product.nameZh} 库存调整`}>
      <strong>本次变化 <small>正数入库，负数出库；可直接输入</small></strong>
      {unitRows.map(({ unit, label, inventoryKey }) => {
        const currentQty = product.inventory[inventoryKey];
        const projectedQty = currentQty + adjustment[unit];
        return <div className="adjust-unit" key={unit}>
          <span>{label}<small>当前 {currentQty}</small></span>
          <div>
            <button type="button" aria-label={`${product.nameZh} ${label}减少 1`} disabled={projectedQty <= 0} onClick={() => onAdjust?.(product.id, unit, -1)}>−</button>
            <input type="number" step="1" min={-currentQty} value={adjustment[unit]} aria-label={`${product.nameZh} ${label}本次调整量`} onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && currentQty + value >= 0) onSetAdjustment?.(product.id, unit, value);
            }} />
            <button type="button" aria-label={`${product.nameZh} ${label}增加 1`} onClick={() => onAdjust?.(product.id, unit, 1)}>+</button>
          </div>
          <small>提交后 {projectedQty}</small>
        </div>;
      })}
    </div>}

    {!adjustmentMode && singleAdjustmentOpen && <SingleProductAdjustment product={product} id={singleAdjustmentId} onCancel={() => setSingleAdjustmentOpen(false)} />}

    <footer className="product-card-footer">
      {!adjustmentMode && product.warehouseId && !singleAdjustmentOpen && <button type="button" className="operation-link" aria-expanded="false" aria-controls={singleAdjustmentId} onClick={() => setSingleAdjustmentOpen(true)}>调整此商品</button>}
      {adjustmentMode && <span className="bulk-card-label">批量调整模式</span>}
      <ProductDetailsDisclosure product={product} />
    </footer>
  </article>;
}
