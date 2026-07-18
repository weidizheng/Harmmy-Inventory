import { ProductCards } from "../../components/product-cards";
import { Shell } from "../../components/shell";

export default function InventoryPage() {
  return <Shell title="Inventory"><div className="toolbar"><button>Filters</button><button className="primary">New operation</button></div><div className="notice">可搜索 SKU、中文名、英文名和 IP；生产版会对全部商品目录执行相同检索。</div><ProductCards /></Shell>;
}
