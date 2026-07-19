"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "../lib/catalog";
import {
  emptyInventoryAdjustment,
  summarizeAdjustments,
  type InventoryAdjustment,
  type InventoryUnit,
} from "../lib/inventory-workspace-ui";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { BulkAdjustmentBar } from "./bulk-adjustment-bar";
import { ProductCards } from "./product-cards";

const unitLabel = { carton: "箱", inner: "端", unit: "盒" } as const;

export function InventoryWorkspace({ products }: Readonly<{ products: CatalogProduct[] }>) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, InventoryAdjustment>>({});
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const warehouseId = products[0]?.warehouseId;
  const warehouseName = products[0]?.warehouseName ?? "未设置仓库";
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const lines = Object.entries(adjustments).filter(([, adjustment]) => adjustment.carton || adjustment.inner || adjustment.unit);
  const adjustmentSummary = useMemo(() => summarizeAdjustments(adjustments), [adjustments]);

  const adjust = (productId: string, unit: InventoryUnit, change: number) => {
    setMessage(null);
    setAdjustments((current) => {
      const previous = current[productId] ?? emptyInventoryAdjustment;
      const next = { ...previous, [unit]: previous[unit] + change };
      if (!next.carton && !next.inner && !next.unit) {
        const { [productId]: _, ...remaining } = current;
        return remaining;
      }
      return { ...current, [productId]: next };
    });
  };

  const setAdjustment = (productId: string, unit: InventoryUnit, value: number) => {
    if (!Number.isInteger(value)) return;
    setMessage(null);
    setAdjustments((current) => {
      const previous = current[productId] ?? emptyInventoryAdjustment;
      const next = { ...previous, [unit]: value };
      if (!next.carton && !next.inner && !next.unit) {
        const { [productId]: _, ...remaining } = current;
        return remaining;
      }
      return { ...current, [productId]: next };
    });
  };

  const stopEditing = () => {
    if (lines.length && !window.confirm("尚有未提交调整，确定要清空吗？")) return;
    setAdjustments({});
    setNotes("");
    setShowSummary(false);
    setEditing(false);
    setMessage(null);
  };

  const submit = async () => {
    if (!warehouseId) { setMessage("未能提交：尚未设置可用仓库。"); return; }
    if (!lines.length) { setMessage("未能提交：请先调整至少一个商品。"); return; }
    setSubmitting(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("confirm_stock_operation", {
        p_operation_type: "ADJUSTMENT",
        p_warehouse_id: warehouseId,
        p_lines: lines.map(([productId, adjustment]) => ({
          product_id: productId,
          carton_qty: adjustment.carton,
          inner_qty: adjustment.inner,
          unit_qty: adjustment.unit,
        })),
        p_notes: notes,
        p_is_count: false,
      });
      if (error) throw new Error(error.message);
      if (!data?.operation_number) throw new Error("数据库未返回操作单号，请重试。");
      setMessage(`已提交 ${data.operation_number}，库存和日志均已更新。`);
      setAdjustments({});
      setNotes("");
      setShowSummary(false);
      setEditing(false);
      router.refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`未能提交：${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return <div className={editing ? "inventory-workspace bulk-mode-active" : "inventory-workspace"}>
    <div className="toolbar inventory-toolbar">
      <Link className="history-link" href="/logs">操作记录</Link>
      {!editing
        ? <button type="button" className="primary" onClick={() => setEditing(true)}>开始批量调整</button>
        : <span className="bulk-mode-badge">批量调整模式</span>}
    </div>

    <div className="notice">{editing
      ? "批量调整：可同时修改多个 SKU，所有修改先进入草稿，核对后再统一提交。"
      : "单个商品请使用卡片上的“调整此商品”；需要同时处理多个 SKU 时使用“开始批量调整”。"}</div>
    {message && <p className={message.startsWith("未能") ? "operation-message error" : "operation-message"} aria-live="polite">{message}</p>}

    <ProductCards products={products} adjustmentMode={editing} adjustments={adjustments} onAdjust={adjust} onSetAdjustment={setAdjustment} />

    {editing && <BulkAdjustmentBar summary={adjustmentSummary} onCancel={stopEditing} onReview={() => setShowSummary(true)} />}

    {showSummary && <div className="summary-backdrop" role="presentation">
      <section className="summary-panel" role="dialog" aria-modal="true" aria-label="调整汇总">
        <div className="operation-heading">
          <div><h2>调整汇总</h2><p>仓库：{warehouseName}</p></div>
          <button type="button" disabled={submitting} onClick={() => setShowSummary(false)}>关闭</button>
        </div>
        <table>
          <thead><tr><th>商品</th><th>当前</th><th>本次调整</th><th>提交后</th></tr></thead>
          <tbody>{lines.map(([productId, adjustment]) => {
            const product = productById.get(productId)!;
            const after = {
              carton: product.inventory.cartonQty + adjustment.carton,
              inner: product.inventory.innerQty + adjustment.inner,
              unit: product.inventory.unitQty + adjustment.unit,
            };
            return <tr key={productId}>
              <td>{product.sku}<br /><small>{product.nameZh}</small></td>
              <td>箱 {product.inventory.cartonQty} · 端 {product.inventory.innerQty} · 盒 {product.inventory.unitQty}</td>
              <td>{(["carton", "inner", "unit"] as const).filter((unit) => adjustment[unit]).map((unit) => <span className={adjustment[unit] > 0 ? "change plus" : "change minus"} key={unit}>{adjustment[unit] > 0 ? "+" : ""}{adjustment[unit]} {unitLabel[unit]} </span>)}</td>
              <td>箱 {after.carton} · 端 {after.inner} · 盒 {after.unit}</td>
            </tr>;
          })}</tbody>
        </table>
        <label className="operation-notes">备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="例如：餐厅订单取货、到货补货" /></label>
        {message && <p className="operation-message error" aria-live="polite">{message}</p>}
        <button type="button" className="primary" disabled={submitting} onClick={submit}>{submitting ? "正在提交，请稍候…" : "确认提交调整"}</button>
      </section>
    </div>}
  </div>;
}
