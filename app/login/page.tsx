import { LoginForm } from "../../components/login-form";

export default function LoginPage({ searchParams }: Readonly<{ searchParams: Promise<{ reason?: string }> }>) {
  return <LoginPageContent searchParams={searchParams} />;
}

async function LoginPageContent({ searchParams }: Readonly<{ searchParams: Promise<{ reason?: string }> }>) {
  const { reason } = await searchParams;
  return <main className="login"><section><div className="login-mark" aria-hidden="true">H</div><h1>Harmmy Inventory</h1><p className="login-subtitle">仓库库存系统</p>{reason === "inactive" && <p className="login-alert">账号未启用</p>}{reason === "signin" && <p className="login-alert">请先登录</p>}<LoginForm /></section></main>;
}
