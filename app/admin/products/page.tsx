import { ProductCards } from "../../../components/product-cards";
import { Shell } from "../../../components/shell";
import { getCatalogProducts } from "../../../lib/catalog";

export default async function ProductsPage() {
  const products = await getCatalogProducts();

  return <Shell title="商品目录">
    <div className="toolbar"><button>IP</button><button>商品类型</button><button className="primary">新增商品</button></div>
    <p className="notice">中文名为主名，英文名为副名。箱规保留原始 Details，库存会在后续操作页面单独维护。</p>
    <ProductCards products={products} />
  </Shell>;
}
