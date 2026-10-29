"use client";
import { PublicImage } from "@/components/public-image";

import { useEffect, useState, useRef } from "react";
import MediaUpload from "../media-upload";

type Category = { id: string; name: string };
const emptyPlayer = { firstName: "", lastName: "", patronymic: "", nativeName: "", birthDate: "", country: "Россия", birthPlace: "", position: "Нападающий", stickHand: "Левый", heightCm: "", weightKg: "", league: "ЛХЛ-76", baseNumber: "", ratingCategoryId: "", photoUrl: "", laureatePhotoUrl: "", assignments: [] };

function PlayerFields({ form, put, categories }: { form: any; put: (key: string, value: string) => void; categories: Category[] }) {
  const fields = [["lastName", "Фамилия"], ["firstName", "Имя"], ["patronymic", "Отчество"], ["nativeName", "Имя в родной стране"], ["birthDate", "Дата рождения"], ["country", "Страна"], ["birthPlace", "Место рождения"], ["position", "Амплуа"], ["stickHand", "Хват"], ["heightCm", "Рост, см"], ["weightKg", "Вес, кг"], ["league", "Лига"]];
  return <>
    <div>{fields.map(([key, label]) => <label key={key}>{label}{key === "position" ? <select value={form[key] || ""} onChange={(event) => put(key, event.target.value)}><option>Вратарь</option><option>Защитник</option><option>Нападающий</option></select> : key === "stickHand" ? <select value={form[key] || ""} onChange={(event) => put(key, event.target.value)}><option>Левый</option><option>Правый</option></select> : <input type={key === "birthDate" ? "date" : key === "heightCm" || key === "weightKg" ? "number" : "text"} value={form[key] || ""} onChange={(event) => put(key, event.target.value)} />}</label>)}
      <label>Базовый номер<input value={form.baseNumber || ""} onChange={(event) => put("baseNumber", event.target.value)} inputMode="numeric" maxLength={3} placeholder="Например, 35" /></label>
      <label>Рейтинг игрока<select value={form.ratingCategoryId || ""} onChange={(event) => put("ratingCategoryId", event.target.value)}><option value="">Не указан</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    </div>
    <p className="playerRatingHelp">Рейтинг закреплён за игроком и меняется сразу во всех командах. Базовый номер используется, если команда не установила свой.</p>
    <div className="mediaUploadGrid"><MediaUpload label="Фотография игрока" value={form.photoUrl} kind="players" onChange={(url) => put("photoUrl", url)} /><MediaUpload label="Фотография лауреата" value={form.laureatePhotoUrl} kind="players" onChange={(url) => put("laureatePhotoUrl", url)} /></div>
  </>;
}

function AssignmentEditor({ item, baseNumber, onSaved }: { item: any; baseNumber: string; onSaved: () => Promise<void> }) {
  const [number, setNumber] = useState(item.numberOverride || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setNumber(item.numberOverride || ""); }, [item.numberOverride]);
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/roster", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, expectedUpdatedAt:item.updatedAt, number: number.trim() }) });
      if (!response.ok) { setError((await response.json()).error || "Не удалось сохранить номер"); return; }
      await onSaved();
    } catch { setError("Не удалось сохранить номер"); } finally { setBusy(false); }
  }
  return <article className="playerAssignmentEditor">
    <div className="playerAssignmentIdentity"><b>{item.team} {item.leadership !== "NONE" && <em>{item.leadership === "CAPTAIN" ? "К" : "А"}</em>}</b><small>{item.season} · {item.competition} · {item.division}</small></div>
    <label>Номер этой команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={baseNumber || "Базовый не задан"} /><small>{item.numberOverride ? `Свой номер · базовый № ${baseNumber || "—"}` : `По умолчанию № ${baseNumber || "—"}`}</small></label>
    <span>{item.status === "SUSPENDED" ? "Дисквалифицирован" : item.status === "INACTIVE" ? "Снят" : "Активен"}</span>
    <button disabled={busy || number === (item.numberOverride || "")} onClick={save}>{busy ? "Сохраняю…" : "Сохранить номер"}</button>
    <a href={`/admin/team-roster?entry=${encodeURIComponent(item.teamEntryId)}`}>Дисквалификация и состав →</a>
    {error && <p className="playerAssignmentError" role="alert">{error}</p>}
  </article>;
}

