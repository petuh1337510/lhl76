"use client";
import { PublicImage } from "@/components/public-image";
import { UiIcon, type IconName } from "@/components/ui-icon";

import { useEffect, useState, useRef } from "react";
import MediaUpload, { usePendingMediaUploads } from "../media-upload";
import { AdminModal } from "../admin-modal";
import { DeleteCard } from "../delete-card";
import { SuggestedInput, useFormSuggestions } from "../form-suggestions";
import PlayersList from "../players/page";
import styles from "./player-profile.module.css";
import formStyles from "./player-form.module.css";

type Category = { id: string; name: string };
type Assignment = {
  id: string;
  updatedAt: string;
  teamEntryId: string;
  season: string;
  competition: string;
  competitionType: "CHAMPIONSHIP" | "TOURNAMENT";
  division: string;
  team: string;
  numberOverride: string;
  leadership: "NONE" | "CAPTAIN" | "ASSISTANT";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};
const emptyPlayer = { firstName: "", lastName: "", patronymic: "", nativeName: "", birthDate: "", country: "Россия", birthPlace: "", position: "Нападающий", stickHand: "Левый", heightCm: "", weightKg: "", league: "ЛХЛ-76", baseNumber: "", ratingCategoryId: "", photoUrl: "", laureatePhotoUrl: "", assignments: [] };

type PlayerField = { key: string; label: string; type?: "date" | "number"; options?: string[] };
const personalFields: PlayerField[] = [
  { key: "lastName", label: "Фамилия" },
  { key: "firstName", label: "Имя" },
  { key: "patronymic", label: "Отчество" },
  { key: "nativeName", label: "Имя в родной стране" },
  { key: "birthDate", label: "Дата рождения", type: "date" },
  { key: "country", label: "Страна" },
  { key: "birthPlace", label: "Место рождения" },
];
const playingFields: PlayerField[] = [
  { key: "position", label: "Амплуа", options: ["Вратарь", "Защитник", "Нападающий"] },
  { key: "stickHand", label: "Хват", options: ["Левый", "Правый"] },
  { key: "heightCm", label: "Рост, см", type: "number" },
  { key: "weightKg", label: "Вес, кг", type: "number" },
  { key: "league", label: "Лига" },
];

function PlayerFields({ form, put, categories, trackUpload }: { form: any; put: (key: string, value: string) => void; categories: Category[]; trackUpload: (uploading: boolean) => void }) {
  const suggestions = useFormSuggestions("player");
  const renderField = ({ key, label, type, options }: PlayerField) => {
    const change = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => put(key, event.target.value);
    return <label key={key}>{label}{options ? (
      <select value={form[key] || ""} onChange={change}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    ) : <SuggestedInput type={type ?? "text"} value={form[key] || ""} onChange={change} suggestions={suggestions[key]} />}</label>;
  };
  return <>
    <section className={formStyles.group}>
      <h3>Личные данные</h3>
      <div className={formStyles.fields}>{personalFields.map(renderField)}</div>
    </section>
    <section className={formStyles.group}>
      <h3>Игровые данные</h3>
      <div className={formStyles.fields}>
        {playingFields.map(renderField)}
        <label>Базовый номер<input value={form.baseNumber || ""} onChange={(event) => put("baseNumber", event.target.value)} inputMode="numeric" maxLength={3} placeholder="Например, 35" /></label>
        <label>Рейтинг игрока<select value={form.ratingCategoryId || ""} onChange={(event) => put("ratingCategoryId", event.target.value)}><option value="">Не указан</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>
      <p className={formStyles.hint}>Рейтинг общий для всех команд. Номер в заявке имеет приоритет над базовым.</p>
    </section>
    <section className={formStyles.group}>
      <h3>Фотографии</h3>
      <div className={formStyles.photos}>
        <MediaUpload label="Фотография игрока" value={form.photoUrl} kind="players" onChange={url => put("photoUrl", url)} onUploadingChange={trackUpload} />
        <MediaUpload label="Фотография лауреата" value={form.laureatePhotoUrl} kind="players" onChange={url => put("laureatePhotoUrl", url)} onUploadingChange={trackUpload} />
      </div>
    </section>
  </>;
}

