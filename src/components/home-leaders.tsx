"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DivisionPlayerStatistic, DivisionTeam } from "@/lib/division-page";
import { PublicImage } from "./public-image";
import { UiIcon } from "./ui-icon";
import styles from "./home-leaders.module.css";

import { homeLeaderCategories as categories, homeLeaderRows } from "@/lib/home-leaders";

export function HomeLeaders({ players, teams, href }: { players: DivisionPlayerStatistic[]; teams: DivisionTeam[]; href: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const measure = () => { const el = track.current; if (el) setEdges({ start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }); };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollLeft = 0;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [href]);
  const move = (direction: number) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement;
    el.scrollBy({ left: direction * (card.offsetWidth + 24), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <>
    <div ref={track} className={styles.track} onScroll={measure} tabIndex={0} role="region" aria-label="Категории лучших игроков — прокрутите для просмотра вратарей">
      {categories.map(category => {
        const rows = homeLeaderRows(players, category);
        return <article className={styles.board} key={category.metric}>
          <header className={styles.heading}><Link href={`${href}&view=${category.goalie ? "goalkeepers" : "skaters"}&sort=${category.metric}`}>{category.title}</Link><span>{category.label}</span></header>
          <ol className={styles.list}>
            {rows.map((player, index) => {
              const team = teams.find(team => team.slug === player.teamSlug);
              const value = player[category.metric];
              return <li className={styles.row} key={player.key}>
                <Link href={`/player/${player.slug}`} className={styles.portrait} aria-label={`Карточка игрока ${player.name}`}>
                  <PublicImage src={player.photoUrl || "/images/player-placeholder.svg"} alt={player.name} width={192} height={256} sizes="(max-width: 600px) 72px, 80px" />
                  <span className={styles.rank} aria-label={`${index + 1} место`}>{index + 1}</span>
                </Link>
                <div className={styles.identity}>
                  <Link className={styles.name} href={`/player/${player.slug}`}>{player.name}</Link>
                  <Link className={styles.team} href={`/team/${player.teamSlug}${team ? `?competition=${team.id}` : ""}`}>
                    {team?.logoUrl && <PublicImage src={team.logoUrl} alt="" width={48} height={48} sizes="24px" />}
                    <span>{player.teamName}</span>
                  </Link>
                  <span className={styles.position}>{player.position}</span>
                </div>
                <div className={styles.score}><strong>{category.goalie ? Number(value).toFixed(category.metric === "savePercentage" ? 1 : 2) : value}</strong>{category.metric === "points" && <small>{player.goals}+{player.assists}</small>}</div>
              </li>;
            })}
          </ol>
          {!rows.length && <p className={styles.empty}>{category.goalie ? "Вратарская статистика пока не заполнена." : "Статистика появится после сыгранных матчей."}</p>}
        </article>;
      })}
    </div>
    <nav className={styles.controls} aria-label="Переключение категорий лучших игроков">
      <button onClick={() => move(-1)} disabled={edges.start} aria-label="Предыдущие категории"><UiIcon name="arrow-left" /></button>
      <span>Полевые игроки и вратари</span>
      <button onClick={() => move(1)} disabled={edges.end} aria-label="Следующие категории"><UiIcon name="arrow-right" /></button>
    </nav>
  </>;
}
