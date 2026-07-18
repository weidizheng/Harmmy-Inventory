"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "../lib/catalog";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { ProductCards, type InventoryAdjustment } from "./product-cards";

const emptyAdjustment: InventoryAdjustment = { carton: 0, inner: 0, unit: 0 };
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

  const adjust = (productId: string, unit: keyof InventoryAdjustment, change: number) => {
    setMessage(null);
    setAdjustments((current) => {
      const previous = current[productId] ?? emptyAdjustment;
      const next = { ...previous, [unit]: previous[unit] + change };
      if (!next.carton && !next.inner && !next.unit) {
        const { [productId]: _, ...remaining } = current;
        return remaining;
      }
      return { ...current, [productId]: next };
    });
  };
  const stopEditing = () => {
    if (lines.length && !window.confirm("尚有未提交调整，确定要清空吗？")) return;
    setAdjustments({}); setNotes(""); setShowSummary(false); setEditing(false);
  };
  const submit = async () => {
    if (!warehouseId || !lines.length) return;
    setSubmitting(true); setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("confirm_stock_operation", {
      p_operation_type: "ADJUSTMENT",
      p_warehouse_id: warehouseId,
      p_lines: lines.map(([productId, adjustment]) => ({ product_id: productId, carton_qty: adjustment.carton, inner_qty: adjustment.inner, unit_qty: adjustment.unit })),
      p_notes: notes,
      p_is_count: false,
    });
    setSubmitting(false);
    if (error) { setMessage(`未能提交：${error.message}`); return; }
    setMessage(`已提交 ${data.operation_number}，库存和日志均已更新。`);
    setAdjustments({}); setNotes(""); setShowSummary(false); setEditing(false); router.refresh();
  };

  return <>
    <div className="toolbar inventory-toolbar">
      {!editing ? <button type="button" className="primary" onClick={() => setEditing(true)}>调整库存</button> : <><button type="button" onClick={stopEditing}>取消调整</button><button type="button" className="primary" disabled={!lines.length} onClick={() => setShowSummary(true)}>查看并提交（{lines.length}）</button></>}
    </div>
    <div className="notice">{editing ? "调整模式：＋代表入库，−代表出库。所有修改先进入待提交清单，统一核对后才写入库存。" : "已显示 Supabase 中的真实商品；可搜索 SKU、中文名、英文名和 IP。图片仅向已登录员工开放。"}</div>
    {message && <p className={message.startsWith("未能") ? "operation-message error" : "operation-message"}>{message}</p>}
    <ProductCards products={products} adjustmentMode={editing} adjustments={adjustments} onAdjust={adjust} />
    {editing && lines.length > 0 && <button type="button" className="draft-bar" onClick={() => setShowSummary(true)}>待提交：{lines.length} 个商品 · 点击核对</button>}
    {showSummary && <div className="summary-backdrop" role="presentation"><section className="summary-panel" role="dialog" aria-modal="true" aria-label="调整汇总"><div className="operation-heading"><div><h2>调整汇总</h2><p>仓库：{warehouseName}</p></div><button type="button" onClick={() => setShowSummary(false)}>关闭</button></div><table><thead><tr><th>商品</th><th>当前</th><th>本次调整</th><th>提交后</th></tr></thead><tbody>{lines.map(([productId, adjustment]) => { const product = productById.get(productId)!; const after = { carton: product.inventory.cartonQty + adjustment.carton, inner: product.inventory.innerQty + adjustment.inner, unit: product.inventory.unitQty + adjustment.unit }; return <tr key={productId}><td>{product.sku}<br /><small>{product.nameZh}</small></td><td>箱 {product.inventory.cartonQty} · 端 {product.inventory.innerQty} · 盒 {product.inventory.unitQty}</td><td>{(['carton', 'inner', 'unit'] as const).filter((unit) => adjustment[unit]).map((unit) => <span className={adjustment[unit] > 0 ? "change plus" : "change minus"} key={unit}>{adjustment[unit] > 0 ? "+" : ""}{adjustment[unit]} {unitLabel[unit]} </span>)}</td><td>箱 {after.carton} · 端 {after.inner} · 盒 {after.unit}</td></tr>; })}</tbody></table><label className="operation-notes">备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="例如：餐厅订单取货、到货补货" /></label>{message && <p className="operation-message error">{message}</p>}<button type="button" className="primary" disabled={submitting} onClick={submit}>{submitting ? "正在提交…" : "确认提交调整"}</button></section></div>}
  </>;
}
