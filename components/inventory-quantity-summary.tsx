import type { CatalogProduct } from "../lib/catalog";

export function InventoryQuantitySummary({ product }: Readonly<{ product: CatalogProduct }>) {
  const isEmpty = product.inventory.cartonQty === 0 && product.inventory.innerQty === 0 && product.inventory.unitQty === 0;
  return <section className={isEmpty ? "inventory-quantity-summary empty" : "inventory-quantity-summary"} aria-label={`${product.nameZh} 当前库存`}>
    <div><span>箱</span><b>{product.inventory.cartonQty}</b></div>
    <div><span>端</span><b>{product.inventory.innerQty}</b></div>
    <div><span>盒</span><b>{product.inventory.unitQty}</b></div>
    <p>折合总数：<strong>{product.inventoryTotalUnits}</strong></p>
  </section>;
}
