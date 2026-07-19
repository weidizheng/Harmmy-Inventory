"use client";

import { formatSignedQuantity, type InventoryAdjustmentSummary } from "../lib/inventory-workspace-ui";

export function BulkAdjustmentBar({ summary, onCancel, onReview }: Readonly<{
  summary: InventoryAdjustmentSummary;
  onCancel: () => void;
  onReview: () => void;
}>) {
  return <aside className="bulk-adjustment-bar" aria-label="批量调整汇总">
    <div><strong>已选择 {summary.selectedCount} 个商品</strong><span>箱 {formatSignedQuantity(summary.carton)}</span><span>端 {formatSignedQuantity(summary.inner)}</span><span>盒 {formatSignedQuantity(summary.unit)}</span></div>
    <div className="bulk-adjustment-actions"><button type="button" onClick={onCancel}>取消批量调整</button><button type="button" className="primary" disabled={summary.selectedCount === 0} onClick={onReview}>查看汇总并确认</button></div>
  </aside>;
}
