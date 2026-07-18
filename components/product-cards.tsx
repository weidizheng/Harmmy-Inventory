"use client";

import { useState } from "react";
import type { CatalogProduct } from "../lib/catalog";
import { matchesProductSearch } from "../lib/product-search";

export function ProductCards({ products }: Readonly<{ products: CatalogProduct[] }>) {
  const [query, setQuery] = useState("");
  const visibleProducts = products.filter((product) => matchesProductSearch(product, query));

  return <>
    <div className="toolbar">
      <input
        aria-label="搜索产品"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索 SKU、中文名、英文名或 IP，例如：火影 / Naruto"
      />
      <span className="search-count">{visibleProducts.length} 个结果</span>
    </div>
    <div className="cards">
      {visibleProducts.map((product) => <article className="card" key={product.id}>
        {product.imageUrl
          ? <img className="product-image" src={product.imageUrl} alt={`${product.nameZh} 商品图片`} />
          : <div className="image-placeholder" aria-label="暂无商品图片">{product.ipZh.slice(0, 2)}</div>}
        <div className="card-copy">
          <div className="card-title">
            <div>
              <code>{product.sku}</code>
              <h3>{product.nameZh}</h3>
              {product.nameEn && <p className="secondary-name">{product.nameEn}</p>}
            </div>
            {product.isPinned && <span title="重点商品">★</span>}
          </div>
          <p>{product.ipZh}{product.ipEn && product.ipEn !== product.ipZh ? ` / ${product.ipEn}` : ""} · {product.productType}</p>
          {product.sizeText && <p className="product-size">尺寸：{product.sizeText}</p>}
          <div className="quantities" aria-label="箱规">
            <span>中盒件数<b>{product.unitsPerInner ?? "—"}</b></span>
            <span>每箱中盒<b>{product.innersPerCarton ?? "—"}</b></span>
            <span>每箱总数<b>{product.quantityPerCarton ?? "—"}</b></span>
          </div>
          {product.unitsPerInner && product.innersPerCarton && product.quantityPerCarton &&
            <p className="carton-check">箱规核对：{product.unitsPerInner} × {product.innersPerCarton} = {product.quantityPerCarton} 件</p>}
          {product.detailsRaw && <details><summary>查看原始 Details</summary><p className="details-raw">{product.detailsRaw}</p></details>}
        </div>
      </article>)}
    </div>
    {visibleProducts.length === 0 && <p className="notice">没有匹配商品。可尝试 SKU、中文名、英文名或 IP 关键词。</p>}
  </>;
}