export default function PlayerAdmin() {
  const createKey=useRef<string|null>(null);
  const [player, setPlayer] = useState<any>(null), [form, setForm] = useState<any>(emptyPlayer);
  const [categories, setCategories] = useState<Category[]>([]), [choices, setChoices] = useState<any[]>([]);
  const [isNew, setIsNew] = useState(false), [edit, setEdit] = useState(false), [assign, setAssign] = useState(false);
  const [competitionId, setCompetitionId] = useState(""), [divisionId, setDivisionId] = useState(""), [teamEntryId, setTeamEntryId] = useState("");
  const [number, setNumber] = useState(""), [leadership, setLeadership] = useState("NONE"), [message, setMessage] = useState(""), [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams(window.location.search), creating = params.get("new") === "1";
    setIsNew(creating);
    const choicesResponse = await fetch("/api/admin/roster?choices=1");
    if (choicesResponse.ok) setChoices(await choicesResponse.json());
    if (creating) {
      const response = await fetch("/api/admin/player?categories=1");
      if (response.ok) setCategories((await response.json()).categories || []);
      setForm(emptyPlayer); setEdit(true); return;
    }
    const response = await fetch(`/api/admin/player?slug=${encodeURIComponent(params.get("slug") || "rybchenko-pyotr")}`);
    if (response.ok) { const value = await response.json(); setPlayer(value); setForm(value); setCategories(value.categories || []); }
  }
  useEffect(() => { load(); }, []);
  const put = (key: string, value: string) => setForm((old: any) => ({ ...old, [key]: value }));
  async function save() {
    setError("");
    createKey.current??=crypto.randomUUID();
    const response = await fetch(isNew ? "/api/admin/players" : "/api/admin/player", { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json",'Idempotency-Key':createKey.current }, body: JSON.stringify(isNew ? form : { ...form, id: player.id, expectedUpdatedAt:form.updatedAt }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Не удалось сохранить игрока"); return; }
    if (isNew) { window.location.href = `/admin/player?slug=${result.slug}`; return; }
    setPlayer(result); setForm(result); setCategories(result.categories || []); setEdit(false); setMessage("Данные игрока сохранены");
  }
  async function saveRoster() {
    if (!player || !teamEntryId) return;
    const response = await fetch("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: player.id, teamEntryId, number, leadership }) });
    if (response.ok) { setAssign(false); setNumber(""); await load(); setMessage("Заявка игрока сохранена"); }
    else setError((await response.json()).error || "Не удалось добавить в заявку");
  }
  const competitions = Array.from(new Map(choices.map((choice) => [choice.competitionId, { id: choice.competitionId, label: `${choice.season} · ${choice.competition}` }])).values());
  const divisions = Array.from(new Map(choices.filter((choice) => choice.competitionId === competitionId).map((choice) => [choice.divisionId, { id: choice.divisionId, label: choice.division }])).values());
  const teams = choices.filter((choice) => choice.competitionId === competitionId && choice.divisionId === divisionId);
  if (!isNew && !player) return <main className="adminShell"><section className="adminContent divisionPage">Загрузка…</section></main>;
  if (isNew) return <main className="adminShell adminPlayer"><section className="adminContent divisionPage"><a className="backButton" href="/admin/players">← Все игроки</a><div className="competitionHead"><div><span>НОВАЯ КАРТОЧКА</span><h2>Создание игрока</h2><p>Заполните данные и сохраните карточку.</p></div></div><section className="adminForm playerCreateFull"><h2>Данные игрока</h2>{error && <p className="formError">{error}</p>}<PlayerFields form={form} put={put} categories={categories} /><footer><a href="/admin/players">Отмена</a><button disabled={!form.lastName.trim() || !form.firstName.trim()} onClick={save}>Создать игрока</button></footer></section></section></main>;
  return <main className="adminShell adminPlayer"><section className="adminContent divisionPage">
    <a className="backButton" href="/admin/players">← Все игроки</a>{message && <p className="adminNotice">{message}</p>}
    <div className="playerAdminHead"><div className="playerPhoto">{player.photoUrl ? <PublicImage sizes="(max-width: 700px) 90vw, 320px" src={player.photoUrl} alt="" /> : "ИГ"}</div><div><span>КАРТОЧКА ИГРОКА</span><h1>{player.lastName} {player.firstName}</h1><p>{player.position || "Амплуа не указано"}</p></div><button onClick={() => setEdit(!edit)}>ИЗМЕНИТЬ ДАННЫЕ</button></div>
    <div className="playerInfo"><article><small>Дата рождения</small><b>{player.birthDate || "—"}</b></article><article><small>Страна / место рождения</small><b>{player.country || "—"} · {player.birthPlace || "—"}</b></article><article><small>Хват</small><b>{player.stickHand || "—"}</b></article><article><small>Рост / вес</small><b>{player.heightCm || "—"} см · {player.weightKg || "—"} кг</b></article><article><small>Базовый номер</small><b>№ {player.baseNumber || "—"}</b></article><article><small>Рейтинг</small><b>{player.rating || "—"}</b></article></div>
    {edit && <section className="adminForm"><h2>Данные игрока</h2>{error && <p className="formError">{error}</p>}<PlayerFields form={form} put={put} categories={categories} /><footer><button onClick={() => setEdit(false)}>Отмена</button><button onClick={save}>Сохранить данные</button></footer></section>}
    <div className="adminListHead"><p>Привязка создаётся по цепочке: соревнование → дивизион → команда.</p><button onClick={() => { setNumber(player.baseNumber || ""); setAssign(true); }}>+ ДОБАВИТЬ ПРИВЯЗКУ</button></div>
    {assign && <section className="adminForm rosterBindingForm"><h2>Привязать игрока к заявке</h2><label>1. Соревнование<select value={competitionId} onChange={(event) => { setCompetitionId(event.target.value); setDivisionId(""); setTeamEntryId(""); }}><option value="">Выберите соревнование</option>{competitions.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label>2. Дивизион<select value={divisionId} disabled={!competitionId} onChange={(event) => { setDivisionId(event.target.value); setTeamEntryId(""); }}><option value="">{competitionId ? "Выберите дивизион" : "Сначала выберите соревнование"}</option>{divisions.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label>3. Команда<select value={teamEntryId} disabled={!divisionId} onChange={(event) => setTeamEntryId(event.target.value)}><option value="">{divisionId ? "Выберите команду" : "Сначала выберите дивизион"}</option>{teams.map((choice) => <option key={choice.id} value={choice.id}>{choice.team}</option>)}</select></label><div><label>Номер только для этой команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={player.baseNumber || "Будет взят базовый"} /></label><label>Роль<select value={leadership} onChange={(event) => setLeadership(event.target.value)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label></div>{error && <p className="formError">{error}</p>}<footer><button onClick={() => setAssign(false)}>Отмена</button><button disabled={!teamEntryId} onClick={saveRoster}>Сохранить привязку</button></footer></section>}
    <section className="assignmentTable"><h2>Участие в соревнованиях</h2><p className="assignmentTableHint">Пустой номер команды означает базовый номер игрока. Существующие номера заявок сохранены как индивидуальные.</p>{player.assignments.map((item: any) => <AssignmentEditor key={item.id} item={item} baseNumber={player.baseNumber} onSaved={async () => { await load(); setMessage("Номер команды сохранён"); }} />)}</section>
  </section></main>;
}
