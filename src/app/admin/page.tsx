"use client";

import { useEffect, useState } from "react";
import { useAdminUser } from "./admin-session";

type DashboardData = {
  activeSeason: { id: string; name: string } | null;
  counts: { upcomingMatches: number; teams: number; players: number; draftNews: number };
  nextMatches: Array<{ id: string; slug: string; division: string; home: string; away: string; startsAt: string | null; status: string }>;
};

export default function Admin() {
  const [data, setData] = useState<DashboardData | null>(null);
  const user = useAdminUser();
  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setData);
  }, []);

  const secretary = user?.role === "SECRETARY";
  const cards = [
    { label: "Предстоящие матчи", value: data?.counts.upcomingMatches, href: "/admin/matches" },
    ...(!secretary ? [
      { label: "Команды в сезоне", value: data?.counts.teams, href: "/admin/teams" },
      { label: "Игроки в заявках", value: data?.counts.players, href: "/admin/players" },
      { label: "Черновики новостей", value: data?.counts.draftNews, href: "/admin/news" },
    ] : []),
  ];

  return (
    <section className="adminContent adminDashboard">
      <header className="adminTop">
        <h1>{secretary ? "Работа с матчами" : "Обзор"}</h1>
        {user && <div className="adminUser">
          <b aria-hidden="true">{user.name.slice(0, 1)}</b>
          <p>{user.name}<br /><small>{secretary ? "Секретарь" : user.role === "SUPER_ADMIN" ? "Главный администратор" : "Администратор"}</small></p>
        </div>}
      </header>
      <div className="adminNotice">
        <b>{data?.activeSeason ? `Активный сезон · ${data.activeSeason.name}` : "Активный сезон не выбран"}</b>
        {!secretary && <a href="/admin/seasons">Управление сезонами →</a>}
      </div>
      <div className="adminStats">
        {cards.map(card => <a key={card.href} href={card.href}>
          <span>{card.label}</span>
          <strong>{card.value ?? "—"}</strong>
        </a>)}
      </div>
      <div className="adminGrid">
        <article className="adminPanel dashboardMatches">
          <header><h2>Ближайшие матчи</h2><a href="/admin/matches">Все матчи</a></header>
          {data?.nextMatches.length ? <ul>{data.nextMatches.map(match => <li key={match.id}>
            <a href={`/admin/match-protocol?match=${encodeURIComponent(match.slug)}`}>
              <b>{match.home} — {match.away}</b>
              <span>{match.status === "LIVE" ? "В эфире" : match.startsAt ? new Date(match.startsAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Дата не назначена"} · {match.division}</span>
            </a>
          </li>)}</ul> : <p className="dashboardEmpty">Предстоящих матчей пока нет.</p>}
        </article>
        {!secretary && <article className="adminPanel">
          <header><h2>Быстрый доступ</h2></header>
          <ul>
            <li><a href="/admin/teams"><b>Заявки команд</b></a></li>
            <li><a href="/admin/news"><b>Редактор новостей</b></a></li>
          </ul>
        </article>}
      </div>
    </section>
  );
}