function AssignmentEditor({ item, baseNumber, onSaved }: { item: Assignment; baseNumber: string; onSaved: () => Promise<void> }) {
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
  const competitionAccent = item.competitionType === "CHAMPIONSHIP" ? "championship"
    : /памят/i.test(item.competition) ? "memorial"
    : /апрел/i.test(item.competition) ? "april" : undefined;
  return <article className={styles.card} data-competition={competitionAccent}>
    <div className={styles.details}>
      <div className={styles.cardHeading}>
        <h4>{item.competition}</h4>
        <span className={styles.status} data-status={item.status}>
          {item.status === "SUSPENDED" ? "Дисквалифицирован" : item.status === "INACTIVE" ? "Снят" : "Активен"}
        </span>
      </div>
      <p><strong>{item.team}</strong> · {item.division}{item.leadership !== "NONE" && <> · {item.leadership === "CAPTAIN" ? "Капитан" : "Ассистент"}</>}</p>
      <a href={`/admin/team-roster?entry=${encodeURIComponent(item.teamEntryId)}`}>Дисквалификация и состав →</a>
    </div>
    <div className={styles.number}>
      <label>Номер в команде<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={baseNumber || "—"} /></label>
      <button className={styles.save} disabled={busy || number === (item.numberOverride || "")} onClick={save}>
        <UiIcon name="save" />{busy ? "Сохраняю…" : "Сохранить номер"}
      </button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </article>;
}

