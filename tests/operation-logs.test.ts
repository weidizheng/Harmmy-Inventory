import { describe, expect, it } from "vitest";
import { operationStatusLabel, operationTypeLabel, summarizeOperationItems } from "../lib/operation-logs";

describe("operation log summaries", () => {
  it("sums item deltas without converting carton, inner, or unit quantities", () => {
    expect(summarizeOperationItems([
      { delta: { carton: -2, inner: 3, unit: 0 } },
      { delta: { carton: 0, inner: 2, unit: -7 } },
    ])).toEqual({ carton: -2, inner: 5, unit: -7 });
  });

  it("distinguishes batch and single-product operation labels", () => {
    expect(operationTypeLabel("ADJUSTMENT", 20)).toBe("批量库存调整");
    expect(operationTypeLabel("ADJUSTMENT", 1)).toBe("单品库存调整");
    expect(operationTypeLabel("RECEIPT", 2)).toBe("批量入库");
  });

  it("presents database operation statuses in warehouse language", () => {
    expect(operationStatusLabel("CONFIRMED")).toBe("已确认");
    expect(operationStatusLabel("VOIDED")).toBe("已作废");
  });
});
