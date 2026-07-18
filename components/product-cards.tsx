"use client";

import { useState } from "react";
import { matchesProductSearch } from "../lib/product-search";

const products = [
  { sku: "HZMB-M1301", nameZh: "航海王 蛋头岛篇毛绒系列", nameEn: "ONE PIECE Egghead Arc Plush Series", ipZh: "航海王", ipEn: "One Piece", carton: 3, inner: 2, unit: 4, pinned: true, weight: 100, state: "IN_STOCK" },
  { sku: "EAKI1045", nameZh: "火影忍者-疾风传双闪徽章 Vol.2", nameEn: "Naruto Badge Vol. 2", ipZh: "火影忍者", ipEn: "Naruto", carton: 2, inner: 4, unit: 6, pinned: true, weight: 90, state: "IN_STOCK", aliases: ["Naruto Shippuden", "鸣人"] },
  { sku: "EAKI1007", nameZh: "间谍过家家 猫咪毛绒盲盒", nameEn: "SPY×FAMILY Cat Plush Blind Box", ipZh: "间谍过家家", ipEn: "SPY×FAMILY", carton: 0, inner: 0, unit: 0, pinned: false, weight: 80, state: "OUT_OF_STOCK" },
  { sku: "FLMA-M101", nameZh: "葬送的芙莉莲 旅行日记手办盲盒", nameEn: "Frieren Travel Diary Figure Blind Box", ipZh: "葬送的芙莉莲", ipEn: "Frieren", carton: 0, inner: 0, unit: 0, pinned: false, weight: 20, state: "NOT_ENABLED" },
];

export function ProductCards() {
  const [query, setQuery] = useState("");
  const visibleProducts = products.filter((product) => matchesProductSearch(product, query));
  return <>
    <div className="toolbar"><input aria-label="搜索产品" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU、中文名、英文名或 IP，例如：火影 / Naruto" /><span className="search-count">{visibleProducts.length} 个结果</span></div>
    <div className="cards">{visibleProducts.map((product) => <article className={`card ${product.state === "OUT_OF_STOCK" ? "muted" : ""}`} key={product.sku}><div className="image-placeholder">{product.ipZh.slice(0, 2)}</div><div className="card-copy"><div className="card-title"><div><code>{product.sku}</code><h3>{product.nameZh}</h3><p className="secondary-name">{product.nameEn}</p></div>{product.pinned && <span title="Pinned">★</span>}</div><p>{product.ipZh} / {product.ipEn} · Weight {product.weight}</p><div className="quantities"><span>Carton <b>{product.carton}</b></span><span>Inner <b>{product.inner}</b></span><span>Unit <b>{product.unit}</b></span></div><small className={`status ${product.state.toLowerCase()}`}>{product.state.replaceAll("_", " ")}</small></div></article>)}</div>
    {visibleProducts.length === 0 && <p className="notice">没有匹配商品。可尝试 SKU、中文名、英文名或 IP 关键词。</p>}
  </>;
}
