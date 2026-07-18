"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct } from "../lib/catalog";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type OperationMode = "RECEIPT" | "OUTBOUND" | "COUNT";
type OperationLine = { productId: string; cartonQty: number; innerQty: number; unitQty: number };

const labels: Record<OperationMode, { title: string; button: string; quantity: string }> = {
  RECEIPT: { title: "入库", button: "确认入库", quantity: "本次入库数量" },
  OUTBOUND: { title: "出库", button: "确认出库", quantity: "本次出库数量" },
  COUNT: { title: "库存盘点", button: "确认盘点", quantity: "实盘数量" },
};

const emptyLine = (productId: string): OperationLine => ({ productId, cartonQty: 0, innerQty: 0, unitQty: 0 });

export function OperationForm({ products, initialProductId }: Readonly<{ products: CatalogProduct[]; initialProductId?: string }>) {
  const router = useRouter();
  const warehouseId = products[0]?.warehouseId ?? null;
  const warehouseName = products[0]?.warehouseName ?? "未设置仓库";
  const initialLine = initialProductId && products.some((product) => product.id === initialProductId) ? [emptyLine(initialProductId)] : [];
  const [mode, setMode] = useState<OperationMode>("OUTBOUND");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<OperationLine[]>(initialLine);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const matches = products.filter((product) => {
    const searchable = `${product.sku} ${product.nameZh} ${product.nameEn} ${product.ipZh} ${product.ipEn}`.toLowerCase();
    return query.trim() && searchable.includes(query.trim().toLowerCase());
  }).slice(0, 8);
  const addProduct = (productId: string) => {
    if (!lines.some((line) => line.productId === productId)) setLines((current) => [...current, emptyLine(productId)]);
    setQuery("");
  };
  const updateLine = (productId: string, field: keyof Omit<OperationLine, "productId">, value: string) => {
    const quantity = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setLines((current) => current.map((line) => line.productId === productId ? { ...line, [field]: quantity } : line));
  };
  const removeLine = (productId: string) => setLines((current) => current.filter((line) => line.productId !== productId));
  const projected = (line: OperationLine, product: CatalogProduct) => {
    if (mode === "COUNT") return { carton: line.cartonQty, inner: line.innerQty, unit: line.unitQty };
    const multiplier = mode === "RECEIPT" ? 1 : -1;
    return {
      carton: product.inventory.cartonQty + multiplier * line.cartonQty,
      inner: product.inventory.innerQty + multiplier * line.innerQty,
      unit: product.inventory.unitQty + multiplier * line.unitQty,
    };
  };
  const canSubmit = Boolean(warehouseId && lines.length && (mode === "COUNT" || lines.every((line) => line.cartonQty + line.innerQty + line.unitQty > 0)));

  const submit = async () => {
    if (!warehouseId || !canSubmit) return;
    setMessage(null);
    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("confirm_stock_operation", {
      p_operation_type: mode === "COUNT" ? "ADJUSTMENT" : mode,
      p_warehouse_id: warehouseId,
      p_lines: lines.map((line) => ({ product_id: line.productId, carton_qty: line.cartonQty, inner_qty: line.innerQty, unit_qty: line.unitQty })),
      p_notes: notes,
      p_is_count: mode === "COUNT",
    });
    setIsSubmitting(false);
    if (error) {
      setMessage(`未能确认：${error.message}`);
      return;
    }
    setMessage(`已确认 ${data.operation_number}。库存与审计日志已更新。`);
    setLines([]);
    setNotes("");
    router.refresh();
  };

  return <section className="panel operation-panel">
    <div className="operation-heading"><div><h2>{labels[mode].title}</h2><p>仓库：<b>{warehouseName}</b></p></div><select aria-label="操作类型" value={mode} onChange={(event) => setMode(event.target.value as OperationMode)}><option value="OUTBOUND">出库</option><option value="RECEIPT">入库</option><option value="COUNT">库存盘点（填写实盘数）</option></select></div>
    <p className="notice">箱、端、盒是独立的实物层级，系统不会自动拆箱或拆端。出库不能超过该层级的现存数量。</p>
    <label className="product-finder">添加商品<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU、中文名、英文名或 IP" /></label>
    {matches.length > 0 && <div className="product-matches">{matches.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product.id)}>{product.sku} · {product.nameZh}</button>)}</div>}
    {lines.length === 0 && <p className="empty-operation">先搜索并添加一个商品；盘点时可逐个商品加入同一张盘点单。</p>}
    {lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) return null;
      const after = projected(line, product);
      const invalidOutbound = mode === "OUTBOUND" && (after.carton < 0 || after.inner < 0 || after.unit < 0);
      return <article className="operation-line" key={line.productId}>
        <div className="operation-product"><code>{product.sku}</code><strong>{product.nameZh}</strong><span>当前：箱 {product.inventory.cartonQty} · 端 {product.inventory.innerQty} · 盒 {product.inventory.unitQty}</span></div>
        <div className="operation-quantities"><label>箱<input type="number" min="0" value={line.cartonQty} onChange={(event) => updateLine(line.productId, "cartonQty", event.target.value)} /></label><label>端<input type="number" min="0" value={line.innerQty} onChange={(event) => updateLine(line.productId, "innerQty", event.target.value)} /></label><label>盒<input type="number" min="0" value={line.unitQty} onChange={(event) => updateLine(line.productId, "unitQty", event.target.value)} /></label></div>
        <div className={invalidOutbound ? "after invalid" : "after"}>确认后：箱 {after.carton} · 端 {after.inner} · 盒 {after.unit}</div>
        <button type="button" className="remove-line" onClick={() => removeLine(line.productId)}>移除</button>
      </article>;
    })}
    <label className="operation-notes">备注（可选）<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="例如：客户提货、7 月盘点" /></label>
    {message && <p className={message.startsWith("未能") ? "operation-message error" : "operation-message"}>{message}</p>}
    <button type="button" className="primary" disabled={!canSubmit || isSubmitting} onClick={submit}>{isSubmitting ? "正在保存…" : labels[mode].button}</button>
  </section>;
}
