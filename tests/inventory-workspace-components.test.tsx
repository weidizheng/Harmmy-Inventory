// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CatalogProduct } from "../lib/catalog";
import { InventoryWorkspace } from "../components/inventory-workspace";
import { ProductCards } from "../components/product-cards";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a> }));
const rpcMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ rpc: rpcMock }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

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
    detailsRaw: "Naruto original details",
    isPinned: false,
    imageUrl: null,
    warehouseId: "w1",
    warehouseName: "Montery Park",
    inventory: { cartonQty: 4, innerQty: 3, unitQty: 2, isEnabled: true },
    inventoryTotalUnits: 308,
    ...overrides,
  };
}

const stockedNaruto = product();
const stockedConan = product({ id: "p2", sku: "CON-200", nameZh: "名侦探柯南摆件", nameEn: "Detective Conan Figure", ipZh: "名侦探柯南", ipEn: "Detective Conan", inventory: { cartonQty: 2, innerQty: 1, unitQty: 1, isEnabled: true }, inventoryTotalUnits: 151, detailsRaw: "Conan original details" });
const emptyJjk = product({ id: "p3", sku: "JJK-300", nameZh: "咒术回战徽章", nameEn: "Jujutsu Kaisen Badge", ipZh: "咒术回战", ipEn: "JJK", inventory: { cartonQty: 0, innerQty: 0, unitQty: 0, isEnabled: true }, inventoryTotalUnits: 0, detailsRaw: "JJK original details" });
const products = [stockedNaruto, stockedConan, emptyJjk];

describe("inventory product directory", () => {
  it("defaults to stocked products and can switch to all products", () => {
    render(<ProductCards products={products} />);
    expect(screen.getByText("火影忍者手办")).toBeTruthy();
    expect(screen.queryByText("咒术回战徽章")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /全部商品/ }));
    expect(screen.getByText("咒术回战徽章")).toBeTruthy();
    expect(screen.getByText("3 个结果")).toBeTruthy();
  });

  it("shows only empty products in the out-of-stock filter", () => {
    render(<ProductCards products={products} />);
    fireEvent.click(screen.getByRole("button", { name: /无货商品/ }));
    expect(screen.getByText("咒术回战徽章")).toBeTruthy();
    expect(screen.queryByText("火影忍者手办")).toBeNull();
  });

  it("combines search with the selected inventory filter", () => {
    render(<ProductCards products={products} />);
    fireEvent.click(screen.getByRole("button", { name: /无货商品/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索产品" }), { target: { value: "JJK" } });
    expect(screen.getByText("咒术回战徽章")).toBeTruthy();
    expect(screen.getByText("1 个结果")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "搜索产品" }), { target: { value: "Naruto" } });
    expect(screen.queryByText("火影忍者手办")).toBeNull();
    expect(screen.getByText("0 个结果")).toBeTruthy();
  });

  it("keeps imported details collapsed independently and toggles them in the card", () => {
    render(<ProductCards products={[stockedNaruto, stockedConan]} />);
    expect(screen.queryByText("Naruto original details")).toBeNull();
    const narutoCard = screen.getByText("火影忍者手办").closest("article")!;
    const detailsButton = within(narutoCard).getByRole("button", { name: /查看详情/ });
    expect(detailsButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(detailsButton);
    expect(within(narutoCard).getByText("Naruto original details")).toBeTruthy();
    expect(screen.queryByText("Conan original details")).toBeNull();
    expect(detailsButton.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(detailsButton);
    expect(within(narutoCard).queryByText("Naruto original details")).toBeNull();
  });

  it("opens an inline adjustment for only the selected product", () => {
    render(<ProductCards products={[stockedNaruto]} />);
    const button = screen.getByRole("button", { name: "调整此商品" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: "火影忍者手办 单品调整" })).toBeTruthy();
    const cartonInput = screen.getByLabelText("火影忍者手办 箱单品调整量");
    fireEvent.change(cartonInput, { target: { value: "-2" } });
    expect(within(cartonInput.closest(".single-adjustment-unit") as HTMLElement).getByText("提交后 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "核对并提交此商品" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("名侦探柯南摆件")).toBeNull();
    expect(screen.queryByText("批量调整模式")).toBeNull();
  });

  it("confirms and submits an inline adjustment as one operation line", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: { operation_number: "OP-20260718-000099" }, error: null });
    render(<ProductCards products={[stockedNaruto]} />);
    fireEvent.click(screen.getByRole("button", { name: "调整此商品" }));
    fireEvent.change(screen.getByLabelText("火影忍者手办 盒单品调整量"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "核对并提交此商品" }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(rpcMock.mock.calls[0][0]).toBe("confirm_stock_operation");
    expect(rpcMock.mock.calls[0][1].p_lines).toEqual([{ product_id: "p1", carton_qty: 0, inner_qty: 0, unit_qty: 3 }]);
    expect(await screen.findByText(/已提交 OP-20260718-000099/)).toBeTruthy();
  });
});

describe("bulk inventory adjustment", () => {
  it("shows the fixed summary bar and disables review until a product changes", () => {
    render(<InventoryWorkspace products={[stockedNaruto, stockedConan]} />);
    fireEvent.click(screen.getByRole("button", { name: "开始批量调整" }));
    expect(screen.getByRole("complementary", { name: "批量调整汇总" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看汇总并确认" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "调整此商品" })).toBeNull();
  });

  it("totals changes across multiple products without converting units", () => {
    render(<InventoryWorkspace products={[stockedNaruto, stockedConan]} />);
    fireEvent.click(screen.getByRole("button", { name: "开始批量调整" }));
    fireEvent.change(screen.getByLabelText("火影忍者手办 箱本次调整量"), { target: { value: "-2" } });
    fireEvent.change(screen.getByLabelText("火影忍者手办 盒本次调整量"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("名侦探柯南摆件 端本次调整量"), { target: { value: "5" } });

    const bar = screen.getByRole("complementary", { name: "批量调整汇总" });
    expect(within(bar).getByText("已选择 2 个商品")).toBeTruthy();
    expect(within(bar).getByText("箱 -2")).toBeTruthy();
    expect(within(bar).getByText("端 +5")).toBeTruthy();
    expect(within(bar).getByText("盒 -1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看汇总并确认" }).hasAttribute("disabled")).toBe(false);
  });

  it("cancels the batch and clears all unsubmitted draft changes", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryWorkspace products={[stockedNaruto]} />);
    fireEvent.click(screen.getByRole("button", { name: "开始批量调整" }));
    fireEvent.change(screen.getByLabelText("火影忍者手办 箱本次调整量"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "取消批量调整" }));
    expect(screen.queryByRole("complementary", { name: "批量调整汇总" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "开始批量调整" }));
    expect((screen.getByLabelText("火影忍者手办 箱本次调整量") as HTMLInputElement).value).toBe("0");
    expect(screen.getByRole("button", { name: "查看汇总并确认" }).hasAttribute("disabled")).toBe(true);
  });
});
