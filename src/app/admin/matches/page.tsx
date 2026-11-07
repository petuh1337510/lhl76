"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminModal } from "../admin-modal";
import "./match-list.css";

const empty = {
  seasonId: "",
  competitionId: "",
  divisionId: "",
  homeTeamEntryId: "",
  awayTeamEntryId: "",
  date: "",
  time: "",
  venueId: "",
  isPlayoff: false,
};

function moscowDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export default function MatchesPage() {
  const [data, setData] = useState<any>({
      items: [],
      page: 1,
      pages: 1,
      total: 0,
    }),
    [choices, setChoices] = useState<any>({ divisions: [], venues: [] }),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState({
      date: "",
      seasonId: "",
      competitionId: "",
      divisionId: "",
      result: "",
    }),
    [open, setOpen] = useState(false),
    [form, setForm] = useState<any>(empty),
    [editing, setEditing] = useState<any>(null),
    [editForm, setEditForm] = useState({ date: "", time: "", venueId: "" }),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function changeExisting(match:any,remove:boolean){
    if(saving)return;
    const prompt=remove?'Удалить этот пустой запланированный матч? Восстановить его из интерфейса будет нельзя.': 'Отметить завершённый матч как плей-офф? Его результат будет исключён из таблицы регулярного этапа. Протокол и статистика игроков сохранятся. После этого привяжите матч к серии в разделе плей-офф.';
    if(!window.confirm(prompt))return;
    setSaving(true);setError('');
    try{const response=await fetch('/api/admin/matches',{method:remove?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:remove?'delete-empty':'mark-playoff',matchId:match.id,expectedUpdatedAt:match.updatedAt})});const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось сохранить');await load()}catch(e){setError(e instanceof Error?e.message:'Ошибка запроса')}finally{setSaving(false)}
  }
  const load = useCallback(async () => {
    const [list, options] = await Promise.all([
      fetch(
        `/api/admin/matches?${new URLSearchParams({
          page: String(page),
          ...Object.fromEntries(
            Object.entries(filters).filter(([, value]) => Boolean(value)),
          ),
        })}`,
      ),
      fetch("/api/admin/matches?choices=1"),
    ]);
    if (list.ok) setData(await list.json());
    if (options.ok) setChoices(await options.json());
  }, [page, filters]);
  useEffect(() => {
    load();
  }, [load]);
  const seasons = Array.from(
      new Map(
        choices.divisions.map((d: any) => [
          d.seasonId,
          { id: d.seasonId, name: d.season },
        ]),
      ).values(),
    ),
    competitions = Array.from(
      new Map(
        choices.divisions
          .filter((d: any) => d.seasonId === form.seasonId)
          .map((d: any) => [
            d.competitionId,
            { id: d.competitionId, name: d.competition },
          ]),
      ).values(),
    ),
    divisions = choices.divisions.filter(
      (d: any) => d.competitionId === form.competitionId,
    ),
    selectedDivision = choices.divisions.find(
      (d: any) => d.id === form.divisionId,
    ),
    teams = selectedDivision?.teams || [];
  const filterCompetitions = Array.from(
      new Map(
        choices.divisions
          .filter(
            (d: any) => !filters.seasonId || d.seasonId === filters.seasonId,
          )
          .map((d: any) => [
            d.competitionId,
            { id: d.competitionId, name: d.competition },
          ]),
      ).values(),
    ),
    filterDivisions = choices.divisions.filter(
      (d: any) =>
        (!filters.seasonId || d.seasonId === filters.seasonId) &&
        (!filters.competitionId || d.competitionId === filters.competitionId),
    );
  const set = (key: string, value: string | boolean) =>
    setForm((old: any) => ({ ...old, [key]: value }));
  const setFilter = (key: string, value: string) => {
    setPage(1);
    setFilters((old) => ({ ...old, [key]: value }));
  };
  async function create() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.ok) {
        setOpen(false);
        setForm(empty);
        setPage(1);
        await load();
      } else setError(result.error || "Не удалось создать матч");
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setSaving(false);
    }
  }
  function startEditing(match: any) {
    setEditing(match);
    setEditForm({ ...(match.startsAt ? moscowDateTime(match.startsAt) : { date: "", time: "" }), venueId: match.venueId || "" });
    setError("");
    setOpen(false);
  }
  async function saveSchedule() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: editing.id, ...editForm }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Не удалось обновить расписание"); return; }
      setEditing(null);
      await load();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setSaving(false);
    }
  }
  const statusName = (status: string) =>
    status === "FINAL"
      ? "Завершён"
      : status === "LIVE"
        ? "Идёт матч"
        : status === "POSTPONED"
          ? "Перенесён"
          : status === "CANCELLED"
            ? "Отменён"
            : "Запланирован";
  const technicalWinner = (match: any) => {
    if (match.resultType !== "TECHNICAL") return null;
    const winner = match.protocolData?.technicalWinnerTeamEntryId;
    return winner === match.homeTeamEntryId || winner === match.awayTeamEntryId
      ? winner
      : null;
  };
  return (
    <main className="adminShell adminMatches">
      <section className="adminContent divisionPage">
        <div className="competitionHead">
          <div>

            <h1>Матчи и календарь</h1>

          </div>
          <button onClick={() => setOpen(true)}>+ Создать матч</button>
        </div>
        {open && (
          <AdminModal title="Новый матч" onClose={() => setOpen(false)} wide>
          <section className="adminForm matchCreateForm">
            <h2>Новый матч</h2>
            {error && <p className="formError">{error}</p>}
            <div>
              <label>
                1. Сезон
                <select
                  value={form.seasonId}
                  onChange={(e) => {
                    set("seasonId", e.target.value);
                    set("competitionId", "");
                    set("divisionId", "");
                    set("homeTeamEntryId", "");
                    set("awayTeamEntryId", "");
                  }}
                >
                  <option value="">Выберите сезон</option>
                  {seasons.map((value: any) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                2. Соревнование
                <select
                  disabled={!form.seasonId}
                  value={form.competitionId}
                  onChange={(e) => {
                    set("competitionId", e.target.value);
                    set("divisionId", "");
                    set("homeTeamEntryId", "");
                    set("awayTeamEntryId", "");
                  }}
                >
                  <option value="">Выберите соревнование</option>
                  {competitions.map((value: any) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              3. Дивизион
              <select
                disabled={!form.competitionId}
                value={form.divisionId}
                onChange={(e) => {
                  set("divisionId", e.target.value);
                  set("homeTeamEntryId", "");
                  set("awayTeamEntryId", "");
                }}
              >
                <option value="">Выберите дивизион</option>
                {divisions.map((value: any) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label>
                Хозяева
                <select
                  disabled={!form.divisionId}
                  value={form.homeTeamEntryId}
                  onChange={(e) => set("homeTeamEntryId", e.target.value)}
                >
                  <option value="">Выберите команду</option>
                  {teams.map((team: any) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Гости
                <select
                  disabled={!form.divisionId}
                  value={form.awayTeamEntryId}
                  onChange={(e) => set("awayTeamEntryId", e.target.value)}
                >
                  <option value="">Выберите команду</option>
                  {teams
                    .filter((team: any) => team.id !== form.homeTeamEntryId)
                    .map((team: any) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div>
              <label>
                Дата
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              <label>
                Время
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </label>
            </div>
            <label>
              Арена
              <select
                value={form.venueId}
                onChange={(e) => set("venueId", e.target.value)}
              >
                <option value="">Не указана</option>
                {choices.venues.map((venue: any) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                    {venue.city ? ` · ${venue.city}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="playoffCreateToggle">
              <input
                type="checkbox"
                checked={form.isPlayoff}
                onChange={(e) => set("isPlayoff", e.target.checked)}
              />
              <span>
                <b>Матч плей-офф</b>
                Матч автоматически попадёт в активную серию этих команд в выбранном дивизионе. Сначала создайте сетку плей-офф. Очки в таблицу регулярного этапа не начисляются.
              </span>
            </label>
            <footer>
              <button onClick={() => setOpen(false)}>Отмена</button>
              <button
                disabled={
                  saving ||
                  !form.divisionId ||
                  !form.homeTeamEntryId ||
                  !form.awayTeamEntryId ||
                  !form.date ||
                  !form.time
                }
                onClick={create}
              >
                {saving ? "Создание…" : "Создать матч"}
              </button>
            </footer>
          </section>
          </AdminModal>
        )}
        {editing && (
          <AdminModal title="Изменить расписание" onClose={() => { setEditing(null); setError(""); }}>
          <section className="adminForm matchCreateForm">
            <h2>Изменить расписание</h2>
            <p>{editing.homeTeamEntry.team.name} — {editing.awayTeamEntry.team.name}. Команды и дивизион здесь не меняются.</p>
            {error && <p className="formError">{error}</p>}
            <div>
              <label>Дата<input type="date" value={editForm.date} onChange={(e) => setEditForm((old) => ({ ...old, date: e.target.value }))} /></label>
              <label>Время (Москва)<input type="time" value={editForm.time} onChange={(e) => setEditForm((old) => ({ ...old, time: e.target.value }))} /></label>
            </div>
            <label>Арена
              <select value={editForm.venueId} onChange={(e) => setEditForm((old) => ({ ...old, venueId: e.target.value }))}>
                <option value="">Не указана</option>
                {choices.venues.map((venue: any) => <option key={venue.id} value={venue.id}>{venue.name}{venue.city ? ` · ${venue.city}` : ""}</option>)}
              </select>
            </label>
            <footer>
              <button onClick={() => { setEditing(null); setError(""); }}>Отмена</button>
              <button disabled={saving || !editForm.date || !editForm.time} onClick={saveSchedule}>{saving ? "Сохранение…" : "Сохранить"}</button>
            </footer>
          </section>
          </AdminModal>
        )}
        <section className="matchCalendarFilters">
          <label>
            Конкретный день
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilter("date", e.target.value)}
            />
          </label>
          <label>
            Сезон
            <select
              value={filters.seasonId}
              onChange={(e) => {
                setPage(1);
                setFilters((old) => ({
                  ...old,
                  seasonId: e.target.value,
                  competitionId: "",
                  divisionId: "",
                }));
              }}
            >
              <option value="">Все сезоны</option>
              {seasons.map((season: any) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Соревнование
            <select
              value={filters.competitionId}
              onChange={(e) => {
                setPage(1);
                setFilters((old) => ({
                  ...old,
                  competitionId: e.target.value,
                  divisionId: "",
                }));
              }}
            >
              <option value="">Все соревнования</option>
              {filterCompetitions.map((competition: any) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дивизион
            <select
              value={filters.divisionId}
              onChange={(e) => setFilter("divisionId", e.target.value)}
            >
              <option value="">Все дивизионы</option>
              {filterDivisions.map((division: any) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Тип результата
            <select
              value={filters.result}
              onChange={(e) => setFilter("result", e.target.value)}
            >
              <option value="">Все матчи</option>
              <option value="NORMAL">Обычный результат</option>
              <option value="TECHNICAL">Технический результат</option>
              <option value="REVIEW">Нужна проверка</option>
            </select>
          </label>
          <button
            disabled={!Object.values(filters).some(Boolean)}
            onClick={() => {
              setPage(1);
              setFilters({
                date: "",
                seasonId: "",
                competitionId: "",
                divisionId: "",
                result: "",
              });
            }}
          >
            Сбросить
          </button>
        </section>
        <section className="matchAdminList adminMatchTable adminSpacedRows">
          <header>
            <span>КАЛЕНДАРЬ</span>
            <small>{data.total} матчей</small>
          </header>
          <div className="matchAdminColumns" aria-hidden="true">
            <span>Дома</span>
            <span>Счёт</span>
            <span>На выезде</span>
            <span>Статус</span>
            <span>Дата</span>
            <span>Время</span>
            <span>Стадион</span>
            <span>Действия</span>
          </div>
          {data.items.map((match: any) => {
            const winner = technicalWinner(match);
            const technical = match.resultType === "TECHNICAL" && Boolean(winner);
            const dateTime = match.startsAt ? moscowDateTime(match.startsAt) : null;
            const score = technical
              ? [winner === match.homeTeamEntryId ? "+" : "−", winner === match.awayTeamEntryId ? "+" : "−"]
              : match.status === "FINAL"
                ? [match.homeScore ?? "—", match.awayScore ?? "—"]
                : ["—", "—"];
            return <article
              className={`${match.isPlayoff ? "playoffMatch " : ""}${technical ? "technicalMatch " : ""}${match.needsTechnicalReview ? "technicalReviewMatch" : ""}`.trim()}
              key={match.id}
            >
              <a
                className="matchAdminRowLink"
                href={`/admin/match-protocol?match=${match.slug}`}
                aria-label={`Открыть матч: ${match.homeTeamEntry.team.name} — ${match.awayTeamEntry.team.name}`}
              />
              <div className="matchAdminClub matchAdminHome" data-label="Дома">
                <small>{match.division.competition.season.name} · {match.division.competition.name} · {match.division.name}</small>
                <b>{match.homeTeamEntry.team.name}</b>
                {match.isPlayoff && <span className="matchAdminTag">Плей-офф</span>}
              </div>
              <strong className="matchAdminScore" data-label="Счёт">
                <span>{score[0]}</span><i>:</i><span>{score[1]}</span>
              </strong>
              <div className="matchAdminClub matchAdminAway" data-label="На выезде"><b>{match.awayTeamEntry.team.name}</b></div>
              <div className="matchAdminStatus">
                <em className={technical ? "technical" : match.needsTechnicalReview ? "review" : match.status === "FINAL" ? "done" : "planned"}>
                  {technical ? "Технический" : match.needsTechnicalReview ? "Проверить" : statusName(match.status)}
                </em>
                {match.status === "FINAL" && <label className="matchAdminPlayoff"><input type="checkbox" checked={match.isPlayoff} disabled={saving || match.isPlayoff} onChange={() => changeExisting(match, false)} /> Плей-офф</label>}
              </div>
              <time className="matchAdminDate" dateTime={dateTime?.date} data-label="Дата">{dateTime ? new Date(match.startsAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }) : "Не указана"}</time>
              <time className="matchAdminTime" dateTime={dateTime?.time} data-label="Время">{dateTime?.time || "—"}</time>
              <div className="matchAdminVenueCell" data-label="Стадион">
                <span className="matchAdminVenue">{match.venue?.name || "Не указан"}</span>
                {!["LIVE", "FINAL"].includes(match.status) && <button className="matchAdminSchedule" onClick={() => startEditing(match)}>Дата и арена</button>}
              </div>
              <div className="matchAdminActions">
                <a className="matchAdminDetails" href={`/admin/match-protocol?match=${match.slug}`}>Детали</a>
                {match.status === "SCHEDULED" && <button className="matchAdminDelete" disabled={saving} onClick={() => changeExisting(match, true)}>Удалить</button>}
              </div>
              {match.needsTechnicalReview && <p className="matchAdminWarning">Проверьте технический результат</p>}
            </article>;
          })}
          {data.items.length === 0 && <p className="matchAdminEmpty">Матчей по выбранным условиям нет.</p>}
        </section>
        <div className="adminPagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </button>
          <span>
            Страница {data.page} из {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            →
          </button>
        </div>
      </section>
    </main>
  );
}
