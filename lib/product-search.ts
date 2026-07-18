export interface SearchableProduct {
  sku: string;
  nameZh: string;
  nameEn: string;
  ipZh: string;
  ipEn: string;
  aliases?: string[];
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

/** Matches SKU, Chinese and English product names, IP names, and explicit aliases. */
export function matchesProductSearch(product: SearchableProduct, query: string): boolean {
  const needle = normalized(query);
  if (!needle) return true;
  return [product.sku, product.nameZh, product.nameEn, product.ipZh, product.ipEn, ...(product.aliases ?? [])]
    .some((value) => normalized(value).includes(needle));
}
