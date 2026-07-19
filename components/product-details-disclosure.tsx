"use client";

import { useId, useState } from "react";
import type { CatalogProduct } from "../lib/catalog";

export function ProductDetailsDisclosure({ product }: Readonly<{ product: CatalogProduct }>) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const packageTotal = product.unitsPerInner && product.innersPerCarton
    ? product.unitsPerInner * product.innersPerCarton
    : null;
  const packageMatchesSource = packageTotal !== null && packageTotal === product.quantityPerCarton;

  return <div className="product-details-disclosure">
    <button type="button" className="details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)}>{expanded ? "收起详情" : "查看详情"}<span aria-hidden="true">{expanded ? "▴" : "▾"}</span></button>
    {expanded && <section id={detailsId} className="source-audit" aria-label="商品详情与原表审核信息">
      <div className="package-detail"><span>中盒件数</span><b>{product.unitsPerInner ?? "未填写"}</b></div>
      <div className="package-detail"><span>每箱中盒</span><b>{product.innersPerCarton ?? "未填写"}</b></div>
      <div className="package-detail"><span>每箱总数</span><b>{product.quantityPerCarton ?? "未填写"}</b></div>
      <div><span>原表 Quantity/Carton</span><b>{product.quantityPerCarton ?? "未填写"}</b></div>
      <div><span>箱规计算</span><b className={packageTotal !== null && !packageMatchesSource ? "package-mismatch" : ""}>{packageTotal === null ? "箱规未完整" : `${product.unitsPerInner} × ${product.innersPerCarton} = ${packageTotal}`}{packageTotal !== null && !packageMatchesSource ? "（不一致）" : ""}</b></div>
      <p><span>原表 Details</span>{product.detailsRaw || "未填写原始 Details"}</p>
    </section>}
  </div>;
}
