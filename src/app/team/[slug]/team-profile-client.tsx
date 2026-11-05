"use client";
import {localMediaUrl} from '@/lib/local-media';
import {safeHref} from '@/lib/editorial-url';

import { PublicImage } from "@/components/public-image";
import { RosterSurname } from "@/components/roster-surname";
import { RosterAverageAge } from "@/components/roster-average-age";
import { UiIcon } from "@/components/ui-icon";


import Link from "next/link";
import { useMemo } from "react";
import { usePublicChoice, usePublicPage, usePublicLocation, handleTabKeys } from "@/components/use-public-url-state";
import { PublicReturnLink } from "@/components/public-return-link";
import { withPublicQuery, withReturn } from "@/lib/public-navigation";
import { PublicSiteHeader } from "@/components/public-site-header";
import { LiveMatchRefresh } from "@/components/live-match-refresh";
import type {
  TeamProfileData,
  TeamProfileMatchTeam,
  TeamProfilePlayer,
} from "@/lib/team-profile";

type TeamTab = "about" | "roster" | "calendar" | "statistics";
type RosterFilter =
  | "Все"
  | "Вратари"
  | "Защитники"
  | "Нападающие"
  | "Дисквалифицированные";
type StatSort = "games" | "goals" | "assists" | "penalty" | "points";

const FALLBACK_PHOTO = "/images/player-placeholder.svg";
const tabs: Array<[TeamTab, string]> = [
  ["about", "О команде"],
  ["roster", "Состав"],
  ["calendar", "Календарь"],
  ["statistics", "Статистика игроков"],
];

function pluralMatches(value: number) {
  if (value % 10 === 1 && value % 100 !== 11) return "матч";
  if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100))
    return "матча";
  return "матчей";
}

function isPosition(player: TeamProfilePlayer, needle: string) {
  return player.position.toLocaleLowerCase("ru").includes(needle);
}

