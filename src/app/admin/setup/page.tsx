"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Setup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => { fetch("/api/admin/auth/setup").then((response) => response.json()).then((data) => setAvailable(Boolean(data.available))); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, email, password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else router.replace("/admin");
  }

  if (available === false) return <main className="authPage"><section><h1>Администратор уже создан</h1><a href="/admin/login">Перейти ко входу →</a></section></main>;
  return <main className="authPage"><form onSubmit={submit}>
    <div className="authLogo">ЛХЛ <b>76</b></div>
    <h1>Главный администратор</h1>
    <p>Эта учётная запись получит полный доступ к сайту.</p>
    <label>Имя<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label>Логин<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} autoComplete="username" required /><small>Латинские буквы, цифры, точка, дефис или подчёркивание</small></label>
    <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Пароль<input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>Минимум 10 символов</small></label>
    {error && <em role="alert">{error}</em>}
    <button>Создать администратора</button>
  </form></main>;
}
