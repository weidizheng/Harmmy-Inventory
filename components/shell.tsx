import Link from "next/link";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { SessionSummary } from "./session-summary";

const links = [
  ["库存", "/inventory"],
  ["新产品", "/admin/products/new"],
  ["日志", "/logs"],
];

export async function Shell({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sessionStartedAt = user?.last_sign_in_at ?? user?.created_at ?? new Date().toISOString();
  const { data: staff } = user
    ? await supabase.from("staff").select("id,display_name").eq("auth_user_id", user.id).maybeSingle()
    : { data: null };
  const [{ count: stockOperationCount }, { count: productAddCount }] = user && staff
    ? await Promise.all([
      supabase.from("stock_operations").select("id", { count: "exact", head: true }).eq("operator_id", staff.id).gte("created_at", sessionStartedAt),
      supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("actor_user_id", user.id).eq("entity_type", "products").eq("action", "INSERT").gte("created_at", sessionStartedAt),
    ])
    : [{ count: 0 }, { count: 0 }];
  const operationCount = (stockOperationCount ?? 0) + (productAddCount ?? 0);

  return <main className="shell"><aside><Link className="brand" href="/inventory">Harmmy<br /><span>Inventory</span></Link><nav>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p className="local">Supabase 已连接<br />员工登录已启用</p></aside><section className="content"><header><div><p className="eyebrow">Warehouse workspace</p><h1>{title}</h1></div>{user && <SessionSummary displayName={staff?.display_name ?? user.email ?? "员工"} startedAt={sessionStartedAt} operationCount={operationCount} />}</header>{children}</section></main>;
}
