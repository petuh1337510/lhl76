"use client";

import { useEffect, useState } from "react";

import AdminPasswordInput from "@/components/admin-password-input";
import { AdminModal } from "../admin-modal";

type User = { id: string; username: string; name: string; email: string; role: string; active: boolean; lockedUntil: string | null; createdAt: string };
const blank = { id: "", username: "", name: "", email: "", role: "ADMIN", active: true, password: "" };
const labels: Record<string, string> = { SUPER_ADMIN: "Главный администратор", ADMIN: "Администратор", SECRETARY: "Секретарь" };

export default function Users() {
  const [items, setItems] = useState<User[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => fetch("/api/admin/users", { cache: "no-store" }).then((response) => response.json()).then((data) => setItems(data.items ?? []));
  useEffect(() => { void refresh(); }, []);

  async function save() {
    setError("");
    try {
      const response = await fetch("/api/admin/users", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Не удалось сохранить пользователя"); return; }
      await refresh();
      setOpen(false);
      setForm({ ...blank });
    } catch { setError("Не удалось связаться с сервером"); }
  }

  async function unlock(item: User) {
    setError("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, password: "", unlock: true }) });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось разблокировать пользователя");
      else await refresh();
    } catch { setError("Не удалось связаться с сервером"); }
  }

  return <section className="adminContent divisionPage usersAdmin">

    <div className="competitionHead"><div><h1>Пользователи и роли</h1></div><button onClick={() => { setError(""); setForm({ ...blank }); setOpen(true); }}>+ Добавить пользователя</button></div>
    {open && <AdminModal title={form.id ? "Редактировать пользователя" : "Новый пользователь"} onClose={() => setOpen(false)}><section className="adminForm usersForm">
      <h2>{form.id ? "Редактировать пользователя" : "Новый пользователь"}</h2>
      <div><label>Имя<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Логин<input value={form.username} maxLength={32} autoComplete="off" onChange={(event) => setForm({ ...form, username: event.target.value })} /><small>3–32 латинских символа, цифры, точка, дефис или подчёркивание</small></label></div>
      <label>Email для связи<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Роль<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <AdminPasswordInput key={form.id || "new"} label={form.id ? "Новый пароль — оставьте пустым, чтобы не менять" : "Пароль"} minLength={form.id ? 0 : 10} value={form.password} onChange={(password) => setForm({ ...form, password })} />
      {form.id && <label className="documentPublish"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><b>Учётная запись активна</b><small>Отключённый пользователь не сможет войти повторно.</small></span></label>}
      {error && <p className="documentError" role="alert">{error}</p>}
      <footer><button onClick={() => setOpen(false)}>Отмена</button><button onClick={() => void save()}>Сохранить</button></footer>
    </section></AdminModal>}
    {!open && error && <p className="documentError" role="alert">{error}</p>}
    <section className="usersList">{items.map((item) => {
      const blocked = item.lockedUntil && new Date(item.lockedUntil) > new Date();
      return <article key={item.id}><div>{item.name.slice(0, 1)}</div><section><h3>{item.name}</h3><p>Логин: {item.username} · {item.email}</p></section><b>{labels[item.role] ?? item.role}</b><span className={item.active && !blocked ? "published" : "draft"}>{blocked ? `Заблокирован до ${new Date(item.lockedUntil!).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : item.active ? "Активен" : "Отключён"}</span><footer>{blocked && <button onClick={() => void unlock(item)}>Разблокировать</button>}<button onClick={() => { setError(""); setForm({ id: item.id, username: item.username, name: item.name, email: item.email, role: item.role, active: item.active, password: "" }); setOpen(true); }}>Изменить</button></footer></article>;
    })}</section>
  </section>;
}
