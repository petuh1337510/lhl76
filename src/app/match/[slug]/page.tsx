import { UiIcon } from "@/components/ui-icon";
import { PublicImage } from "@/components/public-image";
import Link from "next/link";
import { PublicReturnLink } from "@/components/public-return-link";
import { safeReturn } from "@/lib/public-navigation";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { MatchStatScroller } from "./match-stat-scroller";
import { PublicSiteHeader } from "@/components/public-site-header";
import { LiveMatchRefresh } from "@/components/live-match-refresh";
import { getPublicMatch } from "@/lib/match-page";

export const dynamic = "force-dynamic";

function MatchPlayerLink({ slug, className, children }: { slug: string; className: string; children: ReactNode }) {
  return slug ? <Link className={className} href={`/player/${slug}`}>{children}</Link> : <div className={className}>{children}</div>;
}

function formatDate(value: string | null) {
  if (!value) return { date: "Дата и время уточняются", time: "—" };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(date),
    time: new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(date),
  };
}

function MatchTeam({
  team,
}: {
  team: {
    slug: string;
    name: string;
    city: string | null;
    logoUrl: string | null;
  };
}) {
  return (
    <Link href={`/team/${team.slug}`}>
      <i>
        {team.logoUrl ? (
          <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" />
        ) : (
          team.name.slice(0, 1)
        )}
      </i>
      <b>{team.name}</b>
      {team.city && <small>{team.city}</small>}
    </Link>
  );
}

