"use client";

import { PublicImage } from "@/components/public-image";


import { useEffect, useState } from "react";
import type { TeamProfileCompetition, TeamProfileData, TeamProfilePlayer } from "@/lib/team-profile";
import styles from "./print.module.css";

const FALLBACK_PHOTO = "/images/player-placeholder.svg";

function positionShort(position: string) {
  const value = position.toLocaleLowerCase("ru");
  if (value.includes("врат")) return "ВР";
  if (value.includes("защит")) return "ЗЩ";
  if (value.includes("напад")) return "НП";
  return "ИГР";
}

function numberValue(value: string) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

export function TeamRosterPrintClient({ team, competition, preview }: {
  team: TeamProfileData;
  competition: TeamProfileCompetition;
  preview: boolean;
}) {
  const [printedAt, setPrintedAt] = useState("");
  const roster = [...competition.players].filter((player) => !player.suspended).sort((a, b) => numberValue(a.number) - numberValue(b.number) || a.lastName.localeCompare(b.lastName, "ru"));
  const suspendedPlayers = competition.players.filter((player) => player.suspended).sort((a, b) => a.lastName.localeCompare(b.lastName, "ru"));
  const goalkeepers = roster.filter((player) => player.position.toLocaleLowerCase("ru").includes("врат"));
  const fieldPlayers = roster.filter((player) => !player.position.toLocaleLowerCase("ru").includes("врат"));

  useEffect(() => {
    setPrintedAt(new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date()));
  }, []);

  useEffect(() => {
    if (preview) return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const images = Array.from(document.querySelectorAll<HTMLImageElement>("[data-roster-print] img"));
    const ready = Promise.all([document.fonts.ready, ...images.map((image) => image.decode().catch(() => undefined))]);
    const limit = new Promise<void>((resolve) => { timeout = setTimeout(resolve, 15_000); });
    Promise.race([ready, limit]).then(() => { clearTimeout(timeout); if (active) window.print(); });
    return () => { active = false; clearTimeout(timeout); };
  }, [preview]);

  const renderPlayer = (player: TeamProfilePlayer) => <article className={styles.player} key={player.id}>
    <b className={styles.number}>{player.number}</b>
    {player.leadership && <em className={styles.leadership}>{player.leadership}</em>}
    <PublicImage width={240} height={320} sizes="240px" loading="eager" className={styles.photo} src={player.photoUrl || FALLBACK_PHOTO} alt={`Фотография игрока ${player.lastName} ${player.firstName}`} />
    <div className={styles.identity}><strong>{player.lastName}</strong><span>{player.firstName}</span><small>{player.birthDate}</small></div>
    <aside className={styles.marks}><span>{positionShort(player.position)}</span><strong>{player.qualification}</strong></aside>
  </article>;

  return <main className={styles.page} data-roster-print><section className={`${styles.sheet} ${roster.length > 20 ? styles.dense : ""}`}>
    <header className={styles.header}><div>{team.logoUrl && <PublicImage width={160} height={160} sizes="160px" loading="eager" className={styles.logo} src={team.logoUrl} alt={`Логотип команды ${team.name}`} />}</div><div className={styles.title}><small>ЗАЯВКА КОМАНДЫ НА ИГРУ</small><h1>{team.name}</h1><p>{competition.label}</p></div><div className={styles.timestamp}>{printedAt && <>Распечатано<br />{printedAt}</>}</div></header>
    {goalkeepers.length > 0 && <section className={styles.group}><h2>Вратари</h2><div className={styles.grid}>{goalkeepers.map(renderPlayer)}</div></section>}
    {fieldPlayers.length > 0 && <section className={styles.group}><h2>Полевые игроки</h2><div className={styles.grid}>{fieldPlayers.map(renderPlayer)}</div></section>}
    {suspendedPlayers.length > 0 && <section className={styles.suspendedGroup}><h2>Дисквалификация · не включать в состав на дату печати</h2>{suspendedPlayers.map((player) => <p key={player.id}><strong>№ {player.number} · {player.lastName} {player.firstName}</strong><span>Дисквалификация{player.suspension ? `: ${player.suspension.reason}` : ""}{player.suspension?.remaining !== null && player.suspension?.remaining !== undefined ? ` · осталось ${player.suspension.remaining} из ${player.suspension.matchesCount} матчей` : ""}</span></p>)}</section>}
  </section></main>;
}
