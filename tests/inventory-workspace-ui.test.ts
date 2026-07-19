import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../lib/catalog";
import { filterInventoryProducts, productHasStock, summarizeAdjustments } from "../lib/inventory-workspace-ui";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "p1",
    sku: "NAR-100",
    nameZh: "火影忍者手办",
    nameEn: "Naruto Figure",
    ipZh: "火影忍者",
    ipEn: "Naruto",
    productType: "Figure",
    unitsPerInner: 6,
    innersPerCarton: 12,
    quantityPerCarton: 72,
    sizeText: "10cm",
    detailsRaw: "72 pcs/carton",
    isPinned: false,
    imageUrl: null,
    warehouseId: "w1",
    warehouseName: "Montery Park",
    inventory: { cartonQty: 1, innerQty: 0, unitQty: 0, isEnabled: true },
    inventoryTotalUnits: 72,
    ...overrides,
  };
}

const products = [
  product(),
  product({ id: "p2", sku: "JJK-200", nameZh: "咒术回战徽章", nameEn: "Jujutsu Badge", ipZh: "咒术回战", ipEn: "JJK", inventory: { cartonQty: 0, innerQty: 0, unitQty: 0, isEnabled: true }, inventoryTotalUnits: 0 }),
];

describe("inventory display rules", () => {
  it("defines stock from the three real inventory quantities", () => {
    expect(productHasStock(products[0])).toBe(true);
    expect(productHasStock(products[1])).toBe(false);
  });

  it("combines product search with in-stock and out-of-stock filters", () => {
    expect(filterInventoryProducts(products, "", "in_stock").map((item) => item.id)).toEqual(["p1"]);
    expect(filterInventoryProducts(products, "", "all")).toHaveLength(2);
    expect(filterInventoryProducts(products, "JJK", "out_of_stock").map((item) => item.id)).toEqual(["p2"]);
    expect(filterInventoryProducts(products, "Naruto", "out_of_stock")).toEqual([]);
  });

  it("summarizes each changed SKU once and does not convert units", () => {
    expect(summarizeAdjustments({
      p1: { carton: -2, inner: 3, unit: 0 },
      p2: { carton: 0, inner: 2, unit: -7 },
      p3: { carton: 0, inner: 0, unit: 0 },
    })).toEqual({ selectedCount: 2, carton: -2, inner: 5, unit: -7 });
  });
});