function Roster({
  team,
  players,
}: {
  team: {
    name: string;
    city: string | null;
    logoUrl: string | null;
  };
  players: Awaited<ReturnType<typeof getPublicMatch>> extends infer M
    ? M extends { rosters: { home: infer R } }
      ? R
      : never
    : never;
}) {
  const normalizedPosition = (position: string) => position.toLocaleLowerCase("ru");
  const ratingCounts = new Map<string, number>();
  for (const player of new Map(players.map(player => [player.id, player])).values()) {
    if (normalizedPosition(player.position).includes("врат")) continue;
    const rating = player.qualification.trim();
    const label = rating && rating !== "—" ? rating : "Без рейтинга";
    ratingCounts.set(label, (ratingCounts.get(label) ?? 0) + 1);
  }
  const ratingOrder = ["1", "1+", "2", "2+", "2+**", "3", "3>", "3+", "3+*", "3++", "4"];
  const ratingSummary = [...ratingCounts].sort(([a], [b]) => {
    const rank = (rating: string) => rating === "Без рейтинга" ? ratingOrder.length + 1 : ratingOrder.includes(rating) ? ratingOrder.indexOf(rating) : ratingOrder.length;
    return rank(a) - rank(b) || a.localeCompare(b, "ru", { numeric: true });
  }).map(([rating, count]) => {
    const people = count % 10 === 1 && count % 100 !== 11 ? "человек" : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "человека" : "человек";
    return `${rating} — ${count} ${people}`;
  }).join(", ");
  const groups = [
    {
      label: "Вратари",
      players: players.filter((player) => normalizedPosition(player.position).includes("врат")),
    },
    {
      label: "Защитники",
      players: players.filter((player) => normalizedPosition(player.position).includes("защит")),
    },
    {
      label: "Нападающие",
      players: players.filter((player) => normalizedPosition(player.position).includes("напад")),
    },
    {
      label: "Полевые игроки",
      players: players.filter((player) => {
        const position = normalizedPosition(player.position);
        return !position.includes("врат") && !position.includes("защит") && !position.includes("напад");
      }),
    },
  ].filter((group) => group.players.length > 0);

  return (
    <section className="publicMatchRoster">
      <header className="publicMatchRosterHeader">
        <i>
          {team.logoUrl ? <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" /> : team.name.slice(0, 1)}
        </i>
        <p>
          <strong>{team.name}</strong>
          {team.city ? <small>{team.city}</small> : null}
        </p>
      </header>
      {players.length ? (
        <div className="publicRosterGroups">
          {groups.map((group) => (
            <section className="publicRosterGroup" key={group.label}>
              <h3>{group.label}</h3>
              <div className="publicRosterGrid">
                {group.players.map((player) => (
                  <MatchPlayerLink className="publicRosterPlayer" slug={player.slug} key={player.id}>
                    <i>
                      <PublicImage width={240} height={320} sizes="240px" src={player.photoUrl || "/images/player-placeholder.svg"} alt="" />
                    </i>
                    <span>
                      <strong>{player.name}</strong>
                      <small className="publicRosterMeta">
                        <b>№{player.number}</b>
                        <span>Рейтинг: <b>{player.qualification}</b></span>
                      </small>
                    </span>
                  </MatchPlayerLink>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p>Состав на матч пока не отмечен.</p>
      )}
      {ratingCounts.size > 0 && <p className="matchRosterRatingSummary">Количество полевых игроков с рейтингами: {ratingSummary}.</p>}
    </section>
  );
}

function MatchStatistics({
  team,
  players,
}: {
  team: { name: string; logoUrl: string | null };
  players: Awaited<ReturnType<typeof getPublicMatch>> extends infer M
    ? M extends { playerStats: { home: infer R } }
      ? R
      : never
    : never;
}) {
  return (
    <section className="matchPlayerStats">
      <header>
        <i>{team.logoUrl ? <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" /> : team.name.slice(0, 1)}</i>
        <h2>{team.name}</h2>
      </header>
      <MatchStatScroller>
        <div className="matchPlayerStatsTable">
          <div className="matchPlayerStatsHead">
            <span>Игрок</span><b>Г</b><b>П</b><b>О</b><b>Штр</b>
          </div>
          {players.map((player) => (
            <MatchPlayerLink className="matchPlayerStatRow" slug={player.slug} key={player.id}>
              <span>
                <i><PublicImage width={240} height={320} sizes="240px" src={player.photoUrl || "/images/player-placeholder.svg"} alt="" /></i>
                <em>№{player.number}</em>
                <strong>{player.name}</strong>
              </span>
              <b>{player.goals}</b>
              <b>{player.assists}</b>
              <b>{player.points}</b>
              <b>{player.penaltyMinutes}</b>
            </MatchPlayerLink>
          ))}
        </div>
      </MatchStatScroller>
    </section>
  );
}

function MatchGoalieStatistics({
  players,
}: {
  players: Awaited<ReturnType<typeof getPublicMatch>> extends infer M
    ? M extends { goalieStats: { home: infer R } }
      ? R
      : never
    : never;
}) {
  if (!players.length) return null;
  return (
    <section className="matchGoalieStats">
      <h2>Вратари</h2>
      <MatchStatScroller>
        <div className="matchGoalieStatsTable">
          <div className="matchGoalieStatsHead">
            <span>Вратарь</span><b>Время</b><b>Бр</b><b>ПШ</b><b>Сэйвы</b><b>%ОБ</b>
          </div>
          {players.map((player) => {
            const content = (
              <>
                <span>
                  <i><PublicImage width={240} height={320} sizes="240px" src={player.photoUrl || "/images/player-placeholder.svg"} alt="" /></i>
                  <strong>{player.name}</strong>
                </span>
                <b>{player.timePlayed}</b>
                <b>{player.shotsAgainst ?? "—"}</b>
                <b>{player.goalsAgainst ?? "—"}</b>
                <b>{player.saves ?? "—"}</b>
                <b>{player.savePercentage}</b>
              </>
            );
            return <MatchPlayerLink className="matchGoalieStatRow" slug={player.slug} key={player.id}>{content}</MatchPlayerLink>;
          })}
        </div>
      </MatchStatScroller>
    </section>
  );
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; team?: string; from?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const returnTo = safeReturn(query.from ?? null);
  const returnQuery = returnTo ? `&from=${encodeURIComponent(returnTo)}` : "";
  const match = await getPublicMatch(slug);
  if (!match) notFound();
  const view = ["timeline", "rosters", "statistics"].includes(query.view || "")
    ? query.view!
    : "timeline";
  const statsTeam = query.team === "away" ? "away" : "home";
  const finished = match.status === "FINAL";
  const live = match.status === "LIVE";
  const technical = finished && match.resultType === "TECHNICAL";
  const when = formatDate(match.startsAt);
  const venue = match.venue
    ? [match.venue.name, match.venue.city].filter(Boolean).join(" · ")
    : "Место не указано";
  const shotTotals = match.shots.reduce(
    (total, period) => ({
      home: total.home + period.home,
      away: total.away + period.away,
    }),
    { home: 0, away: 0 },
  );
  const eventLabel = (type: string) =>
    ({
      goal: "ГОЛ",
      penalty: "ШТРАФ",
      "penalty-shot": "ШТРАФНОЙ БРОСОК",
      shootout: "БУЛЛИТ",
      timeout: "ТАЙМ-АУТ",
      "goalie-change": "СМЕНА ВРАТАРЯ",
    })[type] || "СОБЫТИЕ";
  const eventSeconds = (minute: string | null) => {
    if (!minute || minute.startsWith("Б")) return 100000;
    const [minutes, seconds] = minute.split(":").map(Number);
    return (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  };
  const eventPeriod = (minute: string | null) => {
    if (minute?.startsWith("Б")) return 4;
    const seconds = eventSeconds(minute);
    return seconds < 1200 ? 1 : seconds < 2400 ? 2 : 3;
  };
  const timelineSource = [
    ...match.events,
    ...match.timeouts.map((row, index) => ({
      id: `timeout-${index}`,
      minute: row.time,
      type: "timeout",
      teamName: row.teamName,
      playerName: null,
      detail: "Командный тайм-аут",
    })),
    ...match.goalieStints
      .filter((row) => row.from !== "00:00")
      .map((row, index) => ({
        id: `goalie-${index}`,
        minute: row.from,
        type: "goalie-change",
        teamName: row.teamName,
        playerName: row.playerName,
        detail: `Вышел в ворота · до ${row.to}`,
      })),
  ].sort(
    (a, b) =>
      eventPeriod(a.minute) - eventPeriod(b.minute) ||
      eventSeconds(a.minute) - eventSeconds(b.minute),
  );
  let runningHome = 0;
  let runningAway = 0;
  const timelineEvents = timelineSource.map((event) => {
    if (event.type === "goal") {
      if (event.teamName === match.home.name) runningHome += 1;
      if (event.teamName === match.away.name) runningAway += 1;
    }
    return { ...event, runningHome, runningAway };
  });
  const playerVisual = (name: string | null) =>
    [...match.rosters.home, ...match.rosters.away].find(
      (player) => player.name === name,
    );
  const renderEventDetail = (detail: string | null) => {
    if (!detail) return null;
    const marker = "Передачи:";
    const markerIndex = detail.indexOf(marker);
    if (markerIndex < 0) return detail;

    const prefix = detail.slice(0, markerIndex + marker.length);
    const remainder = detail.slice(markerIndex + marker.length).trim();
    const dividerIndex = remainder.indexOf(" · ");
    const namesText = dividerIndex >= 0 ? remainder.slice(0, dividerIndex) : remainder;
    const suffix = dividerIndex >= 0 ? remainder.slice(dividerIndex) : "";
    const names = namesText.split(",").map((name) => name.trim()).filter(Boolean);

    return (
      <>
        {prefix}{" "}
        {names.map((name, index) => {
          const assistant = playerVisual(name);
          return (
            <Fragment key={`${name}-${index}`}>
              {index > 0 ? ", " : null}
              {assistant?.slug ? <Link href={`/player/${assistant.slug}`}>{name}</Link> : name}
            </Fragment>
          );
        })}
        {suffix}
      </>
    );
  };
  const periodLabels: Record<number, string> = {
    1: "1 ПЕРИОД",
    2: "2 ПЕРИОД",
    3: "3 ПЕРИОД",
    4: "СЕРИЯ БУЛЛИТОВ",
  };
  return (
    <main className="matchPublic">
      <LiveMatchRefresh enabled={live} />
      <PublicSiteHeader />
      <h1 className="srOnly">{match.home.name} — {match.away.name}</h1>
      <section
        className={`matchHero ${live ? "isLive" : ""} ${match.isPlayoff ? "isPlayoff" : ""}`}
      >
        <div className="matchHeroTop">
          <PublicReturnLink fallback={match.backHref}>← К календарю дивизиона</PublicReturnLink>
          <span>
            {match.season} · {match.competition.toLocaleUpperCase("ru")} ·{" "}
            {match.division.toLocaleUpperCase("ru")}
            {match.isPlayoff ? " · ПЛЕЙ-ОФФ" : ""}
          </span>
          <time>
            {when.date} · {when.time}
          </time>
        </div>
        <div className="matchHeroBoard">
          <div className="matchHeroTeam home">
            <MatchTeam team={match.home} />
          </div>
          <div className="matchHeroResult">
            <em className={live ? "live" : ""}>
              {live
                ? "● ЛАЙВ"
                : finished
                  ? "МАТЧ ЗАВЕРШЁН"
                  : "ПРЕДСТОЯЩИЙ МАТЧ"}
            </em>
            <strong>
              {finished || live ? (
                <>
                  <b>{technical ? (match.technicalWinner === "home" ? "+" : "−") : match.score.home}</b>
                  <i>—</i>
                  <b>{technical ? (match.technicalWinner === "away" ? "+" : "−") : match.score.away}</b>
                </>
              ) : (
                <>
                  <b>{when.time}</b>
                </>
              )}
            </strong>
            {(finished || live) && (
              <div className="matchHeroStats">
                {technical ? <small>Технический результат</small> : match.periodScores && <small>{match.periodScores}</small>}
                {match.shots.length > 0 && (
                  <span>
                    Броски в створ <b>{shotTotals.home}</b> — <b>{shotTotals.away}</b>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="matchHeroTeam away">
            <MatchTeam team={match.away} />
          </div>
        </div>
        <div className="matchHeroVenue">
          <span><UiIcon name="pin" /></span>
          {match.venue ? <Link href={`/venues/${match.venue.slug}`}>
            <b>{venue}</b>
            {match.venue?.address && <small>{match.venue.address}</small>}
          </Link> : <p><b>{venue}</b></p>}
        </div>
      </section>
      <nav className="matchSectionTabs" aria-label="Разделы матча">
        <Link scroll={false} aria-current={view === "timeline" ? "page" : undefined} className={view === "timeline" ? "active" : ""} href={`/match/${slug}?view=timeline${returnQuery}`}>
          Хронология
        </Link>
        <Link scroll={false} aria-current={view === "rosters" ? "page" : undefined} className={view === "rosters" ? "active" : ""} href={`/match/${slug}?view=rosters${returnQuery}`}>
          Составы
        </Link>
        <Link scroll={false} aria-current={view === "statistics" ? "page" : undefined} className={view === "statistics" ? "active" : ""} href={`/match/${slug}?view=statistics${returnQuery}`}>
          Статистика
        </Link>
      </nav>
      {view === "timeline" ? <section className="matchContent matchContentSingle">
        <article>
          <header>
            <span>СОБЫТИЯ МАТЧА</span>
            <h2>Хронология</h2>
          </header>
          {timelineEvents.length > 0 ? (
            <div className="matchTimeline">
              {[1, 2, 3, 4].map((period) => {
                const periodEvents = timelineEvents.filter(
                  (event) => eventPeriod(event.minute) === period,
                );
                if (!periodEvents.length) return null;
                return (
                  <section className="matchTimelinePeriod" key={period}>
                    <h3><span>{periodLabels[period]}</span></h3>
                    {periodEvents.map((event) => {
                      const home = event.teamName === match.home.name;
                      const player = playerVisual(event.playerName);
                      return (
                        <article
                          className={`${home ? "home" : "away"} ${event.type}`}
                          key={event.id}
                        >
                          <time>{event.minute || "—"}</time>
                          <div className="matchTimelineInfo">
                            <i><PublicImage width={240} height={320} sizes="240px" src={player?.photoUrl || "/images/player-placeholder.svg"} alt="" /></i>
                            <p>
                              <b>
                                {player?.slug ? (
                                  <Link href={`/player/${player.slug}`}>
                                    {event.playerName}
                                  </Link>
                                ) : (
                                  event.playerName || eventLabel(event.type)
                                )}
                                {player?.number ? <small>№{player.number}</small> : null}
                              </b>
                              <span>
                                {event.detail ? renderEventDetail(event.detail) : event.teamName}
                              </span>
                            </p>
                          </div>
                          {event.type === "goal" ? (
                            <strong className="matchTimelineScore">
                              {event.runningHome}—{event.runningAway}
                            </strong>
                          ) : null}
                          <em className={`matchTimelineEvent matchTimelineEvent-${event.type}`}>
                            {eventLabel(event.type)}
                          </em>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="matchEmpty">
              {technical
                ? "Матч завершён техническим результатом. Шайбы и личная статистика не учитываются."
                : finished
                ? "Подробный протокол этого матча в старой базе отсутствует."
                : "Протокол и составы появятся после проведения матча."}
            </p>
          )}
        </article>
      </section> : null}
      {view === "rosters" ? <section className="publicRosters publicRostersTab">
        <div>
          <Roster team={match.home} players={match.rosters.home} />
          <Roster team={match.away} players={match.rosters.away} />
        </div>
      </section> : null}
      {view === "statistics" ? (
        <section className="matchStatisticsPage">
          <nav className="matchTeamTabs" aria-label="Команда">
            <Link
              scroll={false}
              className={statsTeam === "home" ? "active" : ""}
              href={`/match/${slug}?view=statistics&team=home${returnQuery}`}
            >
              {match.home.logoUrl ? <PublicImage width={160} height={160} sizes="160px" src={match.home.logoUrl} alt="" /> : null}
              {match.home.name}
            </Link>
            <Link
              scroll={false}
              className={statsTeam === "away" ? "active" : ""}
              href={`/match/${slug}?view=statistics&team=away${returnQuery}`}
            >
              {match.away.logoUrl ? <PublicImage width={160} height={160} sizes="160px" src={match.away.logoUrl} alt="" /> : null}
              {match.away.name}
            </Link>
          </nav>
          <MatchStatistics
            team={statsTeam === "home" ? match.home : match.away}
            players={statsTeam === "home" ? match.playerStats.home : match.playerStats.away}
          />
          <MatchGoalieStatistics
            players={statsTeam === "home" ? match.goalieStats.home : match.goalieStats.away}
          />
        </section>
      ) : null}
    </main>
  );
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('match',decodeURIComponent((await params).slug),await searchParams);}