function formatMatchDate(value: string | null) {
  if (!value) return { date: "Дата уточняется", time: "—" };
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

function MatchTeam({ team }: { team: TeamProfileMatchTeam }) {
  return (
    <Link className="teamMatchSide" href={`/team/${team.slug}`}>
      <i className={team.logoUrl ? "tankiMark" : "opponentMark"}>
        {team.logoUrl ? (
          <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" />
        ) : (
          team.name.slice(0, 1)
        )}
      </i>
      <strong>{team.name}</strong>
      <small>{team.city || ""}</small>
    </Link>
  );
}

export function TeamProfileClient({ team }: { team: TeamProfileData }) {
  const location = usePublicLocation();
  const [competitionId, setCompetitionId] = usePublicChoice("competition", team.competitions[0]?.id ?? "", team.competitions.map(item => item.id));
  const [tab, setTab] = usePublicChoice<TeamTab>("tab", "about", ["about", "roster", "calendar", "statistics"]);
  const [rosterFilter, setRosterFilter] = usePublicChoice<RosterFilter>("position", "Все", ["Все", "Вратари", "Защитники", "Нападающие", "Дисквалифицированные"]);
  const [statSort, setStatSort] = usePublicChoice<StatSort>("sort", "points", ["games", "goals", "assists", "penalty", "points"]);
  const selected =
    team.competitions.find((item) => item.id === competitionId) ??
    team.competitions[0];
  const calendarPageSize = 12;
  const calendarTotalPages = Math.max(
    1,
    Math.ceil((selected?.matches.length ?? 0) / calendarPageSize),
  );
  const [calendarPage, setCalendarPage] = usePublicPage("page", calendarTotalPages);
  const visibleGames =
    selected?.matches.slice(
      (calendarPage - 1) * calendarPageSize,
      calendarPage * calendarPageSize,
    ) ?? [];
  const sortedStatistics = useMemo(
    () =>
      [...(selected?.statistics ?? [])].sort(
        (a, b) =>
          b[statSort] - a[statSort] || a.name.localeCompare(b.name, "ru"),
      ),
    [selected, statSort],
  );
  const description = team.description?.split(/\r?\n+/).filter(Boolean) ?? [];
  const gold = team.achievements.filter((item) =>
    item.medal.includes("🥇"),
  ).length;
  const silver = team.achievements.filter((item) =>
    item.medal.includes("🥈"),
  ).length;
  const bronze = team.achievements.filter((item) =>
    item.medal.includes("🥉"),
  ).length;

  const renderPlayers = (position: "Вратарь" | "Защитник" | "Нападающий") => {
    if (!selected) return null;
    const label =
      position === "Вратарь"
        ? "Вратари"
        : position === "Защитник"
          ? "Защитники"
          : "Нападающие";
    const needle =
      position === "Вратарь"
        ? "врат"
        : position === "Защитник"
          ? "защит"
          : "напад";
    const players = selected.players.filter((player) =>
      rosterFilter === "Дисквалифицированные"
        ? player.suspended && isPosition(player, needle)
        : isPosition(player, needle) &&
          (rosterFilter === "Все" || rosterFilter === label),
    );
    if (!players.length) return null;
    return (
      <section className="rosterPosition" key={position}>
        <h3>{label}</h3>
        <div className="rosterCards">
          {players.map((player) => (
            <Link
              href={withReturn(`/player/${player.slug}`, location)}
              key={player.id}
              className={`rosterCard ${player.suspended ? "rosterCardSuspended" : ""}`}
            >
              <div className="rosterCardPhoto">
                <PublicImage width={240} height={320} sizes="240px"
                  src={player.photoUrl || FALLBACK_PHOTO}
                  alt={`Фотография игрока ${player.lastName} ${player.firstName}`}
                />
                <em>№ {player.number}</em>
                {player.leadership && (
                  <b
                    className="rosterLeadership"
                    aria-label={
                      player.leadership === "К"
                        ? "Капитан"
                        : "Ассистент капитана"
                    }
                  >
                    {player.leadership}
                  </b>
                )}
              </div>
              <div className="rosterCardMain">
                <b className="rosterPlayerName">
                  <RosterSurname>{player.lastName}</RosterSurname>
                  <small>{player.firstName}</small>
                </b>
                <span>
                  Квалификация <strong>{player.qualification}</strong>
                </span>
                <span>
                  Амплуа <strong>{player.position}</strong>
                </span>
                <span>
                  Дата рождения <strong>{player.birthDate}</strong>
                </span>
              </div>
              {player.suspended && player.suspension && <div className="rosterSuspensionInfo"><strong>Дисквалификация</strong><small>{player.suspension.reason}{player.suspension.note ? ` · ${player.suspension.note}` : ""}</small><small>Отсчёт: {player.suspension.sourceTeam} · {player.suspension.sourceDivision}{player.suspension.remaining !== null ? ` · осталось ${player.suspension.remaining} из ${player.suspension.matchesCount} матчей` : ""}</small></div>}
            </Link>
          ))}
        </div>
      </section>
    );
  };

  return (
    <main className="teamPublic teamProfile">
      <LiveMatchRefresh enabled={Boolean(selected?.matches.some((match) => match.status === "LIVE"))} />
      <PublicSiteHeader />
      <section className="teamProfileHead">
        <div className="teamProfileWrap">
          <PublicReturnLink className="teamBack" fallback="/teams">
            ← Все команды
          </PublicReturnLink>
          <div className="teamIdentity">
            <div className="teamIdentityMeta teamIdentityLeft">
              <span>ДОСТИЖЕНИЯ</span>
              <b>
                {team.achievements.length ? (
                  <>
                    {gold} золота · {silver} серебра
                    <br />
                    {bronze} бронза
                  </>
                ) : (
                  "Пока не указаны"
                )}
              </b>
              <small>{team.achievements.length} призовых результатов</small>
            </div>
            <div className="teamIdentityCenter">
              {team.logoUrl && (
                <>
                  <a
                    className="teamLogoLarge"
                    href={localMediaUrl(team.logoUrl)}
                    target="_blank"
                    rel="noreferrer"
                    title="Открыть эмблему в полном размере"
                  >
                    <PublicImage priority width={160} height={160} sizes="160px"
                      src={team.logoUrl}
                      alt={`Эмблема команды ${team.name}`}
                    />
                  </a>
                  <a className="teamLogoDownload" href={localMediaUrl(team.logoUrl)} download>
                    ↓ Скачать логотип
                  </a>
                </>
              )}
              <h1>{team.name}</h1>
              {team.shortDescription && (
                <p className="teamDescription">{team.shortDescription}</p>
              )}
            </div>
            <div className="teamIdentityMeta teamIdentityRight">
              <span>ГОРОД</span>
              <b>{team.city || "Не указан"}</b>
              <nav className="teamSocials" aria-label="Социальные сети команды">
                {team.vkUrl && (
                  <a
                    href={safeHref(team.vkUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="ВКонтакте"
                  >
                    <UiIcon name="vk" />
                  </a>
                )}
                {team.telegramUrl && (
                  <a
                    href={safeHref(team.telegramUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Telegram"
                  >
                    TG
                  </a>
                )}
                {team.websiteUrl && (
                  <a
                    href={safeHref(team.websiteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Сайт команды"
                  >
                    ⌁
                  </a>
                )}
              </nav>
            </div>
          </div>
        </div>
      </section>
      <section className="teamProfileBody">
        <div className="teamProfileWrap">
          <div
            className="teamTabs teamProfileTabs"
            role="tablist"
            onKeyDown={handleTabKeys}
            aria-label="Разделы команды"
          >
            {tabs.map(([value, label]) => (
              <Link
                key={value}
                href={withPublicQuery(location, "tab", value)}
                prefetch={false}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                onClick={(event) => { event.preventDefault(); setTab(value); }}
              >
                {label}
              </Link>
            ))}
          </div>
          {tab === "about" && (
            <>
              {team.teamPhotoUrl && (
                <figure className="teamPhoto">
                  <PublicImage width={1600} height={900} sizes="(max-width: 1180px) 100vw, 1132px" quality={85}
                    src={team.teamPhotoUrl}
                    alt={`Командная фотография ${team.name}`}
                  />
                  <figcaption>
                    {team.name}
                    {team.city ? ` · ${team.city}` : ""}
                  </figcaption>
                </figure>
              )}
              <section className="teamStory">
                <article>
                  <span>О КОМАНДЕ</span>
                  <h2>{team.name}</h2>
                  {description.length ? (
                    description.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))
                  ) : (
                    <p>Описание команды пока не добавлено.</p>
                  )}
                </article>
                <article className="teamAchievements">
                  <span>ДОСТИЖЕНИЯ</span>
                  <h2>История побед</h2>
                  {team.achievements.length ? (
                    <ol>
                      {team.achievements.map((item, index) => (
                        <li key={`${item.year}-${index}`}>
                          <i>{item.medal}</i>
                          <b>{item.year}</b>
                          <p>{item.title}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Достижения команды пока не добавлены.</p>
                  )}
                </article>
              </section>
            </>
          )}
          {tab !== "about" && selected && (
            <>
              <section className="teamCompetition teamCompetitionInTab">
                <label>
                  <span>СОРЕВНОВАНИЕ</span>
                  <select
                    aria-describedby="team-competition-selection"
                    value={selected.id}
                    onChange={(event) => {
                      setCompetitionId(event.target.value);
                      setCalendarPage(1);
                    }}
                  >
                    {team.competitions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <small id="team-competition-selection" className="competitionSelection">{selected.label}</small>
                </label>
              </section>
              <section
                className={`teamTabPanel ${tab === "roster" ? "rosterPanel" : ""}`}
              >
                {tab === "roster" && (
                  <div className="teamRosterContent">
                    <section className="teamCoach">
                      <span>ЗАЯВКА КОМАНДЫ НА СОРЕВНОВАНИЕ</span>
                      <Link
                        className="printRosterButton"
                        href={`/team/${team.slug}/print?competition=${selected.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <UiIcon name="print" /> Печатать состав
                      </Link>
                    </section>
                    <RosterAverageAge players={selected.players} />
                    <nav className="rosterFilters" aria-label="Фильтр состава">
                      {(
                        [
                          "Все",
                          "Вратари",
                          "Защитники",
                          "Нападающие",
                          "Дисквалифицированные",
                        ] as RosterFilter[]
                      ).map((item) => (
                        <button
                          key={item}
                          className={rosterFilter === item ? "active" : ""}
                          aria-pressed={rosterFilter === item}
                          onClick={() => setRosterFilter(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </nav>
                    {renderPlayers("Вратарь")}
                    {renderPlayers("Защитник")}
                    {renderPlayers("Нападающий")}
                    {rosterFilter === "Дисквалифицированные" &&
                      !selected.players.some((player) => player.suspended) && (
                        <p className="rosterNoResults">
                          В выбранном соревновании дисквалифицированных игроков
                          нет.
                        </p>
                      )}
                  </div>
                )}
                {tab === "calendar" && (
                  <>
                    <header>
                      <div>
                        <span>КАЛЕНДАРЬ</span>
                        <h2>Матчи команды</h2>
                      </div>
                      <b>
                        {selected.matches.length}{" "}
                        {pluralMatches(selected.matches.length)}
                      </b>
                    </header>
                    <div className="teamSchedule">
                      {visibleGames.map((game, index) => {
                        const when = formatMatchDate(game.startsAt);
                        const isFinal = game.status === "FINAL",
                          live = game.status === "LIVE",
                          technical = isFinal && game.technicalWinner !== null;
                        return (
                          <article
                            className={`teamMatchCard ${live ? "isLive" : ""} ${game.isPlayoff ? "playoffMatch" : ""}`}
                            key={game.id}
                          >
                            <MatchTeam team={game.home} />
                            <Link
                              className="teamMatchCenter"
                              href={withReturn(`/match/${game.slug}`, location)}
                            >
                              <span>
                                #
                                {(calendarPage - 1) * calendarPageSize +
                                  index +
                                  1}
                              </span>
                              <b
                                className={
                                  isFinal || live
                                    ? "finishedScore"
                                    : "futureTime"
                                }
                              >
                                {technical
                                  ? `${game.technicalWinner === "home" ? "+" : "−"} — ${game.technicalWinner === "away" ? "+" : "−"}`
                                  : isFinal || live
                                  ? `${game.homeScore} — ${game.awayScore}`
                                  : when.time}
                              </b>
                              <small>
                                {live
                                  ? "Счёт обновляется онлайн"
                                  : isFinal
                                    ? technical
                                      ? "Технический результат"
                                      : game.periodScores || "Матч завершён"
                                    : "Начало матча"}
                              </small>
                              <time>
                                {when.date} ·{" "}
                                {isFinal || live
                                  ? when.time
                                  : game.venue || "Место уточняется"}
                              </time>
                              <em className={live ? "live" : ""}>
                                {live
                                  ? "● ЛАЙВ"
                                  : isFinal
                                    ? game.isPlayoff
                                      ? "Плей-офф · завершён"
                                      : "Завершён"
                                    : game.isPlayoff
                                      ? "Плей-офф"
                                      : "Предстоящий матч"}
                              </em>
                            </Link>
                            <MatchTeam team={game.away} />
                          </article>
                        );
                      })}
                    </div>
                    {calendarTotalPages > 1 && (
                      <nav
                        className="calendarPagination"
                        aria-label="Страницы календаря"
                      >
                        <button
                          disabled={calendarPage === 1}
                          onClick={() => setCalendarPage((page) => page - 1)}
                        >
                          <UiIcon name="arrow-left" /> Назад
                        </button>
                        {Array.from(
                          { length: calendarTotalPages },
                          (_, index) => (
                            <button
                              key={index}
                              className={
                                calendarPage === index + 1 ? "active" : ""
                              }
                              onClick={() => setCalendarPage(index + 1)}
                            >
                              {index + 1}
                            </button>
                          ),
                        )}
                        <button
                          disabled={calendarPage === calendarTotalPages}
                          onClick={() => setCalendarPage((page) => page + 1)}
                        >
                          Далее <UiIcon name="arrow-right" />
                        </button>
                      </nav>
                    )}
                  </>
                )}
                {tab === "statistics" && (
                  <>
                    <p className="tableScrollHint">Смахивайте таблицу влево и вправо, чтобы увидеть все показатели.</p>
                    <div className="teamStatisticsTable" tabIndex={0} role="region" aria-label="Статистика игроков команды">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Игрок</th>
                            {(
                              [
                                ["games", "Сыграно"],
                                ["goals", "Голы"],
                                ["assists", "Передачи"],
                                ["penalty", "Штраф"],
                                ["points", "Очки"],
                              ] as const
                            ).map(([key, label]) => (
                              <th key={key} aria-sort={statSort === key ? "descending" : "none"}>
                                <button
                                  className={statSort === key ? "active" : ""}
                                  onClick={() => setStatSort(key)}
                                >
                                  {label}
                                  <UiIcon name={statSort === key ? "arrow-down" : "sort"} />
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStatistics.map((player, index) => (
                            <tr key={player.playerId}>
                              <td>{index + 1}</td>
                              <td>
                                <Link href={withReturn(`/player/${player.slug}`, location)}>
                                  <PublicImage width={240} height={320} sizes="240px"
                                    src={player.photoUrl || FALLBACK_PHOTO}
                                    alt=""
                                  />
                                  <strong>
                                    {player.name}
                                    <small>{player.position}</small>
                                  </strong>
                                </Link>
                              </td>
                              <td>{player.games}</td>
                              <td>{player.goals}</td>
                              <td>{player.assists}</td>
                              <td>{player.penalty}</td>
                              <td className="statPoints">{player.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="teamStatsNote">
                      Нажмите на название показателя, чтобы изменить
                      ранжирование игроков.
                    </p>
                  </>
                )}
              </section>
            </>
          )}
          {tab !== "about" && !selected && (
            <p className="rosterNoResults">
              Команда пока не заявлена ни в одно соревнование.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
