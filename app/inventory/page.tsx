import { InventoryWorkspace } from "../../components/inventory-workspace";
import { Shell } from "../../components/shell";
import { getCatalogProducts } from "../../lib/catalog";

export default async function InventoryPage() {
  const products = await getCatalogProducts();

  return <Shell title="库存目录">
    <InventoryWorkspace products={products} />
  </Shell>;
}
