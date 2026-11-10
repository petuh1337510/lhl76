"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";
import { broadcastStatusLabel, broadcastTiming, moscowDateInput } from "@/lib/broadcast-status";
import { useBroadcastClock } from "@/components/broadcast-clock";

type Item = {
  id: string; title: string; description: string | null; videoUrl: string; imageUrl: string | null;
  startsAt: string | null; endsAt: string | null; customStartsAt: string | null; customEndsAt: string | null;
  matchId: string | null; matchLabel: string | null; matchStatus: string | null; autoMatched: boolean;
  isPublished: boolean; source: string; saved: boolean; available: boolean | null;
};
type MatchChoice = { id: string; label: string; startsAt: string | null; status: string };
const blank = { id: "", title: "", description: "", videoUrl: "", imageUrl: "", startsAt: "", endsAt: "", matchId: "", isPublished: true };

export default function BroadcastAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [matchDate, setMatchDate] = useState("");
  const [matches, setMatches] = useState<MatchChoice[]>([]);
  const [serverTime, setServerTime] = useState<number>();
  const now = useBroadcastClock(serverTime);
  const load = useCallback(async (force = false, quiet = false) => {
    if (!quiet) { setBusy(true); setError(""); }
    try {
      const r = await fetch("/api/admin/broadcasts", force ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) } : { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Не удалось загрузить трансляции.");
      setItems(data.items ?? []);
      setServerTime(data.serverTime);
      setUpdatedAt(data.updatedAt);
      setConnection(data.error ?? "Подключение VK работает.");
      if (force && !data.error) setNotice("Список VK обновлён.");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось связаться с сервером."); }
    finally { if (!quiet) setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(false, true); }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/admin/broadcasts?matches=1&date=" + encodeURIComponent(matchDate), { signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setMatches(data.items ?? []); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message ?? "Не удалось загрузить матчи."); });
    return () => controller.abort();
  }, [open, matchDate]);
  const edit = (item: Item) => {
    setSelected(item); setError(""); setNotice("");
    setForm({ id: item.id, title: item.title, description: item.description ?? "", videoUrl: item.videoUrl, imageUrl: item.imageUrl ?? "",
      startsAt: moscowDateInput(item.customStartsAt ?? item.startsAt), endsAt: moscowDateInput(item.customEndsAt),
      matchId: item.matchId ?? "", isPublished: item.isPublished });
    setMatchDate(moscowDateInput(item.startsAt).slice(0, 10)); setOpen(true);
  };
  const mutate = async (body: object, method = "PATCH") => {
    const r = await fetch("/api/admin/broadcasts", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Не удалось сохранить трансляцию.");
  };
  const save = async () => {
    setBusy(true); setError("");
    try { await mutate(form, form.id ? "PATCH" : "POST"); setOpen(false); await load(); setNotice("Трансляция сохранена."); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка сохранения."); }
    finally { setBusy(false); }
  };
  const toggle = async (item: Item) => {
    setBusy(true); setError(""); setNotice("");
    try { await mutate({ id: item.id, isPublished: !item.isPublished }); await load(); setNotice(item.isPublished ? "Трансляция снята с публикации." : "Трансляция опубликована."); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка сохранения."); }
    finally { setBusy(false); }
  };
  const timing = (item: Item) => broadcastTiming({ ...item, match: item.matchStatus ? { startsAt: item.startsAt, status: item.matchStatus } : null }, now || Date.now());
  const filtered = items.filter(item => item.title.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "all" || filter === "published" && item.isPublished || filter === "hidden" && !item.isPublished || timing(item).status === filter));
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const visible = filtered.slice((Math.min(page, pages) - 1) * 24, Math.min(page, pages) * 24);
  const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) + " МСК" : "Время матча не задано";
  return <section className="adminContent divisionPage broadcastAdmin">
    <div className="competitionHead"><h1>Трансляции</h1><button onClick={() => { setSelected(null); setForm(blank); setMatchDate(""); setError(""); setOpen(true); }}>+ ДОБАВИТЬ ВИДЕО</button></div>
    <div className="mediaVkImport"><div><span>ВИДЕО ИЗ ВКОНТАКТЕ</span><h2>Трансляции ЛХЛ-76</h2>
      <p>Новые видео из VK появляются автоматически. Выберите, какие показывать на сайте, и при необходимости измените карточку. Видео и обложки VK не копируются на сервер.</p>
      <p>Список VK обновляется при обращении к сайту раз в 5 минут. Статус: до матча — «Скоро», с начала — LIVE, после завершения или через 1,5 часа — «Запись». Время московское.</p>
      <small role="status">{connection} {updatedAt ? "Последнее получение: " + dateLabel(updatedAt) : ""}</small>
    </div><button disabled={busy} onClick={() => void load(true)}>{busy ? "Загрузка…" : "Обновить сейчас"}</button></div>
    {error && !open ? <p className="documentError" role="alert">{error}</p> : null}
    {notice ? <p className="adminNotice" role="status">{notice}</p> : null}
    <div className="broadcastAdminFilters">
      <label>Поиск<input type="search" value={query} placeholder="Название или команда" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label>Показать<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">Все</option><option value="published">Опубликованные</option><option value="hidden">Скрытые</option><option value="upcoming">Скоро</option><option value="live">LIVE</option><option value="archive">Записи</option></select></label>
      <span>Найдено: {filtered.length}</span>
    </div>
    <div className="mediaAdminGrid" aria-busy={busy}>{visible.map(item => <article key={item.id}>
      {item.imageUrl ? <PublicImage src={item.imageUrl} alt="" direct referrerPolicy="no-referrer" /> : <div>▶</div>}
      <span>{broadcastStatusLabel[timing(item).status]} · {item.source === "vk" ? "VK" : "Добавлено вручную"}</span><h3>{item.title}</h3>
      <small>{dateLabel(item.startsAt)}</small>
      {item.matchLabel ? <small>{item.autoMatched ? "Матч определён автоматически: " : "Матч: "}{item.matchLabel}</small> : <small>Для точного статуса выберите матч или задайте время начала.</small>}
      <small>{item.available === false ? "Видео недоступно в VK — скрыто на сайте" : item.isPublished ? "Опубликовано" : "Скрыто"}</small>
      <footer><button disabled={busy} onClick={() => edit(item)}>Изменить</button><label><input type="checkbox" checked={item.isPublished} disabled={busy || !item.isPublished && item.available === false} onChange={() => void toggle(item)} /> Показывать на сайте</label><a href={item.videoUrl} target="_blank" rel="noreferrer">Открыть видео ↗</a></footer>
    </article>)}</div>
    {!busy && !visible.length ? <p className="registryEmpty">Трансляции не найдены.</p> : null}
    {pages > 1 ? <div className="broadcastPagination"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button><span>{Math.min(page, pages)} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Далее →</button></div> : null}
    {open ? <AdminModal title={form.id ? "Редактировать трансляцию" : "Новая трансляция"} onClose={() => !busy && setOpen(false)} wide>
      <section className="mediaEditor"><div className="mediaEditorFields">
        <label className="wide">Название<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label className="wide">Ссылка на видео<input value={form.videoUrl} disabled={selected?.source === "vk"} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://..." /></label>
        <label>Найти матч на дату<input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} /></label>
        <label className="wide">Матч<select value={form.matchId} onChange={e => setForm({ ...form, matchId: e.target.value, endsAt: "" })}>
          <option value="">Автоматически по названию или времени ниже</option>
          {selected?.matchId && !matches.some(m => m.id === selected.matchId) ? <option value={selected.matchId}>{selected.matchLabel}</option> : null}
          {matches.map(match => <option key={match.id} value={match.id}>{dateLabel(match.startsAt)} · {match.label}</option>)}
        </select><small>При привязке начало и завершение берутся из календаря. Перенос времени матча учитывается автоматически.</small></label>
        <label>Начало, МСК<input type="datetime-local" disabled={Boolean(form.matchId)} value={form.matchId ? moscowDateInput(matches.find(m => m.id === form.matchId)?.startsAt ?? selected?.startsAt) : form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label>
        <label>Досрочное окончание, МСК<input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /><small>Необязательно. LIVE в любом случае закончится не позднее чем через 1,5 часа.</small></label>
        <label className="wide">Описание<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label className="wide">Ссылка на обложку<input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} /><small>Пустое поле — использовать обложку VK.</small></label>
        {form.imageUrl ? <PublicImage className="broadcastCoverPreview wide" src={form.imageUrl} alt="Обложка видео" direct /> : null}
        <label className="documentPublish"><input type="checkbox" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} />Показывать на сайте</label>
        {error ? <p className="documentError wide" role="alert">{error}</p> : null}
      </div><footer><button disabled={busy} onClick={() => setOpen(false)}>Отмена</button><button disabled={busy} onClick={() => void save()}>{busy ? "Сохранение…" : "Сохранить"}</button></footer></section>
    </AdminModal> : null}
  </section>;
}
