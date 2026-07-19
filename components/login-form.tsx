"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import styles from "./login-form.module.css";

const staffAccounts = {
  Henry: "henryma107@yahoo.com",
  Terrence: "weidihaobang@gmail.com",
  Harmmy: "info@harmmyanime.com",
} as const;

export function LoginForm() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<keyof typeof staffAccounts>("Henry");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: staffAccounts[staffName], password });
    if (error) {
      setMessage("登录失败，请检查姓名和密码。");
      setIsSubmitting(false);
      return;
    }
    router.replace("/inventory");
    router.refresh();
  }

  const selectStaff = (name: keyof typeof staffAccounts) => {
    setStaffName(name);
    setPassword("");
    setMessage("");
  };

  return <form className={styles.form} onSubmit={handleSubmit}>
    <span className={styles.fieldLabel}>选择用户</span>
    <div className={styles.staffPicker} role="group" aria-label="选择员工">
      {(Object.keys(staffAccounts) as Array<keyof typeof staffAccounts>).map((name) => <button key={name} type="button" aria-pressed={staffName === name} className={`${styles.staffButton} ${staffName === name ? styles.selected : ""}`} onClick={() => selectStaff(name)}><span>{name.slice(0, 1)}</span>{name}</button>)}
    </div>
    <label className={styles.passwordField}><span>密码</span><div><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage(""); }} required /><button type="button" className={styles.passwordToggle} aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "隐藏" : "显示"}</button></div></label>
    {message && <p className={styles.error} role="alert">{message}</p>}
    <button className={`primary ${styles.submit}`} disabled={isSubmitting}>{isSubmitting ? "登录中…" : "登录"}</button>
  </form>;
}
