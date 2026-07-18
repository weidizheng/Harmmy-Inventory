import { ProductCards } from "../../../components/product-cards";
import { Shell } from "../../../components/shell";

export default function ProductsPage() {
  return <Shell title="Product catalog"><div className="toolbar"><button>IP</button><button>Product type</button><button className="primary">Add product</button></div><p className="notice">中文名为主名、英文名为副名；目录与仓库库存分开维护，不能在此直接修改库存。</p><ProductCards /></Shell>;
}
