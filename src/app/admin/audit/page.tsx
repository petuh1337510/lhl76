"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  after: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
};
type DataIssue = {
  id: string;
  slug: string;
  startsAt: string | null;
  season: string;
  competition: string;
  division: string;
  home: string;
  away: string;
  storedScore: string;
  eventScore: string;
  rosterSize: number;
  eventPlayersOutsideRoster: number;
  imported: boolean;
  reviewNote?: string | null;
  issues: string[];
};

const sections: Record<string, string> = {
  matches: "Матчи",
  "match-protocol": "Протокол матча",
  news: "Новости",
  teams: "Команды",
  team: "Команда",
  players: "Игроки",
  player: "Игрок",
  roster: "Заявки",
  seasons: "Сезоны",
  media: "Медиагалерея",
  broadcasts: "Трансляции",
  documents: "Документы",
  laureates: "Лауреаты",
  venues: "Стадионы",
  "homepage-content": "Главная страница",
  users: "Пользователи",
  upload: "Загрузка файла",
};
const actions: Record<string, string> = {
  POST: "Создание",
  PATCH: "Изменение",
  PUT: "Обновление",
  DELETE: "Удаление",
};

export default function Audit() {
  const [mode, setMode] = useState<"data" | "log">("data");
  const [items, setItems] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<any>(null);
  const [seasonId, setSeasonId] = useState("");
  const [issue, setIssue] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (mode !== "log") return;
    fetch(`/api/admin/audit${filter ? `?type=${filter}` : ""}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => {
        setItems(value.items ?? []);
        setTotal(value.total ?? 0);
      });
  }, [filter, mode]);

  useEffect(() => {
    if (mode !== "data") return;
    const params = new URLSearchParams({ scope: "data", page: String(page) });
    if (seasonId) params.set("seasonId", seasonId);
    if (issue) params.set("issue", issue);
    fetch(`/api/admin/audit?${params}`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setData);
  }, [issue, mode, page, seasonId]);

  return (
    <section className="adminContent divisionPage auditPage">
      <a className="backButton" href="/admin">← К панели управления</a>
      <div className="competitionHead">
        <div>
          <span>КОНТРОЛЬ СИСТЕМЫ</span>
          <h2>{mode === "data" ? "Качество данных" : "Журнал действий"}</h2>
          <p>
            {mode === "data"
              ? "Проверка исторических матчей без автоматического изменения результатов."
              : "История изменений, выполненных пользователями админки."}
          </p>
        </div>
        <b>{mode === "data" ? `${data?.total ?? "—"} матчей` : `${total} записей`}</b>
      </div>
      <div className="auditModeTabs">
        <button className={mode === "data" ? "active" : ""} onClick={() => setMode("data")}>Качество данных</button>
        <button className={mode === "log" ? "active" : ""} onClick={() => setMode("log")}>Журнал действий</button>
      </div>

      {mode === "data" ? (
        <>
          <div className="dataAuditFilters">
            <label>
              Сезон
              <select value={seasonId} onChange={(event) => { setSeasonId(event.target.value); setPage(1); }}>
                <option value="">Все сезоны</option>
                {(data?.seasons ?? []).map((season: any) => <option value={season.id} key={season.id}>{season.name}{season.isActive ? " · активный" : ""}</option>)}
              </select>
            </label>
            <label>
              Тип расхождения
              <select value={issue} onChange={(event) => { setIssue(event.target.value); setPage(1); }}>
                <option value="">Все расхождения</option>
                {(data?.summary ?? []).map((item: any) => <option value={item.code} key={item.code}>{item.label} · {item.count}</option>)}
              </select>
            </label>
          </div>
          <div className="dataAuditSummary">
            {(data?.summary ?? []).map((item: any) => (
              <button className={issue === item.code ? "active" : ""} onClick={() => { setIssue(issue === item.code ? "" : item.code); setPage(1); }} key={item.code}>
                <strong>{item.count}</strong><span>{item.label}</span>
              </button>
            ))}
          </div>
          {data?.overview && <p className={`dataAuditScope ${data.overview.nativeWithIssues ? "warning" : "ok"}`}>
            Проверено матчей: <b>{data.overview.matchesChecked}</b>. Расхождения в импортированных данных: <b>{data.overview.importedWithIssues}</b>. На новом сайте: <b>{data.overview.nativeWithIssues}</b>.
          </p>}
          <section className="dataAuditList">
            {(data?.items ?? []).length ? data.items.map((item: DataIssue) => (
              <article key={item.id}>
                <header>
                  <div><span>{item.season} · {item.competition} · {item.division}</span><h3>{item.home} — {item.away}</h3></div>
                  <em>{item.imported ? "ИМПОРТ" : "НОВЫЙ САЙТ"}</em>
                </header>
                <div className="dataAuditFacts">
                  <span><small>Дата</small><b>{item.startsAt ? new Date(item.startsAt).toLocaleDateString("ru-RU") : "—"}</b></span>
                  <span><small>Счёт матча</small><b>{item.storedScore}</b></span>
                  <span><small>По голам</small><b>{item.eventScore}</b></span>
                  <span><small>Состав</small><b>{item.rosterSize} игроков</b></span>
                </div>
                <ul>{item.issues.map((code) => <li key={code}>{data.labels[code]}</li>)}</ul>
                {item.reviewNote && <p className="dataAuditScope warning">{item.reviewNote}</p>}
                <footer>
                  <span>{item.eventPlayersOutsideRoster ? `Вне состава: ${item.eventPlayersOutsideRoster}` : "Ручная проверка протокола"}</span>
                  <a href={`/admin/match-protocol?match=${item.slug}`}>Открыть протокол →</a>
                </footer>
              </article>
            )) : <p className="registryEmpty">По выбранным фильтрам расхождений нет.</p>}
          </section>
          {data?.pages > 1 && <nav className="calendarPagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>← Назад</button><span>{page} / {data.pages}</span><button disabled={page === data.pages} onClick={() => setPage((value) => value + 1)}>Далее →</button></nav>}
        </>
      ) : (
        <>
          <div className="auditFilters"><button className={!filter ? "active" : ""} onClick={() => setFilter("")}>Все разделы</button>{Object.entries(sections).map(([value, label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
          <section className="auditList">{items.length ? items.map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleString("ru-RU")}</time><div><b>{item.user?.name ?? "Система"}</b><small>{item.user?.email ?? "Автоматическое действие"}</small></div><strong>{actions[item.action] ?? item.action}</strong><span>{sections[item.entityType] ?? item.entityType}</span><code>{item.entityId === "new" ? "Новый объект" : item.entityId}</code><details><summary>Детали</summary><pre>{item.after ? JSON.stringify(item.after, null, 2) : "Дополнительных данных нет"}</pre></details></article>) : <p className="registryEmpty">Действий пока нет.</p>}</section>
        </>
      )}
    </section>
  );
}
