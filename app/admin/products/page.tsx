import { ProductCards } from "../../../components/product-cards";
import { Shell } from "../../../components/shell";
export default function ProductsPage() { return <Shell title="Product catalog"><div className="toolbar"><input placeholder="Search all catalog products" /><button>IP</button><button>Product type</button><button className="primary">Add product</button></div><p className="notice">Catalog products are separate from warehouse balances; this screen must never directly edit quantity.</p><ProductCards /></Shell>; }
