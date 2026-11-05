"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { safeAdminReturn } from "@/lib/security-policy";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    fetch("/api/admin/auth/setup").then((response) => response.json()).then((data) => setSetup(Boolean(data.available)));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось войти");
      else router.replace(safeAdminReturn(params.get("next")));
    } catch {
      setError("Не удалось связаться с сервером. Повторите попытку позже.");
    }
  }

  return <main className="authPage"><form onSubmit={submit}>
    <div className="authLogo">ЛХЛ <b>76</b></div>
    <span>ПАНЕЛЬ УПРАВЛЕНИЯ</span>
    <h1>Вход в админку</h1>
    <p>Введите логин и пароль вашей учётной записи.</p>
    <label>Логин<input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
    <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <em role="alert">{error}</em>}
    <button>ВОЙТИ</button>
    <p>Забыли пароль? Напишите администратору: <a href="mailto:lhl-76@mail.ru">lhl-76@mail.ru</a></p>
    {setup && <a href="/admin/setup">Создать первого администратора →</a>}
    <small>Доступ только для сотрудников ЛХЛ-76</small>
  </form></main>;
}

export default function Login() { return <Suspense><LoginForm /></Suspense>; }
