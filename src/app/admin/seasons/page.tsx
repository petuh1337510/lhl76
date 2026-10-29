"use client";

import { useEffect, useState } from "react";

type SeasonItem = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  competitions: number;
  championships: number;
  tournaments: number;
  divisions: number;
  teams: number;
  matches: number;
  canActivate: boolean;
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "не указана";
}

export default function SeasonsPage() {
  const [items, setItems] = useState<SeasonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = () => fetch("/api/admin/seasons", { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => setItems(data.items ?? []))
    .finally(() => setLoading(false));

  useEffect(() => { load().catch(() => setMessage("Не удалось загрузить сезоны")); }, []);

  const activate = async (season: SeasonItem) => {
    if (!season.canActivate || season.isActive) return;
    if (!window.confirm(`Сделать сезон ${season.name} активным на всём публичном сайте?`)) return;
    setSwitching(season.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/seasons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось переключить сезон");
      setItems(data.items);
      setMessage(`Сезон ${season.name} назначен активным. Публичный сайт уже переключён.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переключить сезон");
    } finally {
      setSwitching(null);
    }
  };

  return <main className="adminShell"><section className="adminContent divisionPage adminSeasons">
    <div className="adminRegistryHead"><div><span>СОРЕВНОВАНИЯ</span><h1>Сезоны</h1><p>Активный сезон определяет содержимое главной, календаря, таблиц и статистики.</p></div></div>
    {message ? <div className={`seasonMessage ${message.includes("назначен") ? "success" : "error"}`}>{message}</div> : null}
    <div className="seasonSafety"><b>Как работает переключение</b><span>Активным может быть только один сезон. Старые сезоны не удаляются и остаются в архиве.</span></div>
    <section className="seasonManagerList">
      {loading ? <p className="registryEmpty">Загружаю сезоны…</p> : items.map((season) => <article className={season.isActive ? "active" : ""} key={season.id}>
        <header><div><span>СЕЗОН</span><h2>{season.name}</h2><p>{date(season.startsAt)} — {date(season.endsAt)}</p></div>{season.isActive ? <em>● АКТИВНЫЙ</em> : null}</header>
        <div className="seasonManagerStats">
          <span><b>{season.competitions}</b> соревнований</span>
          <span><b>{season.divisions}</b> дивизионов</span>
          <span><b>{season.teams}</b> команд</span>
          <span><b>{season.matches}</b> матчей</span>
        </div>
        <footer>
          <a href={`/admin/competitions?seasonId=${encodeURIComponent(season.id)}`}>Открыть соревнования</a>
          <small>{season.canActivate ? "Сезон готов к публикации" : "Для публикации нужны чемпионат, дивизион и команда"}</small>
          <button disabled={season.isActive || !season.canActivate || switching !== null} onClick={() => activate(season)}>{season.isActive ? "УЖЕ АКТИВЕН" : switching === season.id ? "ПЕРЕКЛЮЧАЮ…" : "СДЕЛАТЬ АКТИВНЫМ"}</button>
        </footer>
      </article>)}
    </section>
  </section></main>;
}
