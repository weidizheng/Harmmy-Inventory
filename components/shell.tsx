import Link from "next/link";

const links = [
  ["Inventory", "/inventory"], ["New operation", "/operations/new"], ["History", "/operations/history"],
  ["Products", "/admin/products"], ["New product", "/admin/products/new"], ["Imports", "/admin/imports"], ["IPs", "/admin/ips"], ["Staff", "/admin/staff"],
];

export function Shell({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <main className="shell"><aside><Link className="brand" href="/inventory">Harmmy<br /><span>Inventory</span></Link><nav>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p className="local">Supabase connected<br />Staff login enabled</p></aside><section className="content"><header><div><p className="eyebrow">Warehouse workspace</p><h1>{title}</h1></div><span className="operator">Operator: Authenticated staff</span></header>{children}</section></main>;
}
