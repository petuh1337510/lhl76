"use client";
import { PublicImage } from "@/components/public-image";

import { useCallback, useEffect, useState } from "react";

function RosterRow({ item, categories, onSaved }: { item: any; categories: any[]; onSaved: () => void }) {
  const activeSuspension = item.suspensions?.find((value: any) => value.status === "ACTIVE");
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState(item.numberOverride || "");
  const [leadership, setLeadership] = useState(item.leadership);
  const [status, setStatus] = useState(item.status);
  const [categoryId, setCategoryId] = useState(item.classification?.id || "");
  const [busy, setBusy] = useState(false), [suspensionOpen, setSuspensionOpen] = useState(false);
  const [reason, setReason] = useState(""), [startsAt, setStartsAt] = useState(today), [matchesCount, setMatchesCount] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
  useEffect(() => { setNumber(item.numberOverride || ""); setCategoryId(item.classification?.id || ""); setLeadership(item.leadership); setStatus(item.status); }, [item.numberOverride, item.classification?.id, item.leadership, item.status]);

  async function save(nextStatus = status) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/roster", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, expectedUpdatedAt:item.updatedAt, playerExpectedUpdatedAt:item.player.updatedAt, number, leadership, status: nextStatus, categoryId }) });
      if (!response.ok) { setError((await response.json()).error || "Не удалось сохранить"); return; }
      onSaved();
    } catch { setError("Не удалось сохранить"); } finally { setBusy(false); }
  }
  async function createSuspension() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/suspensions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosterEntryId: item.id, reason, startsAt, matchesCount, note }) });
      if (!response.ok) { setError((await response.json()).error || "Не удалось назначить дисквалификацию"); return; }
      setSuspensionOpen(false); onSaved();
    } catch { setError("Не удалось назначить дисквалификацию"); } finally { setBusy(false); }
  }
  async function finishSuspension(statusValue: "COMPLETED" | "CANCELLED") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/suspensions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeSuspension.id, expectedUpdatedAt:activeSuspension.updatedAt, status: statusValue }) });
      if (!response.ok) { setError((await response.json()).error || "Не удалось обновить дисквалификацию"); return; }
      onSaved();
    } catch { setError("Не удалось обновить дисквалификацию"); } finally { setBusy(false); }
  }

  return <article className={`rosterAdminRow ${activeSuspension ? "suspended" : status.toLowerCase()}`}>
    <div className="rosterAdminPerson">{item.player.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={item.player.photoUrl} alt="" /> : <b>{item.player.lastName[0]}{item.player.firstName[0]}</b>}<span><strong>{item.player.lastName}</strong><small>{item.player.firstName} {item.player.patronymic || ""} · {item.player.position || "Игрок"}</small>{activeSuspension && <em>Дисквалифицирован · {activeSuspension.reason}</em>}</span></div>
    <label>Номер команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={item.player.baseNumber || "—"} /><small className="rosterNumberHint">{item.numberOverride ? `Свой · базовый № ${item.player.baseNumber || "—"}` : `Базовый № ${item.player.baseNumber || "—"}`}</small></label>
    <label>Рейтинг игрока<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Не указан</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label>Роль<select value={leadership} onChange={(event) => setLeadership(event.target.value)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label>
    <label>Статус<select value={activeSuspension ? "SUSPENDED" : status} disabled={Boolean(activeSuspension)} onChange={(event) => setStatus(event.target.value)}>{activeSuspension && <option value="SUSPENDED">Дисквалифицирован</option>}<option value="ACTIVE">В составе</option><option value="INACTIVE">Снят с заявки</option></select></label>
    <div className="rosterAdminActions"><a href={`/admin/player?slug=${item.player.slug}`}>Карточка</a><button disabled={busy || Boolean(activeSuspension)} onClick={() => save()}>{busy ? "…" : "Сохранить"}</button>{activeSuspension ? <><button className="suspensionDone" disabled={busy} onClick={() => finishSuspension("COMPLETED")}>Завершить</button><button className="quiet" disabled={busy} onClick={() => finishSuspension("CANCELLED")}>Отменить</button></> : <button className="suspensionButton" disabled={busy || status === "INACTIVE"} onClick={() => setSuspensionOpen(!suspensionOpen)}>Дисквалификация</button>}</div>
    {error && <p className="rosterRowError" role="alert">{error}</p>}
    {activeSuspension && <div className="suspensionSummary"><b>{activeSuspension.reason}</b><span>{activeSuspension.sourceDivision} · {activeSuspension.sourceTeam} · осталось {activeSuspension.remaining ?? "—"} из {activeSuspension.matchesCount ?? "—"} матчей</span>{activeSuspension.note && <small>{activeSuspension.note}</small>}</div>}
    {suspensionOpen && <div className="suspensionEditor"><h4>Новая дисквалификация</h4><p>Действует во всех командах игрока. Отсчёт — по завершённым матчам этой команды в дивизионе.</p><label>Причина<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Решение СДК, матч-штраф…" /></label><label>Начало<input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label>Количество матчей<input type="number" min="1" required value={matchesCount} onChange={(event) => setMatchesCount(event.target.value)} /></label><label className="suspensionNote">Комментарий<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><footer><button onClick={() => setSuspensionOpen(false)}>Отмена</button><button disabled={busy || !reason.trim() || !Number.isInteger(Number(matchesCount)) || Number(matchesCount) < 1} onClick={createSuspension}>Назначить</button></footer></div>}
  </article>;
}

export default function TeamRosterAdmin() {
  const [data, setData] = useState<any>(null), [entryId, setEntryId] = useState(""), [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""), [results, setResults] = useState<any[]>([]), [selected, setSelected] = useState<any>(null);
  const [number, setNumber] = useState(""), [leadership, setLeadership] = useState("NONE"), [categoryId, setCategoryId] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const load=useCallback(async(id:string) => { if (!id) return; const response = await fetch(`/api/admin/roster?teamEntryId=${encodeURIComponent(id)}`); if (response.ok) setData(await response.json()); },[]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("entry") || ""; setEntryId(id); load(id); }, [load]);
  useEffect(() => { const timer = setTimeout(async () => { if (query.trim().length < 2) { setResults([]); return; } const response = await fetch(`/api/admin/players?search=${encodeURIComponent(query.trim())}&page=1`); if (response.ok) setResults((await response.json()).items); }, 250); return () => clearTimeout(timer); }, [query]);
  async function addPlayer() {
    if (!selected) return;
    setError("");
    const response = await fetch("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: selected.id, playerExpectedUpdatedAt:selected.updatedAt, teamEntryId: entryId, number, leadership, categoryId, status: "ACTIVE" }) });
    if (!response.ok) { setError((await response.json()).error || "Не удалось добавить игрока"); return; }
    setOpen(false); setSelected(null); setQuery(""); setNumber(""); setLeadership("NONE"); setCategoryId(""); setMessage("Игрок добавлен в заявку"); await load(entryId);
  }
  if (!data) return <main className="adminShell"><section className="adminContent divisionPage">Загрузка заявки…</section></main>;
  const active = data.roster.filter((item: any) => item.status !== "INACTIVE"), inactive = data.roster.filter((item: any) => item.status === "INACTIVE");
  return <main className="adminShell"><section className="adminContent divisionPage"><a className="backButton" href={`/admin/team?slug=${data.entry.team.slug}`}>← Карточка команды</a>{message && <p className="adminNotice">{message}</p>}<div className="competitionHead"><div><span>{data.entry.season} · {data.entry.competition}</span><h2>Заявка команды «{data.entry.team.name}»</h2><p>Дивизион «{data.entry.division}» · в составе {active.length} игроков</p></div><button onClick={() => setOpen(true)}>+ ДОБАВИТЬ ИГРОКА</button></div>
    {open && <section className="adminForm addRosterPlayer"><h2>Добавить игрока</h2><label>Поиск игрока<input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Введите минимум две буквы фамилии" /></label>{results.length > 0 && !selected && <div className="playerSearchResults">{results.map((player) => <button key={player.id} onClick={() => { setSelected(player); setQuery(`${player.lastName} ${player.firstName}`); setNumber(player.baseNumber || ""); setCategoryId(player.ratingCategoryId || ""); }}>{player.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={player.photoUrl} alt="" /> : <b>{player.lastName[0]}</b>}<span><strong>{player.lastName} {player.firstName}</strong><small>{player.patronymic || ""} · {player.position || "Амплуа не указано"}</small></span></button>)}</div>}<div><label>Номер только для этой команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={selected?.baseNumber || "Будет взят базовый"} /></label><label>Рейтинг игрока<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Не указан</option>{data.categories.map((category: Category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Роль<select value={leadership} onChange={(event) => setLeadership(event.target.value)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label></div>{error && <p className="formError">{error}</p>}<footer><button onClick={() => setOpen(false)}>Отмена</button><button disabled={!selected} onClick={addPlayer}>Добавить в заявку</button></footer></section>}
    <section className="rosterAdmin"><header><h3>Действующий состав</h3><span>{active.length}</span></header>{active.map((item: any) => <RosterRow key={item.id} item={item} categories={data.categories} onSaved={() => load(entryId)} />)}</section>{inactive.length > 0 && <details className="rosterInactive"><summary>Снятые с заявки · {inactive.length}</summary>{inactive.map((item: any) => <RosterRow key={item.id} item={item} categories={data.categories} onSaved={() => load(entryId)} />)}</details>}
  </section></main>;
}

type Category = { id: string; name: string };
