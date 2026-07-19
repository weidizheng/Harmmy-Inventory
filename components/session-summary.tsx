"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

function elapsedLabel(startedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  if (minutes < 1) return "刚刚登录";
  if (minutes < 60) return `已登录 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `已登录 ${hours} 小时${remainder ? ` ${remainder} 分钟` : ""}`;
}

export function SessionSummary({ displayName, startedAt, operationCount }: Readonly<{ displayName: string; startedAt: string; operationCount: number }>) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const signOut = async () => {
    setSigningOut(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };
  return <section className="session-summary" aria-label="本次登录信息"><div><span>当前用户</span><b>{displayName}</b></div><div><span>登录时长</span><b>{elapsedLabel(startedAt, now)}</b></div><div><span>本次操作</span><b>{operationCount} 次</b></div><button type="button" onClick={signOut} disabled={signingOut}>{signingOut ? "正在退出…" : "退出登录"}</button></section>;
}
