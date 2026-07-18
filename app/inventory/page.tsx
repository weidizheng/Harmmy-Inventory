import { ProductCards } from "../../components/product-cards";
import { Shell } from "../../components/shell";
export default function InventoryPage() { return <Shell title="Inventory"><div className="toolbar"><input placeholder="Search SKU or product name" /><button>Filters</button><button className="primary">New operation</button></div><div className="notice">Default view: enabled products with physical stock. Toggle “show out of stock” in the production implementation.</div><ProductCards /></Shell>; }
