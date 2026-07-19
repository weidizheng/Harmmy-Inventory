import { describe, expect, it } from "vitest";
import { inventoryStatus, previewOutbound, splitCartons, splitInners, validateOutbound, validatePackagingSource, type Balance } from "../lib/inventory-rules";

const balance = (overrides: Partial<Balance> = {}): Balance => ({ cartonQty: 3, innerQty: 2, unitQty: 4, isEnabled: true, ...overrides });

describe("manual package splitting", () => {
  it("fails a request for six inners when only two loose inners exist", () => expect(validateOutbound(balance(), "inner", 6)).toContain("available 2"));
  it("does not use cartons for an insufficient inner request", () => expect(previewOutbound({ a: balance() }, [{ productId: "a", unit: "inner", quantity: 6 }]).balances.a).toEqual(balance()));
  it("fails a request for six units when only two loose units exist", () => expect(validateOutbound(balance({ unitQty: 2 }), "unit", 6)).toContain("available 2"));
  it("does not use inners for an insufficient unit request", () => expect(previewOutbound({ a: balance({ cartonQty: 0, innerQty: 5, unitQty: 2 }) }, [{ productId: "a", unit: "unit", quantity: 6 }]).ok).toBe(false));
  it("splitting one carton decreases only cartons and adds the configured inners", () => expect(splitCartons(balance(), { unitsPerInner: 6, innersPerCarton: 12 }, 1)).toMatchObject({ cartonQty: 2, innerQty: 14, unitQty: 4 }));
  it("splitting one inner decreases only inners and adds the configured units", () => expect(splitInners(balance(), { unitsPerInner: 6, innersPerCarton: 12 }, 1)).toMatchObject({ cartonQty: 3, innerQty: 1, unitQty: 10 }));
  it("does not normalize loose units into inners", () => expect(() => splitInners(balance({ cartonQty: 0, innerQty: 0, unitQty: 12 }), { unitsPerInner: 6, innersPerCarton: 12 }, 1)).toThrow("Insufficient"));
  it("rejects a split with insufficient cartons", () => expect(() => splitCartons(balance({ cartonQty: 0 }), { unitsPerInner: 6, innersPerCarton: 12 }, 1)).toThrow("Insufficient"));
  it("rejects a split with insufficient inners", () => expect(() => splitInners(balance({ innerQty: 0 }), { unitsPerInner: 6, innersPerCarton: 12 }, 1)).toThrow("Insufficient"));
});

describe("atomic multi-SKU operations", () => {
  it("commits all lines when every SKU has inventory", () => { const r = previewOutbound({ a: balance(), b: balance({ cartonQty: 4 }) }, [{ productId: "a", unit: "inner", quantity: 2 }, { productId: "b", unit: "carton", quantity: 3 }]); expect(r).toMatchObject({ ok: true, balances: { a: { innerQty: 0 }, b: { cartonQty: 1 } } }); });
  it("fails the full operation when any SKU is insufficient", () => expect(previewOutbound({ a: balance(), b: balance({ unitQty: 0 }) }, [{ productId: "a", unit: "carton", quantity: 1 }, { productId: "b", unit: "unit", quantity: 1 }]).ok).toBe(false));
  it("leaves other SKU balances unchanged on failure", () => { const source = { a: balance(), b: balance({ unitQty: 0 }) }; expect(previewOutbound(source, [{ productId: "a", unit: "carton", quantity: 1 }, { productId: "b", unit: "unit", quantity: 1 }]).balances).toEqual(source); });
  it("prevents negative inventory", () => expect(previewOutbound({ a: balance({ cartonQty: 0 }) }, [{ productId: "a", unit: "carton", quantity: 1 }]).ok).toBe(false));
  it("aggregates duplicate lines for a product", () => expect(previewOutbound({ a: balance({ unitQty: 4 }) }, [{ productId: "a", unit: "unit", quantity: 2 }, { productId: "a", unit: "unit", quantity: 3 }]).ok).toBe(false));
  it("rejects an unknown balance", () => expect(previewOutbound({}, [{ productId: "missing", unit: "unit", quantity: 1 }]).errors.missing).toContain("No inventory"));
});

describe("derived inventory statuses", () => {
  it("is NOT_ENABLED without a balance", () => expect(inventoryStatus(undefined)).toBe("NOT_ENABLED"));
  it("is OUT_OF_STOCK for an enabled zero balance", () => expect(inventoryStatus(balance({ cartonQty: 0, innerQty: 0, unitQty: 0 }))).toBe("OUT_OF_STOCK"));
  it("is IN_STOCK when any physical package has inventory", () => expect(inventoryStatus(balance({ cartonQty: 1, innerQty: 0, unitQty: 0 }))).toBe("IN_STOCK"));
  it("is IN_STOCK with cartons even when an inner request fails", () => { expect(inventoryStatus(balance({ cartonQty: 1, innerQty: 0, unitQty: 0 }))).toBe("IN_STOCK"); expect(validateOutbound(balance({ cartonQty: 1, innerQty: 0, unitQty: 0 }), "inner", 1)).toContain("Insufficient"); });
  it("respects inactive catalog status", () => expect(inventoryStatus(balance(), "INACTIVE")).toBe("INACTIVE"));
  it("respects archived catalog status", () => expect(inventoryStatus(balance(), "ARCHIVED")).toBe("ARCHIVED"));
});

describe("source packaging validation", () => {
  it("accepts a package calculation matching the source quantity", () => expect(validatePackagingSource(6, 12, 72)).toEqual({ computedTotal: 72, error: null }));
  it("reports a mismatch against the source quantity", () => expect(validatePackagingSource(6, 12, 144).error).toContain("不一致"));
  it("rejects non-positive package values", () => expect(validatePackagingSource(0, 12, 72).error).toContain("大于 0"));
});
