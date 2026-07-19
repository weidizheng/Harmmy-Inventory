export type PackageUnit = "carton" | "inner" | "unit";
export type InventoryStatus = "IN_STOCK" | "OUT_OF_STOCK" | "NOT_ENABLED" | "INACTIVE" | "ARCHIVED";

export interface Balance {
  cartonQty: number;
  innerQty: number;
  unitQty: number;
  isEnabled: boolean;
}

export interface Packaging {
  unitsPerInner: number;
  innersPerCarton: number;
}

export interface OperationLine {
  productId: string;
  unit: PackageUnit;
  quantity: number;
}

export interface OperationResult {
  ok: boolean;
  balances: Record<string, Balance>;
  errors: Record<string, string>;
}

export interface PackagingValidation {
  computedTotal: number;
  error: string | null;
}

export function validatePackagingSource(
  unitsPerInner: number,
  innersPerCarton: number,
  sourceTotal: number,
): PackagingValidation {
  if (![unitsPerInner, innersPerCarton, sourceTotal].every((value) => Number.isInteger(value) && value > 0)) {
    return { computedTotal: unitsPerInner * innersPerCarton, error: "箱规和原表每箱总数必须是大于 0 的整数。" };
  }
  const computedTotal = unitsPerInner * innersPerCarton;
  return {
    computedTotal,
    error: computedTotal === sourceTotal ? null : `箱规计算为 ${computedTotal}，与原表 Quantity/Carton ${sourceTotal} 不一致。`,
  };
}

const quantities = (balance: Balance, unit: PackageUnit): number =>
  unit === "carton" ? balance.cartonQty : unit === "inner" ? balance.innerQty : balance.unitQty;

const validBalance = (balance: Balance): boolean =>
  [balance.cartonQty, balance.innerQty, balance.unitQty].every((value) => Number.isInteger(value) && value >= 0);

export function inventoryStatus(
  balance: Balance | undefined,
  catalogStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE",
): InventoryStatus {
  if (catalogStatus === "INACTIVE") return "INACTIVE";
  if (catalogStatus === "ARCHIVED") return "ARCHIVED";
  if (!balance || !balance.isEnabled) return "NOT_ENABLED";
  return balance.cartonQty + balance.innerQty + balance.unitQty > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

export function validateOutbound(balance: Balance, unit: PackageUnit, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity <= 0) return "Quantity must be a positive integer.";
  if (!balance.isEnabled) return "Product is not enabled in this warehouse.";
  if (!validBalance(balance)) return "Stored inventory is invalid.";
  const available = quantities(balance, unit);
  if (available < quantity) {
    return `Insufficient ${unit} inventory: requested ${quantity}, available ${available}. Automatic package splitting is not allowed.`;
  }
  return null;
}

export function previewOutbound(balances: Record<string, Balance>, lines: OperationLine[]): OperationResult {
  const errors: Record<string, string> = {};
  const required: Record<string, Record<PackageUnit, number>> = {};
  for (const line of lines) {
    if (!required[line.productId]) required[line.productId] = { carton: 0, inner: 0, unit: 0 };
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      errors[line.productId] = "Quantity must be a positive integer.";
    } else {
      required[line.productId][line.unit] += line.quantity;
    }
  }
  for (const [productId, need] of Object.entries(required)) {
    const balance = balances[productId];
    if (!balance) errors[productId] = "No inventory balance exists for this product.";
    else for (const unit of ["carton", "inner", "unit"] as const) {
      const problem = validateOutbound(balance, unit, need[unit]);
      if (need[unit] > 0 && problem) errors[productId] = problem;
    }
  }
  if (Object.keys(errors).length) return { ok: false, balances: structuredClone(balances), errors };
  const next = structuredClone(balances);
  for (const [productId, need] of Object.entries(required)) {
    next[productId].cartonQty -= need.carton;
    next[productId].innerQty -= need.inner;
    next[productId].unitQty -= need.unit;
  }
  return { ok: true, balances: next, errors: {} };
}

export function splitCartons(balance: Balance, packaging: Packaging, quantity: number): Balance {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Split quantity must be a positive integer.");
  if (balance.cartonQty < quantity) throw new Error("Insufficient carton inventory.");
  return { ...balance, cartonQty: balance.cartonQty - quantity, innerQty: balance.innerQty + quantity * packaging.innersPerCarton };
}

export function splitInners(balance: Balance, packaging: Packaging, quantity: number): Balance {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Split quantity must be a positive integer.");
  if (balance.innerQty < quantity) throw new Error("Insufficient inner inventory.");
  return { ...balance, innerQty: balance.innerQty - quantity, unitQty: balance.unitQty + quantity * packaging.unitsPerInner };
}
