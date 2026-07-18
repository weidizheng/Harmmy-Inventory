import { ProductCards } from "../../components/product-cards";
import { Shell } from "../../components/shell";
import { getCatalogProducts } from "../../lib/catalog";
import Link from "next/link";

export default async function InventoryPage() {
  const products = await getCatalogProducts();

  return <Shell title="库存目录">
    <div className="toolbar"><Link className="primary button-link" href="/operations/new">新建操作</Link></div>
    <div className="notice">已显示 Supabase 中的真实商品；可搜索 SKU、中文名、英文名和 IP。图片仅向已登录员工开放。</div>
    <ProductCards products={products} />
  </Shell>;
}
