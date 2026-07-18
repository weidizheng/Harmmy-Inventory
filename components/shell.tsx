import Link from "next/link";

const links = [
  ["库存", "/inventory"],
  ["新产品", "/admin/products/new"],
  ["日志", "/logs"],
];

export function Shell({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <main className="shell"><aside><Link className="brand" href="/inventory">Harmmy<br /><span>Inventory</span></Link><nav>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p className="local">Supabase 已连接<br />员工登录已启用</p></aside><section className="content"><header><div><p className="eyebrow">Warehouse workspace</p><h1>{title}</h1></div><span className="operator">Operator: Authenticated staff</span></header>{children}</section></main>;
}
