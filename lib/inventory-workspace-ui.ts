import type { CatalogProduct } from "./catalog";
import { matchesProductSearch } from "./product-search";

export type InventoryFilter = "in_stock" | "all" | "out_of_stock";
export type InventoryUnit = "carton" | "inner" | "unit";
export type InventoryAdjustment = Record<InventoryUnit, number>;
export interface InventoryAdjustmentSummary {
  selectedCount: number;
  carton: number;
  inner: number;
  unit: number;
}

export const emptyInventoryAdjustment: InventoryAdjustment = { carton: 0, inner: 0, unit: 0 };

export function productHasStock(product: CatalogProduct) {
  return product.inventory.cartonQty > 0 || product.inventory.innerQty > 0 || product.inventory.unitQty > 0;
}

export function filterInventoryProducts(products: CatalogProduct[], query: string, filter: InventoryFilter) {
  return products.filter((product) => {
    if (!matchesProductSearch(product, query)) return false;
    const hasStock = productHasStock(product);
    return filter === "all" || (filter === "in_stock" ? hasStock : !hasStock);
  });
}

export function summarizeAdjustments(adjustments: Record<string, InventoryAdjustment>) {
  const entries = Object.values(adjustments).filter((adjustment) => adjustment.carton || adjustment.inner || adjustment.unit);
  return entries.reduce<InventoryAdjustmentSummary>((summary, adjustment) => ({
    selectedCount: summary.selectedCount + 1,
    carton: summary.carton + adjustment.carton,
    inner: summary.inner + adjustment.inner,
    unit: summary.unit + adjustment.unit,
  }), { selectedCount: 0, carton: 0, inner: 0, unit: 0 });
}

export function formatSignedQuantity(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}
