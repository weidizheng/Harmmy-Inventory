"use client";

import { useState } from "react";
import type { OperationLogEntry, QuantitySnapshot } from "../lib/operation-logs";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

function QuantitySet({ label, quantities, signedValues = false }: Readonly<{ label: string; quantities: QuantitySnapshot; signedValues?: boolean }>) {
  const format = signedValues ? signed : String;
  return <div className={signedValues ? "operation-quantity-set changes" : "operation-quantity-set"}>
    <span>{label}</span>
    <b>箱 {format(quantities.carton)}</b>
    <b>端 {format(quantities.inner)}</b>
    <b>盒 {format(quantities.unit)}</b>
  </div>;
}

export function OperationLogList({ entries }: Readonly<{ entries: OperationLogEntry[] }>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggle = (operationId: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(operationId)) next.delete(operationId);
    else next.add(operationId);
    return next;
  });

  return <div className="operation-log-list">{entries.map((entry) => {
    const expanded = expandedIds.has(entry.id);
    const detailsId = `operation-details-${entry.id}`;
    return <article className="operation-log-entry" key={entry.id}>
      <div className="operation-log-heading">
        <div>
          <h2>{entry.actorName} <span>· {entry.operationLabel}</span></h2>
          <p>操作单号：<b>{entry.operationNumber}</b></p>
        </div>
        <div className="operation-log-status"><span className={entry.status === "CONFIRMED" ? "confirmed" : ""}>{entry.statusLabel}</span><time dateTime={entry.createdAt}>{formatter.format(new Date(entry.createdAt))}</time></div>
      </div>

      <div className="operation-log-summary">
        <strong>改动了 {entry.itemCount} 个商品</strong>
        <span>箱 {signed(entry.totals.carton)}</span>
        <span>端 {signed(entry.totals.inner)}</span>
        <span>盒 {signed(entry.totals.unit)}</span>
      </div>
      <div className="operation-log-meta"><span>仓库：{entry.warehouseName}</span><span>备注：{entry.notes || "无"}</span></div>
      <button type="button" className="operation-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => toggle(entry.id)}>{expanded ? `收起 ${entry.itemCount} 项明细` : `查看 ${entry.itemCount} 项明细`}<span aria-hidden="true">{expanded ? "▴" : "▾"}</span></button>

      {expanded && <div className="operation-log-items" id={detailsId}>
        {entry.items.map((item) => <section className="operation-log-item" key={item.id}>
          {item.imageUrl ? <img src={item.imageUrl} alt={`${item.nameZh} 商品图片`} loading="lazy" /> : <div className="operation-log-image-placeholder" aria-label="暂无商品图片">{item.nameZh.slice(0, 1)}</div>}
          <div className="operation-log-product"><code>{item.sku}</code><b>{item.nameZh}</b></div>
          <div className="operation-log-quantities">
            <QuantitySet label="操作前" quantities={item.before} />
            <QuantitySet label="本次变化" quantities={item.delta} signedValues />
            <QuantitySet label="操作后" quantities={item.after} />
          </div>
        </section>)}
      </div>}
    </article>;
  })}</div>;
}
