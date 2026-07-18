const products = [
  { sku: "HZMB-M1301", name: "ONE PIECE Egghead Arc Plush Series", ip: "One Piece", carton: 3, inner: 2, unit: 4, pinned: true, weight: 100, state: "IN_STOCK" },
  { sku: "EAKI1007", name: "SPY×FAMILY Cat Plush Blind Box", ip: "SPY×FAMILY", carton: 0, inner: 0, unit: 0, pinned: false, weight: 80, state: "OUT_OF_STOCK" },
  { sku: "FLMA-M101", name: "Frieren Travel Diary Figure Blind Box", ip: "Frieren", carton: 0, inner: 0, unit: 0, pinned: false, weight: 20, state: "NOT_ENABLED" },
];

export function ProductCards() {
  return <div className="cards">{products.map((product) => <article className={`card ${product.state === "OUT_OF_STOCK" ? "muted" : ""}`} key={product.sku}><div className="image-placeholder">{product.ip.slice(0, 2).toUpperCase()}</div><div className="card-copy"><div className="card-title"><div><code>{product.sku}</code><h3>{product.name}</h3></div>{product.pinned && <span title="Pinned">★</span>}</div><p>{product.ip} · Weight {product.weight}</p><div className="quantities"><span>Carton <b>{product.carton}</b></span><span>Inner <b>{product.inner}</b></span><span>Unit <b>{product.unit}</b></span></div><small className={`status ${product.state.toLowerCase()}`}>{product.state.replaceAll("_", " ")}</small></div></article>)}</div>;
}
