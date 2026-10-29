"use client";
import { PublicImage } from "@/components/public-image";

import { ChangeEvent, useCallback, useEffect, useState } from "react";

type Person = {
  id: string;
  name: string;
  role: string;
  description: string;
  photoUrl: string;
  phone: string;
  email: string;
  active: boolean;
  sortOrder: number;
};

const emptyPerson: Person = {
  id: "", name: "", role: "", description: "", photoUrl: "", phone: "", email: "", active: true, sortOrder: 0,
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Не удалось сохранить изменения");
  return data;
}

export default function LeaguePageAdmin() {
  const [headline, setHeadline] = useState("");
  const [intro, setIntro] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const setPeopleFromResponse = useCallback((items: Partial<Person>[]) => {
    setPeople(items.map((person) => ({
      ...emptyPerson, ...person,
      description: person.description ?? "", photoUrl: person.photoUrl ?? "",
      phone: person.phone ?? "", email: person.email ?? "",
    })));
  }, []);

  const refreshPeople = async () => {
    const data = await jsonRequest("/api/admin/league-page", { cache: "no-store" });
    setPeopleFromResponse(data.people ?? []);
  };

  const refresh = useCallback(async () => {
    const data = await jsonRequest("/api/admin/league-page", { cache: "no-store" });
    setHeadline(data.page?.headline ?? "");
    setIntro(data.page?.intro ?? "");
    setPeopleFromResponse(data.people ?? []);
  }, [setPeopleFromResponse]);

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [refresh]);

  const saveIntro = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      await jsonRequest("/api/admin/league-page", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "intro", headline, intro }),
      });
      setNotice("Вступление сохранено");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !form) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("file", file); body.set("kind", "media");
      const data = await jsonRequest("/api/admin/upload", { method: "POST", body });
      setForm((current) => current ? { ...current, photoUrl: data.url } : current);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); event.target.value = ""; }
  };

  const savePerson = async () => {
    if (!form) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await jsonRequest("/api/admin/league-page", {
        method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sortOrder: form.id ? form.sortOrder : people.length + 1 }),
      });
      setForm(null);
      await refreshPeople();
      setNotice("Карточка сохранена");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const toggle = async (person: Person) => {
    setError("");
    try {
      await jsonRequest("/api/admin/league-page", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id: person.id, active: !person.active }),
      });
      await refreshPeople();
    } catch (err) { setError((err as Error).message); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...people];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setError("");
    try {
      await jsonRequest("/api/admin/league-page", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderIds: next.map((person) => person.id) }),
      });
      setPeople(next.map((person, position) => ({ ...person, sortOrder: position + 1 })));
    } catch (err) { setError((err as Error).message); }
  };

  const remove = async (person: Person) => {
    if (!confirm(`Удалить карточку «${person.name}»? Фото останется в файловом хранилище.`)) return;
    setError("");
    try {
      await jsonRequest(`/api/admin/league-page?id=${encodeURIComponent(person.id)}`, { method: "DELETE" });
      await refreshPeople();
    } catch (err) { setError((err as Error).message); }
  };

  return <section className="adminContent divisionPage leaguePageAdmin">
    <a className="backButton" href="/admin">← К панели управления</a>
    <div className="competitionHead"><div><span>КОНТЕНТ САЙТА</span><h2>О лиге</h2><p>Управление вступлением и разделом «Лица лиги».</p></div><a className="leagueAdminPublicLink" href="/about" target="_blank" rel="noopener noreferrer">ПОСМОТРЕТЬ НА САЙТЕ ↗</a></div>

    <section className="leagueAdminIntro">
      <header><span>01 / ВСТУПЛЕНИЕ</span><h3>Первый экран</h3><p>Короткий текст о лиге — без привязки к конкретному сезону.</p></header>
      <div className="leagueAdminFields">
        <label>Крупный заголовок<input value={headline} maxLength={160} onChange={(event) => setHeadline(event.target.value)} placeholder="Хоккей объединяет Ярославль." /></label>
        <label>Короткий текст<textarea value={intro} maxLength={900} rows={4} onChange={(event) => setIntro(event.target.value)} placeholder="Расскажите о лиге в двух-трёх предложениях." /></label>
        <button disabled={busy} onClick={saveIntro}>{busy ? "СОХРАНЯЮ…" : "СОХРАНИТЬ ВСТУПЛЕНИЕ"}</button>
      </div>
    </section>

    <section className="leagueAdminPeople">
      <header><div><span>02 / ЛИЦА ЛИГИ</span><h3>Люди лиги</h3><p>Порядок карточек меняется стрелками. Скрытые люди остаются в админке.</p></div><button onClick={() => { setForm({ ...emptyPerson }); setError(""); }}>+ ДОБАВИТЬ ЧЕЛОВЕКА</button></header>
      {form ? <div className="leagueAdminEditor">
        <div className="leagueAdminEditorHead"><h4>{form.id ? "Редактировать карточку" : "Новая карточка"}</h4><button onClick={() => setForm(null)} aria-label="Закрыть редактор">×</button></div>
        <div className="leagueAdminFormGrid">
          <label>Фамилия, имя, отчество<input value={form.name} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Роль в лиге<input value={form.role} maxLength={180} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Куратор дивизиона" /></label>
          <label className="wide">Дополнительная информация<textarea value={form.description} maxLength={1200} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Коротко о заслугах или обязанностях" /></label>
          <label>Телефон (необязательно)<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+7 ..." /></label>
          <label>Почта (необязательно)<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.ru" /></label>
          <div className="leagueAdminPhoto wide"><div>{form.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={form.photoUrl} alt="Предпросмотр фотографии" /> : <PublicImage sizes="(max-width: 700px) 90vw, 320px" src="/images/player-placeholder.svg" alt="Фотография не загружена" />}</div><label>Фотография<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /><small>Вертикальный или квадратный портрет. На сайте фото будет прямоугольным.</small></label>{form.photoUrl ? <button onClick={() => setForm({ ...form, photoUrl: "" })}>Убрать фото</button> : null}</div>
          <label className="leagueAdminPublished wide"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Показывать карточку на сайте</span></label>
        </div>
        <footer><button onClick={() => setForm(null)}>Отмена</button><button disabled={busy} onClick={savePerson}>{busy ? "СОХРАНЯЮ…" : "СОХРАНИТЬ КАРТОЧКУ"}</button></footer>
      </div> : null}
      <div className="leagueAdminList">{people.length ? people.map((person, index) => <article key={person.id} className={!person.active ? "isHidden" : ""}>
        <span className="leagueAdminNumber">{String(index + 1).padStart(2, "0")}</span>
        <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={person.photoUrl || "/images/player-placeholder.svg"} alt="" />
        <div><h4>{person.name}</h4><p>{person.role}</p><small>{person.active ? "ОПУБЛИКОВАНО" : "СКРЫТО"}</small></div>
        <nav aria-label={`Действия с карточкой ${person.name}`}>
          <button disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Поднять ${person.name} выше`}>↑</button>
          <button disabled={index === people.length - 1} onClick={() => move(index, 1)} aria-label={`Опустить ${person.name} ниже`}>↓</button>
          <button onClick={() => setForm({ ...person })}>Изменить</button>
          <button onClick={() => toggle(person)}>{person.active ? "Скрыть" : "Показать"}</button>
          <button className="remove" onClick={() => remove(person)}>Удалить</button>
        </nav>
      </article>) : <p className="registryEmpty">Людей пока нет. Добавьте первую карточку.</p>}</div>
    </section>
    {error ? <p className="documentError" role="alert">{error}</p> : null}
    {notice ? <p className="leagueAdminNotice" role="status">{notice}</p> : null}
  </section>;
}
