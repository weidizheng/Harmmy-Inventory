"use client";

import type { InventoryFilter } from "../lib/inventory-workspace-ui";

const filters: Array<{ value: InventoryFilter; label: string }> = [
  { value: "in_stock", label: "有货商品" },
  { value: "all", label: "全部商品" },
  { value: "out_of_stock", label: "无货商品" },
];

export function InventoryFilterTabs({ value, counts, onChange }: Readonly<{
  value: InventoryFilter;
  counts: Record<InventoryFilter, number>;
  onChange: (value: InventoryFilter) => void;
}>) {
  return <div className="inventory-filter-tabs" role="group" aria-label="库存状态筛选">
    {filters.map((filter) => <button type="button" key={filter.value} aria-pressed={value === filter.value} className={value === filter.value ? "active" : ""} onClick={() => onChange(filter.value)}>{filter.label}<span>{counts[filter.value]}</span></button>)}
  </div>;
}
