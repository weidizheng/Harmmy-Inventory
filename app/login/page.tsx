import { LoginForm } from "../../components/login-form";

export default function LoginPage({ searchParams }: Readonly<{ searchParams: Promise<{ reason?: string }> }>) {
  return <LoginPageContent searchParams={searchParams} />;
}

async function LoginPageContent({ searchParams }: Readonly<{ searchParams: Promise<{ reason?: string }> }>) {
  const { reason } = await searchParams;
  return <main className="login"><section><p className="eyebrow">Harmmy Inventory</p><h1>员工登录</h1><p>请使用 Supabase 后台创建并启用的员工邮箱和密码登录。</p>{reason === "inactive" && <p className="notice">该账号尚未启用，请联系 Henry。</p>}{reason === "signin" && <p className="notice">请先登录后再进入库存系统。</p>}<LoginForm /><small>所有已启用员工拥有相同操作权限；每次数据变更都会记录日志。</small></section></main>;
}
