"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { PublicImage } from "@/components/public-image";
import { getLogoAccent } from "@/lib/logo-accent";
import type { TeamProfileMatch } from "@/lib/team-profile";
import styles from "./calendar-match-card.module.css";

const matchDate = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Moscow",
});
const matchTime = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

type CalendarMatch = Omit<TeamProfileMatch, "id" | "slug" | "technicalWinner"> & { resultType?: string };
type Side = "home" | "away";

function Team({ team, href, side, onLogoLoad }: {
  team: CalendarMatch[Side];
  href: string;
  side: Side;
  onLogoLoad: (logoUrl: string, image: HTMLImageElement) => void;
}) {
  const { logoUrl } = team;
  return (
    <Link className={styles.team} data-side={side} href={href}>
      <span className={styles.logoBox}>
        {logoUrl ? (
          <PublicImage
            width={160}
            height={160}
            sizes="52px"
            src={logoUrl}
            alt=""
            onLoad={team.calendarAccent ? undefined : (event) => onLogoLoad(logoUrl, event.currentTarget)}
          />
        ) : (
          <span aria-hidden="true">{team.name.slice(0, 1)}</span>
        )}
      </span>
      <strong className={styles.teamName} title={team.name}>{team.name}</strong>
    </Link>
  );
}

export function CalendarMatchCard({
  match, href, homeHref, awayHref, technicalWinner, stageName,
}: {
  match: CalendarMatch;
  href: string;
  homeHref: string;
  awayHref: string;
  technicalWinner: Side | null;
  stageName?: string;
}) {
  const [logoColors, setLogoColors] = useState<Record<string, string>>({});
  const final = match.status === "FINAL";
  const live = match.status === "LIVE";
  const technical = final && (match.resultType === "TECHNICAL" || technicalWinner !== null);
  const date = match.startsAt ? new Date(match.startsAt) : null;
  let winner = final ? technicalWinner : null;
  let score = "—";
  if (final || live) score = `${match.homeScore} — ${match.awayScore}`;
  if (technical) {
    score = technicalWinner === "home" ? "+ — −" : technicalWinner === "away" ? "− — +" : "—";
  } else if (final && match.homeScore !== match.awayScore) {
    winner = match.homeScore > match.awayScore ? "home" : "away";
  }
  const winningTeam = winner ? match[winner] : null;
  const winnerColor = winningTeam?.calendarAccent
    || (winningTeam?.logoUrl ? logoColors[winningTeam.logoUrl] : undefined);
  const winnerStyle = winnerColor
    ? { "--winner-accent": winnerColor } as CSSProperties
    : undefined;

  function readLogoColor(logoUrl: string, image: HTMLImageElement) {
    if (image.dataset.imageState !== "source") return;
    const color = getLogoAccent(image);
    if (color) {
      setLogoColors((previous) => previous[logoUrl] === color ? previous : { ...previous, [logoUrl]: color });
    }
  }

  let badge = match.isPlayoff ? "Плей-офф" : null;
  let detail = stageName || "Предстоящий матч";
  if (final) detail = match.periodScores || "Матч завершён";
  if (technical) detail = "Технический результат";
  if (live) {
    badge = "Лайв";
    detail = match.periodScores || "Счёт обновляется онлайн";
  }
  if (match.status === "POSTPONED") detail = "Матч перенесён";
  if (match.status === "CANCELLED") detail = "Матч отменён";
  const matchLabel = `Открыть матч ${match.home.name} — ${match.away.name}${final || live ? `, счёт ${score}` : ""}`;

  return (
    <article className={styles.card} data-winner={winner ?? undefined} data-live={live || undefined} style={winnerStyle}>
      <div className={styles.meta}>
        {date ? (
          <time className={styles.date} dateTime={match.startsAt ?? undefined}>
            {matchDate.format(date).replace(/\.$/, "")}
            <span className={styles.separator} aria-hidden="true">|</span>
            {matchTime.format(date)}
            <span className={styles.timeZone}> мск</span>
          </time>
        ) : <span className={styles.date}>Дата уточняется</span>}
        <p className={styles.venue} title={match.venue ?? undefined}>
          {match.venue || (final ? "Место не указано" : "Место уточняется")}
        </p>
      </div>
      <div className={styles.versus}>
        <Team team={match.home} href={homeHref} side="home" onLogoLoad={readLogoColor} />
        <Link className={styles.result} href={href} aria-label={matchLabel}>
          <span className={styles.arrow} aria-hidden="true">↗</span>
          <span className={styles.scoreBox}>
            {badge && <span className={styles.badge}>{badge}</span>}
            <b className={styles.score}>{score}</b>
          </span>
        </Link>
        <Team team={match.away} href={awayHref} side="away" onLogoLoad={readLogoColor} />
      </div>
      <p className={styles.detail}>{detail}</p>
    </article>
  );
}
