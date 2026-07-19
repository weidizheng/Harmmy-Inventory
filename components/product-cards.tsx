"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct } from "../lib/catalog";
import {
  emptyInventoryAdjustment,
  filterInventoryProducts,
  productHasStock,
  type InventoryAdjustment,
  type InventoryFilter,
  type InventoryUnit,
} from "../lib/inventory-workspace-ui";
import { matchesProductSearch } from "../lib/product-search";
import { InventoryFilterTabs } from "./inventory-filter-tabs";
import { ProductCard } from "./product-card";

export function ProductCards({
  products,
  adjustmentMode = false,
  adjustments = {},
  onAdjust,
  onSetAdjustment,
}: Readonly<{
  products: CatalogProduct[];
  adjustmentMode?: boolean;
  adjustments?: Record<string, InventoryAdjustment>;
  onAdjust?: (productId: string, unit: InventoryUnit, change: number) => void;
  onSetAdjustment?: (productId: string, unit: InventoryUnit, value: number) => void;
}>) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("in_stock");
  const [largeImage, setLargeImage] = useState<{ url: string; alt: string; name: string } | null>(null);
  const searchMatches = useMemo(() => products.filter((product) => matchesProductSearch(product, query)), [products, query]);
  const counts = useMemo(() => ({
    all: searchMatches.length,
    in_stock: searchMatches.filter(productHasStock).length,
    out_of_stock: searchMatches.filter((product) => !productHasStock(product)).length,
  }), [searchMatches]);
  const visibleProducts = useMemo(() => filterInventoryProducts(products, query, filter), [products, query, filter]);

  useEffect(() => {
    if (!largeImage) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setLargeImage(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [largeImage]);

  return <>
    <section className="catalog-controls" aria-label="商品搜索与筛选">
      <div className="catalog-search">
        <input aria-label="搜索产品" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU、中文名、英文名或 IP，例如：火影 / Naruto" />
        <span className="search-count" aria-live="polite">{visibleProducts.length} 个结果</span>
      </div>
      <InventoryFilterTabs value={filter} counts={counts} onChange={setFilter} />
    </section>

    <div className="cards">
      {visibleProducts.map((product) => <ProductCard
        key={product.id}
        product={product}
        adjustmentMode={adjustmentMode}
        adjustment={adjustments[product.id] ?? emptyInventoryAdjustment}
        onAdjust={onAdjust}
        onSetAdjustment={onSetAdjustment}
        onOpenImage={setLargeImage}
      />)}
    </div>

    {visibleProducts.length === 0 && <p className="notice empty-catalog">当前搜索和库存筛选下没有商品。</p>}
    {largeImage && <div className="image-lightbox" role="presentation" onClick={() => setLargeImage(null)}>
      <section role="dialog" aria-modal="true" aria-label={`${largeImage.name} 大图`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="image-lightbox-close" aria-label="关闭大图" onClick={() => setLargeImage(null)}>×</button>
        <img src={largeImage.url} alt={largeImage.alt} />
        <p>{largeImage.name}</p>
      </section>
    </div>}
  </>;
}
