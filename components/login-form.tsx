"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import styles from "./login-form.module.css";

const staffAccounts = {
  Henry: "henryma107@yahoo.com",
  Terrence: "weidhaobang@gmail.com",
} as const;

export function LoginForm() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<keyof typeof staffAccounts>("Henry");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: staffAccounts[staffName], password });
    if (error) {
      setMessage("密码不正确，或该账号尚未启用。请联系 Henry 确认。");
      setIsSubmitting(false);
      return;
    }
    router.replace("/inventory");
    router.refresh();
  }

  return <form onSubmit={handleSubmit}>
    <label>选择员工</label>
    <div className={styles.staffPicker} role="group" aria-label="选择员工">
      {(Object.keys(staffAccounts) as Array<keyof typeof staffAccounts>).map((name) => <button key={name} type="button" className={staffName === name ? styles.selected : ""} onClick={() => setStaffName(name)}>{name}</button>)}
    </div>
    <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {message && <p className="notice">{message}</p>}
    <button className="primary" disabled={isSubmitting}>{isSubmitting ? "登录中…" : "登录"}</button>
  </form>;
}
