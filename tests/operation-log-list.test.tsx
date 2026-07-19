// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OperationLogList } from "../components/operation-log-list";
import type { OperationLogEntry } from "../lib/operation-logs";

afterEach(cleanup);

function operation(overrides: Partial<OperationLogEntry> = {}): OperationLogEntry {
  return {
    id: "operation-1",
    operationNumber: "OP-20260718-000001",
    operationType: "ADJUSTMENT",
    operationLabel: "批量库存调整",
    status: "CONFIRMED",
    statusLabel: "已确认",
    actorName: "Henry",
    warehouseName: "Montery Park",
    notes: "仓库盘点",
    createdAt: "2026-07-18T19:30:00.000Z",
    itemCount: 2,
    totals: { carton: -2, inner: 5, unit: -7 },
    items: [
      {
        id: "item-1",
        sku: "NAR-100",
        nameZh: "火影忍者手办",
        imageUrl: "https://example.com/naruto.jpg",
        before: { carton: 10, inner: 4, unit: 8 },
        delta: { carton: -2, inner: 0, unit: -3 },
        after: { carton: 8, inner: 4, unit: 5 },
      },
      {
        id: "item-2",
        sku: "JJK-200",
        nameZh: "咒术回战徽章",
        imageUrl: null,
        before: { carton: 2, inner: 1, unit: 0 },
        delta: { carton: 0, inner: 5, unit: -4 },
        after: { carton: 2, inner: 6, unit: 0 },
      },
    ],
    ...overrides,
  };
}

describe("operation-level log list", () => {
  it("renders one collapsed summary for the entire submitted operation", () => {
    render(<OperationLogList entries={[operation()]} />);
    expect(screen.getByText("Henry")).toBeTruthy();
    expect(screen.getByText("· 批量库存调整")).toBeTruthy();
    expect(screen.getByText("OP-20260718-000001")).toBeTruthy();
    expect(screen.getByText("改动了 2 个商品")).toBeTruthy();
    expect(screen.getByText("箱 -2")).toBeTruthy();
    expect(screen.queryByText("NAR-100")).toBeNull();
    expect(screen.getByRole("button", { name: /查看 2 项明细/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("expands product image, identity, and before/delta/after snapshots", () => {
    render(<OperationLogList entries={[operation()]} />);
    const toggle = screen.getByRole("button", { name: /查看 2 项明细/ });
    fireEvent.click(toggle);
    const item = screen.getByText("NAR-100").closest("section")!;
    expect(within(item).getByRole("img", { name: "火影忍者手办 商品图片" })).toBeTruthy();
    expect(within(item).getByText("火影忍者手办")).toBeTruthy();
    expect(within(item).getByText("操作前")).toBeTruthy();
    expect(within(item).getByText("本次变化")).toBeTruthy();
    expect(within(item).getByText("操作后")).toBeTruthy();
    expect(within(item).getByText("箱 -2")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.queryByText("NAR-100")).toBeNull();
  });

  it("keeps two operation ids separate even for the same actor and minute", () => {
    const second = operation({ id: "operation-2", operationNumber: "OP-20260718-000002", itemCount: 1, operationLabel: "单品库存调整", items: [operation().items[0]], totals: { carton: -2, inner: 0, unit: -3 } });
    render(<OperationLogList entries={[operation(), second]} />);
    expect(screen.getByText("OP-20260718-000001")).toBeTruthy();
    expect(screen.getByText("OP-20260718-000002")).toBeTruthy();
    expect(document.querySelectorAll(".operation-log-entry")).toHaveLength(2);
  });
});
