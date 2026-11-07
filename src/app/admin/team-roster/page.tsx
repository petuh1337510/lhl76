"use client";
import { AdminModal } from "../admin-modal";
import { PublicImage } from "@/components/public-image";

import { useCallback, useEffect, useState } from "react";

type RosterDraft = { number: string; leadership: "NONE" | "CAPTAIN" | "ASSISTANT"; status: "ACTIVE" | "INACTIVE"; categoryId: string };
function draftFrom(item: any): RosterDraft {
  return { number: item.numberOverride || "", leadership: item.leadership, status: item.status, categoryId: item.classification?.id || "" };
}
function isChanged(item: any, draft: RosterDraft) {
  const original = draftFrom(item);
  return Object.keys(original).some((key) => draft[key as keyof RosterDraft] !== original[key as keyof RosterDraft]);
}

function RosterRow({ item, categories, draft, onChange, onSaved, saving }: { item: any; categories: any[]; draft: RosterDraft; onChange: (patch: Partial<RosterDraft>) => void; onSaved: () => void; saving: boolean }) {
  const activeSuspension = item.suspensions?.find((value: any) => value.status === "ACTIVE");
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false), [suspensionOpen, setSuspensionOpen] = useState(false);
  const [reason, setReason] = useState(""), [startsAt, setStartsAt] = useState(today), [matchesCount, setMatchesCount] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
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

  return <article className={`rosterAdminRow ${activeSuspension ? "suspended" : draft.status.toLowerCase()} ${isChanged(item, draft) ? "rosterDraftChanged" : ""}`}>
    <div className="rosterAdminPerson">{item.player.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={item.player.photoUrl} alt="" /> : <b>{item.player.lastName[0]}{item.player.firstName[0]}</b>}<span><strong>{item.player.lastName}</strong><small>{item.player.firstName} {item.player.patronymic || ""} · {item.player.position || "Игрок"}</small>{activeSuspension && <em>Дисквалифицирован · {activeSuspension.reason}</em>}</span></div>
    <label>Номер команды<input value={draft.number} onChange={(event) => onChange({ number: event.target.value.replace(/\D/g, "") })} disabled={saving || Boolean(activeSuspension)} inputMode="numeric" maxLength={3} placeholder={item.player.baseNumber || "—"} /><small className="rosterNumberHint">{draft.number ? `Свой · базовый № ${item.player.baseNumber || "—"}` : `Базовый № ${item.player.baseNumber || "—"}`}</small></label>
    <label>Рейтинг игрока<select value={draft.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })} disabled={saving || Boolean(activeSuspension)}><option value="">Не указан</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label>Роль<select value={draft.leadership} onChange={(event) => onChange({ leadership: event.target.value as RosterDraft["leadership"] })} disabled={saving || Boolean(activeSuspension)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label>
    <label>Статус<select value={activeSuspension ? "SUSPENDED" : draft.status} disabled={saving || Boolean(activeSuspension)} onChange={(event) => onChange({ status: event.target.value as RosterDraft["status"] })}>{activeSuspension && <option value="SUSPENDED">Дисквалифицирован</option>}<option value="ACTIVE">В составе</option><option value="INACTIVE">Снят с заявки</option></select></label>
    <div className="rosterAdminActions"><a href={`/admin/player?slug=${item.player.slug}`}>Карточка</a>{activeSuspension ? <><button className="suspensionDone" disabled={busy || saving} onClick={() => finishSuspension("COMPLETED")}>Завершить</button><button className="quiet" disabled={busy || saving} onClick={() => finishSuspension("CANCELLED")}>Отменить</button></> : <button className="suspensionButton" disabled={busy || saving || draft.status === "INACTIVE" || isChanged(item, draft)} onClick={() => setSuspensionOpen(!suspensionOpen)}>Дисквалификация</button>}</div>
    {error && <p className="rosterRowError" role="alert">{error}</p>}
    {activeSuspension && <div className="suspensionSummary"><b>{activeSuspension.reason}</b><span>{activeSuspension.sourceDivision} · {activeSuspension.sourceTeam} · осталось {activeSuspension.remaining ?? "—"} из {activeSuspension.matchesCount ?? "—"} матчей</span>{activeSuspension.note && <small>{activeSuspension.note}</small>}</div>}
    {suspensionOpen && <AdminModal title="Новая дисквалификация" onClose={() => setSuspensionOpen(false)}><div className="suspensionEditor"><h4>Новая дисквалификация</h4><p>Действует во всех командах игрока. Отсчёт — по завершённым матчам этой команды в дивизионе.</p><label>Причина<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Решение СДК, матч-штраф…" /></label><label>Начало<input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label>Количество матчей<input type="number" min="1" required value={matchesCount} onChange={(event) => setMatchesCount(event.target.value)} /></label><label className="suspensionNote">Комментарий<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><footer><button onClick={() => setSuspensionOpen(false)}>Отмена</button><button disabled={busy || !reason.trim() || !Number.isInteger(Number(matchesCount)) || Number(matchesCount) < 1} onClick={createSuspension}>Назначить</button></footer></div></AdminModal>}
  </article>;
}

export default function TeamRosterAdmin() {
  const [data, setData] = useState<any>(null), [entryId, setEntryId] = useState(""), [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""), [results, setResults] = useState<any[]>([]), [selected, setSelected] = useState<any>(null);
  const [number, setNumber] = useState(""), [leadership, setLeadership] = useState("NONE"), [categoryId, setCategoryId] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RosterDraft>>({});
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState("");
  const load=useCallback(async(id:string) => { if (!id) return false; try { const response = await fetch(`/api/admin/roster?teamEntryId=${encodeURIComponent(id)}`); if (!response.ok) return false; setData(await response.json()); return true; } catch { return false; } },[]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("entry") || ""; setEntryId(id); load(id); }, [load]);
  useEffect(() => { const timer = setTimeout(async () => { if (query.trim().length < 2) { setResults([]); return; } const response = await fetch(`/api/admin/players?search=${encodeURIComponent(query.trim())}&page=1`); if (response.ok) setResults((await response.json()).items); }, 250); return () => clearTimeout(timer); }, [query]);
  const changed = data?.roster.filter((item: any) => drafts[item.id] && isChanged(item, drafts[item.id])) || [];
  useEffect(() => {
    if (!changed.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed.length]);
  function changeDraft(item: any, patch: Partial<RosterDraft>) {
    setDrafts((previous) => ({ ...previous, [item.id]: { ...(previous[item.id] || draftFrom(item)), ...patch } }));
    setSaveError(""); setMessage("");
  }
  async function saveRoster() {
    if (!changed.length || saving) return;
    setSaving(true); setSaveError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/roster", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamEntryId: entryId, changes: changed.map((item: any) => ({
          id: item.id, expectedUpdatedAt: item.updatedAt, playerExpectedUpdatedAt: item.player.updatedAt,
          ...drafts[item.id],
        })) }),
      });
      if (!response.ok) { setSaveError((await response.json()).error || "Не удалось сохранить состав"); return; }
      const refreshed = await load(entryId);
      setDrafts({});
      if (!refreshed) { setSaveError("Состав сохранён, но список не обновился. Обновите страницу."); return; }
      setMessage(`Состав сохранён. Изменено игроков: ${changed.length}`);
    } catch { setSaveError("Не удалось сохранить состав. Изменения остались в форме."); }
    finally { setSaving(false); }
  }
  async function addPlayer() {
    if (!selected) return;
    setError("");
    const response = await fetch("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: selected.id, playerExpectedUpdatedAt:selected.updatedAt, teamEntryId: entryId, number, leadership, categoryId, status: "ACTIVE" }) });
    if (!response.ok) { setError((await response.json()).error || "Не удалось добавить игрока"); return; }
    setOpen(false); setSelected(null); setQuery(""); setNumber(""); setLeadership("NONE"); setCategoryId(""); setMessage("Игрок добавлен в заявку"); await load(entryId);
  }
  if (!data) return <main className="adminShell"><section className="adminContent divisionPage">Загрузка заявки…</section></main>;
  const active = data.roster.filter((item: any) => item.status !== "INACTIVE"), inactive = data.roster.filter((item: any) => item.status === "INACTIVE");
  return <main className="adminShell"><section className="adminContent divisionPage"><a className="backButton" href={`/admin/team?slug=${data.entry.team.slug}`}>← Карточка команды</a>{message && <p className="adminNotice">{message}</p>}<div className="competitionHead"><div><span>{data.entry.season} · {data.entry.competition}</span><h1>Заявка команды «{data.entry.team.name}»</h1><p>Дивизион «{data.entry.division}» · в составе {active.length} игроков</p></div><button onClick={() => setOpen(true)} disabled={saving}>+ ДОБАВИТЬ ИГРОКА</button></div>
    <div className="rosterBulkSaveBar"><span>{changed.length ? `Изменено игроков: ${changed.length}` : "Изменений нет"}</span><button onClick={saveRoster} disabled={!changed.length || saving}>{saving ? "СОХРАНЕНИЕ…" : "СОХРАНИТЬ СОСТАВ"}</button></div>{saveError && <p className="rosterBulkSaveError" role="alert">{saveError}</p>}
    {open && <AdminModal title="Добавить игрока в заявку" onClose={() => setOpen(false)}><section className="adminForm addRosterPlayer"><h2>Добавить игрока</h2><label>Поиск игрока<input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Введите минимум две буквы фамилии" /></label>{results.length > 0 && !selected && <div className="playerSearchResults">{results.map((player) => <button key={player.id} onClick={() => { setSelected(player); setQuery(`${player.lastName} ${player.firstName}`); setNumber(player.baseNumber || ""); setCategoryId(player.ratingCategoryId || ""); }}>{player.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={player.photoUrl} alt="" /> : <b>{player.lastName[0]}</b>}<span><strong>{player.lastName} {player.firstName}</strong><small>{player.patronymic || ""} · {player.position || "Амплуа не указано"}</small></span></button>)}</div>}<div><label>Номер только для этой команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={selected?.baseNumber || "Будет взят базовый"} /></label><label>Рейтинг игрока<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Не указан</option>{data.categories.map((category: Category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Роль<select value={leadership} onChange={(event) => setLeadership(event.target.value)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label></div>{error && <p className="formError">{error}</p>}<footer><button onClick={() => setOpen(false)}>Отмена</button><button disabled={!selected} onClick={addPlayer}>Добавить в заявку</button></footer></section></AdminModal>}
    <section className="rosterAdmin adminSpacedRows"><header><h3>Действующий состав</h3><span>{active.length}</span></header>{active.map((item: any) => <RosterRow key={item.id} item={item} categories={data.categories} draft={drafts[item.id] || draftFrom(item)} onChange={(patch) => changeDraft(item, patch)} onSaved={() => load(entryId)} saving={saving} />)}</section>{inactive.length > 0 && <details className="rosterInactive adminSpacedRows"><summary>Снятые с заявки · {inactive.length}</summary>{inactive.map((item: any) => <RosterRow key={item.id} item={item} categories={data.categories} draft={drafts[item.id] || draftFrom(item)} onChange={(patch) => changeDraft(item, patch)} onSaved={() => load(entryId)} saving={saving} />)}</details>}
  </section></main>;
}

type Category = { id: string; name: string };
