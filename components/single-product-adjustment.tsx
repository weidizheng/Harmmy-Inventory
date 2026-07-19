"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "../lib/catalog";
import { emptyInventoryAdjustment, type InventoryAdjustment, type InventoryUnit } from "../lib/inventory-workspace-ui";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

const unitRows: Array<{ unit: InventoryUnit; label: string; inventoryKey: "cartonQty" | "innerQty" | "unitQty" }> = [
  { unit: "carton", label: "箱", inventoryKey: "cartonQty" },
  { unit: "inner", label: "端", inventoryKey: "innerQty" },
  { unit: "unit", label: "盒", inventoryKey: "unitQty" },
];

export function SingleProductAdjustment({ product, id, onCancel }: Readonly<{ product: CatalogProduct; id: string; onCancel: () => void }>) {
  const router = useRouter();
  const [adjustment, setAdjustment] = useState<InventoryAdjustment>(emptyInventoryAdjustment);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hasChange = adjustment.carton !== 0 || adjustment.inner !== 0 || adjustment.unit !== 0;

  const setUnit = (unit: InventoryUnit, value: number) => {
    if (!Number.isInteger(value)) return;
    const row = unitRows.find((candidate) => candidate.unit === unit)!;
    if (product.inventory[row.inventoryKey] + value < 0) return;
    setMessage(null);
    setAdjustment((current) => ({ ...current, [unit]: value }));
  };

  const cancel = () => {
    if (hasChange && !window.confirm("尚有未提交调整，确定要清空吗？")) return;
    setAdjustment(emptyInventoryAdjustment);
    setNotes("");
    setMessage(null);
    onCancel();
  };

  const submit = async () => {
    if (!hasChange || !product.warehouseId) return;
    const after = {
      carton: product.inventory.cartonQty + adjustment.carton,
      inner: product.inventory.innerQty + adjustment.inner,
      unit: product.inventory.unitQty + adjustment.unit,
    };
    const confirmed = window.confirm(
      `确认调整 ${product.sku} · ${product.nameZh}？\n\n` +
      `箱 ${product.inventory.cartonQty} → ${after.carton}（${adjustment.carton >= 0 ? "+" : ""}${adjustment.carton}）\n` +
      `端 ${product.inventory.innerQty} → ${after.inner}（${adjustment.inner >= 0 ? "+" : ""}${adjustment.inner}）\n` +
      `盒 ${product.inventory.unitQty} → ${after.unit}（${adjustment.unit >= 0 ? "+" : ""}${adjustment.unit}）`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("confirm_stock_operation", {
        p_operation_type: "ADJUSTMENT",
        p_warehouse_id: product.warehouseId,
        p_lines: [{ product_id: product.id, carton_qty: adjustment.carton, inner_qty: adjustment.inner, unit_qty: adjustment.unit }],
        p_notes: notes,
        p_is_count: false,
      });
      if (error) throw new Error(error.message);
      if (!data?.operation_number) throw new Error("数据库未返回操作单号，请重试。");
      setMessage(`已提交 ${data.operation_number}，库存和日志均已更新。`);
      setAdjustment(emptyInventoryAdjustment);
      setNotes("");
      router.refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`未能提交：${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return <section className="single-product-adjustment" id={id} aria-label={`${product.nameZh} 单品调整`}>
    <div className="single-adjustment-heading"><div><strong>调整此商品</strong><p>正数增加，负数减少；不会自动换算箱、端、盒。</p></div><button type="button" onClick={cancel}>取消</button></div>
    <div className="single-adjustment-units">
      {unitRows.map(({ unit, label, inventoryKey }) => {
        const current = product.inventory[inventoryKey];
        const after = current + adjustment[unit];
        return <div className="single-adjustment-unit" key={unit}>
          <span>{label}<small>当前 {current}</small></span>
          <div>
            <button type="button" aria-label={`${product.nameZh} ${label}减少 1`} disabled={after <= 0} onClick={() => setUnit(unit, adjustment[unit] - 1)}>−</button>
            <input type="number" step="1" min={-current} value={adjustment[unit]} aria-label={`${product.nameZh} ${label}单品调整量`} onChange={(event) => setUnit(unit, Number(event.target.value))} />
            <button type="button" aria-label={`${product.nameZh} ${label}增加 1`} onClick={() => setUnit(unit, adjustment[unit] + 1)}>+</button>
          </div>
          <b>提交后 {after}</b>
        </div>;
      })}
    </div>
    <label className="single-adjustment-notes">备注（可选）<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="例如：客户取货、到货补货" /></label>
    {message && <p className={message.startsWith("未能") ? "operation-message error" : "operation-message"} aria-live="polite">{message}</p>}
    <button type="button" className="primary single-adjustment-submit" disabled={!hasChange || submitting || !product.warehouseId} onClick={submit}>{submitting ? "正在提交…" : "核对并提交此商品"}</button>
  </section>;
}