export default function PlayerAdmin() {
  const { uploadsPending, trackUpload } = usePendingMediaUploads();
  const createKey=useRef<string|null>(null);
  const [player, setPlayer] = useState<any>(null), [form, setForm] = useState<any>(emptyPlayer);
  const [missing, setMissing] = useState(false);
  const [fromTeamEntry, setFromTeamEntry] = useState("");
  const backHref = fromTeamEntry ? `/admin/team-roster?entry=${encodeURIComponent(fromTeamEntry)}` : "/admin/players";
  const backLabel = fromTeamEntry ? "← Вернуться к составу команды" : "← Все игроки";
  const [categories, setCategories] = useState<Category[]>([]), [choices, setChoices] = useState<any[]>([]);
  const [isNew, setIsNew] = useState(false), [edit, setEdit] = useState(false), [assign, setAssign] = useState(false);
  const [competitionId, setCompetitionId] = useState(""), [divisionId, setDivisionId] = useState(""), [teamEntryId, setTeamEntryId] = useState("");
  const [number, setNumber] = useState(""), [leadership, setLeadership] = useState("NONE"), [message, setMessage] = useState(""), [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams(window.location.search), creating = params.get("new") === "1";
    setFromTeamEntry(params.get("fromTeamEntry")?.trim() || "");
    setIsNew(creating);
    const choicesResponse = await fetch("/api/admin/roster?choices=1");
    if (choicesResponse.ok) setChoices(await choicesResponse.json());
    if (creating) {
      const response = await fetch("/api/admin/player?categories=1");
      if (response.ok) setCategories((await response.json()).categories || []);
      setForm(emptyPlayer); setEdit(true); return;
    }
    const response = await fetch(`/api/admin/player?slug=${encodeURIComponent(params.get("slug") || "rybchenko-pyotr")}`);
    setMissing(response.status === 404);
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
  if (missing) return <main className="adminShell"><section className="adminContent divisionPage"><h1>Игрок не найден</h1><a href={backHref}>{backLabel}</a></section></main>;
  if (!isNew && !player) return <main className="adminShell"><section className="adminContent divisionPage">Загрузка…</section></main>;
  if (isNew) return <><PlayersList /><div className="adminContent adminModalMount"><AdminModal title="Создание игрока" onClose={() => { window.location.href = "/admin/players"; }} wide><section className="adminForm playerCreateFull"><h2>Данные игрока</h2>{error && <p className="formError">{error}</p>}<PlayerFields form={form} put={put} categories={categories} trackUpload={trackUpload} /><footer><a href="/admin/players">Отмена</a><button disabled={uploadsPending || !form.lastName.trim() || !form.firstName.trim()} onClick={save}>Создать игрока</button></footer></section></AdminModal></div></>;
  const assignmentsBySeason = new Map<string, Assignment[]>();
  for (const item of player.assignments as Assignment[]) {
    const season = assignmentsBySeason.get(item.season);
    if (season) season.push(item);
    else assignmentsBySeason.set(item.season, [item]);
  }
  const facts: { icon: IconName; label: string; value: string }[] = [
    { icon: "calendar", label: "Дата рождения", value: player.birthDate || "—" },
    { icon: "pin", label: "Страна / место рождения", value: [player.country, player.birthPlace].filter(Boolean).join(" · ") || "—" },
    { icon: "shirt", label: "Хват", value: player.stickHand || "—" },
    { icon: "ruler", label: "Рост / вес", value: `${player.heightCm || "—"} см · ${player.weightKg || "—"} кг` },
    { icon: "hash", label: "Базовый номер", value: player.baseNumber ? `№ ${player.baseNumber}` : "—" },
    { icon: "star", label: "Рейтинг", value: player.rating || "—" },
  ];
  return <main className="adminShell adminPlayer"><section className={`adminContent divisionPage ${styles.profile}`}>
    <a className="backButton" href={backHref}>{backLabel}</a>{message && <p className="adminNotice">{message}</p>}
    <header className={styles.hero}>
      <div className={styles.portrait} aria-hidden="true">
        {player.photoUrl ? <PublicImage src={player.photoUrl} width={216} height={216} sizes="108px" alt="" /> : `${player.lastName?.[0] ?? ""}${player.firstName?.[0] ?? ""}`}
      </div>
      <div className={styles.identity}>
        <h1>{player.lastName} {player.firstName}</h1>
        <p>{player.position || "Амплуа не указано"}</p>
      </div>
      <button className={styles.edit} onClick={() => setEdit(true)}><UiIcon name="edit" />Изменить данные</button>
    </header>
    <dl className={styles.facts}>
      {facts.map(({ icon, label, value }) => <div className={styles.fact} key={label}>
        <dt><UiIcon name={icon} />{label}</dt>
        <dd>{value}</dd>
      </div>)}
    </dl>
    {edit && <AdminModal title="Данные игрока" onClose={() => setEdit(false)} wide><section className="adminForm"><h2>Данные игрока</h2>{error && <p className="formError">{error}</p>}<PlayerFields form={form} put={put} categories={categories} trackUpload={trackUpload} /><footer><button onClick={() => setEdit(false)}>Отмена</button><button disabled={uploadsPending} onClick={save}>Сохранить данные</button></footer></section></AdminModal>}
    {assign && <AdminModal title="Привязать игрока к заявке" onClose={() => setAssign(false)}><section className="adminForm rosterBindingForm"><h2>Привязать игрока к заявке</h2><label>1. Соревнование<select value={competitionId} onChange={(event) => { setCompetitionId(event.target.value); setDivisionId(""); setTeamEntryId(""); }}><option value="">Выберите соревнование</option>{competitions.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label>2. Дивизион<select value={divisionId} disabled={!competitionId} onChange={(event) => { setDivisionId(event.target.value); setTeamEntryId(""); }}><option value="">{competitionId ? "Выберите дивизион" : "Сначала выберите соревнование"}</option>{divisions.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label>3. Команда<select value={teamEntryId} disabled={!divisionId} onChange={(event) => setTeamEntryId(event.target.value)}><option value="">{divisionId ? "Выберите команду" : "Сначала выберите дивизион"}</option>{teams.map((choice) => <option key={choice.id} value={choice.id}>{choice.team}</option>)}</select></label><div><label>Номер только для этой команды<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" maxLength={3} placeholder={player.baseNumber || "Будет взят базовый"} /></label><label>Роль<select value={leadership} onChange={(event) => setLeadership(event.target.value)}><option value="NONE">Нет</option><option value="CAPTAIN">Капитан</option><option value="ASSISTANT">Ассистент</option></select></label></div>{error && <p className="formError">{error}</p>}<footer><button onClick={() => setAssign(false)}>Отмена</button><button disabled={!teamEntryId} onClick={saveRoster}>Сохранить привязку</button></footer></section></AdminModal>}
    <section className={styles.participation} aria-labelledby="player-participation">
      <header className={styles.heading}>
        <div>
          <h2 id="player-participation">Участие в соревнованиях</h2>
          {assignmentsBySeason.size > 0 && <p>Если поле номера пустое, используется базовый номер игрока.</p>}
        </div>
        <button className={styles.add} onClick={() => { setNumber(player.baseNumber || ""); setAssign(true); }}><UiIcon name="plus" />Добавить привязку</button>
      </header>
      {Array.from(assignmentsBySeason, ([season, items]) => <section className={styles.season} key={season}>
        <h3 className={styles.seasonTitle}><UiIcon name="calendar" />Сезон {season}</h3>
        <div className={styles.cards}>
          {items.map(item => <AssignmentEditor key={item.id} item={item} baseNumber={player.baseNumber} onSaved={async () => { await load(); setMessage("Номер команды сохранён"); }} />)}
        </div>
      </section>)}
      {assignmentsBySeason.size === 0 && <p className={styles.empty}>У игрока пока нет заявок.</p>}
    </section>
    <DeleteCard kind="player" id={player.id} updatedAt={player.updatedAt} name={`${player.lastName} ${player.firstName}`} />
  </section></main>;
}
