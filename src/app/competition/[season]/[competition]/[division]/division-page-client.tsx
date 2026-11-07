"use client";

import { UiIcon } from "@/components/ui-icon";
import { PlayoffBracket } from '@/components/playoff-bracket';
import { StatisticsOverview } from "@/components/statistics-overview";
import { statisticsCategories, isDefender } from "@/lib/statistics-categories";
import { CalendarMatchCard } from "@/components/calendar-match-card";
import calendarStyles from "@/components/calendar-match-card.module.css";

import { PublicImage } from "@/components/public-image";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { usePublicChoice, usePublicPage, usePublicLocation, handleTabKeys } from "@/components/use-public-url-state";
import { withPublicQuery, withReturn } from "@/lib/public-navigation";
import { PublicSiteHeader } from "@/components/public-site-header";
import { LiveMatchRefresh } from "@/components/live-match-refresh";
import type { DivisionPageData } from "@/lib/division-page";

type Tab = "table" | "calendar" | "statistics";
type Stage = "regular" | "playoff";
type StatView = "skaters" | "goalkeepers";
type StatSort =
  | "games"
  | "goals"
  | "assists"
  | "penalty"
  | "points"
  | "goalieGames"
  | "goalieMinutes"
  | "shotsAgainst"
  | "goalieGoalsAgainst"
  | "saves"
  | "savePercentage"
  | "goalsAgainstAverage";

const FALLBACK_PHOTO = "/images/player-placeholder.svg";

function pluralTeams(value: number) {
  if (value % 10 === 1 && value % 100 !== 11) return "команда";
  if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100))
    return "команды";
  return "команд";
}

export function DivisionPageClient({ data }: { data: DivisionPageData }) {
  const router = useRouter();
  const location = usePublicLocation();
  const [tab, setTab] = usePublicChoice<Tab>("tab", "table", ["table", "calendar", "statistics"]);
  const [categoryId, setCategoryId] = usePublicChoice("category", "all", ["all", ...statisticsCategories.map(item => item.id)]);
  const category = statisticsCategories.find(item => item.id === categoryId);
  const legacyList = /[?&](sort|view)=/.test(location);
  const [statsScreen, setStatsScreen] = usePublicChoice("stats", legacyList ? "list" : "overview", ["list", "overview"]);
  const [stage, setStage] = usePublicChoice<Stage>("stage", "regular", ["regular", "playoff"]);
  const [statView, setStatView] = usePublicChoice<StatView>("view", "skaters", ["skaters", "goalkeepers"]);
  const [statSort, setStatSort] = usePublicChoice<StatSort>("sort", statView === "goalkeepers" ? "savePercentage" : "points", statView === "goalkeepers"
    ? ["goalieGames", "goalieMinutes", "shotsAgainst", "goalieGoalsAgainst", "saves", "savePercentage", "goalsAgainstAverage"]
    : ["games", "goals", "assists", "penalty", "points"]);
  const statsViewport = useRef<HTMLDivElement>(null);
  const sameSeason = data.choices.filter(
    (choice) => choice.seasonSlug === data.season.slug,
  );
  const competitions = sameSeason.filter(
    (choice, index, items) =>
      items.findIndex(
        (other) => other.competitionPath === choice.competitionPath,
      ) === index,
  );
  const divisions = sameSeason.filter(
    (choice) => choice.competitionPath === data.competition.path,
  );
  const seasons = data.choices.filter(
    (choice, index, items) =>
      items.findIndex((other) => other.seasonSlug === choice.seasonSlug) ===
      index,
  );
  const filteredMatches = data.matches.filter((match) =>
    stage === "regular"
      ? match.stageType === "GROUP_STAGE"
      : match.stageType !== "GROUP_STAGE",
  );
  const calendarPageSize = 12;
  const calendarPages = Math.max(
    1,
    Math.ceil(filteredMatches.length / calendarPageSize),
  );
  const [calendarPage, setCalendarPage] = usePublicPage("page", calendarPages);
  const matches = filteredMatches.slice(
    (calendarPage - 1) * calendarPageSize,
    calendarPage * calendarPageSize,
  );
  const sortedStatistics = useMemo(() => {
    const statistics = data.statistics.filter((player) =>
      category?.metric === "shutouts" ? false : statView === "goalkeepers" ? player.isGoalkeeper : !player.isGoalkeeper && (category?.group !== "defenders" || isDefender(player.position)),
    );
    const value = (player: (typeof statistics)[number]) =>
      Number(player[statSort] ?? -1);
    return statistics.sort((a, b) => {
      if (a[statSort] === null) return b[statSort] === null ? a.name.localeCompare(b.name, "ru") : 1;
      if (b[statSort] === null) return -1;
      const result =
        statSort === "goalsAgainstAverage"
          ? value(a) - value(b)
          : value(b) - value(a);
      return result || a.name.localeCompare(b.name, "ru");
    });
  }, [data.statistics, statSort, statView, category]);
  const statPageSize = 50;
  const statPages = Math.max(
    1,
    Math.ceil(sortedStatistics.length / statPageSize),
  );
  const [statPage, setStatPage] = usePublicPage("statPage", statPages);
  const visibleStatistics = sortedStatistics.slice(
    (statPage - 1) * statPageSize,
    statPage * statPageSize,
  );

  const changeSeason = (seasonSlug: string) => {
    const destination =
      data.choices.find(
        (choice) =>
          choice.seasonSlug === seasonSlug &&
          choice.competitionType === "CHAMPIONSHIP",
      ) ?? data.choices.find((choice) => choice.seasonSlug === seasonSlug);
    if (destination) router.push(`${destination.href}?tab=${tab}&view=${statView}&sort=${statSort}&stats=${statsScreen}&category=${categoryId}`);
  };
  const changeCompetition = (path: string) => {
    const destination = sameSeason.find(
      (choice) => choice.competitionPath === path,
    );
    if (destination) router.push(`${destination.href}?tab=${tab}&view=${statView}&sort=${statSort}&stats=${statsScreen}&category=${categoryId}`);
  };
  const changeDivision = (path: string) => {
    const destination = divisions.find(
      (choice) => choice.divisionPath === path,
    );
    if (destination) router.push(`${destination.href}?tab=${tab}&view=${statView}&sort=${statSort}&stats=${statsScreen}&category=${categoryId}`);
  };

  return (
    <main className="publicChamp">
      <LiveMatchRefresh enabled={data.matches.some((match) => match.status === "LIVE")} />
      <PublicSiteHeader />
      <section className="champHero">
        <div>
          <span>
            СЕЗОН {data.season.name} ·{" "}
            {data.competition.name.toLocaleUpperCase("ru")}
          </span>
          <h1>{data.division.name.toLocaleUpperCase("ru")}</h1>
          <p>
            {data.competition.type === "CHAMPIONSHIP"
              ? "Регулярный чемпионат"
              : "Турнир"}{" "}
            · {data.teams.length} {pluralTeams(data.teams.length)}
          </p>
        </div>
        <div className="champSelects">
          <label>
            Сезон
            <select
              value={data.season.slug}
              onChange={(event) => changeSeason(event.target.value)}
            >
              {seasons.map((choice) => (
                <option value={choice.seasonSlug} key={choice.seasonSlug}>
                  {choice.seasonName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Соревнование
            <select
              value={data.competition.path}
              onChange={(event) => changeCompetition(event.target.value)}
            >
              {competitions.map((choice) => (
                <option
                  value={choice.competitionPath}
                  key={choice.competitionPath}
                >
                  {choice.competitionName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дивизион
            <select
              value={data.division.path}
              onChange={(event) => changeDivision(event.target.value)}
            >
              {divisions.map((choice) => (
                <option value={choice.divisionPath} key={choice.divisionPath}>
                  {choice.divisionName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="champContent">
        <div className="champTabs" role="tablist" aria-label="Разделы соревнования" onKeyDown={handleTabKeys}>
          <Link
            href={withPublicQuery(location, "tab", "table")}
            prefetch={false}
            className={tab === "table" ? "active" : ""}
            role="tab" aria-selected={tab === "table"}
            onClick={(event) => { event.preventDefault(); setTab("table"); }}
          >
            Таблица
          </Link>
          <Link
            href={withPublicQuery(location, "tab", "calendar")}
            prefetch={false}
            className={tab === "calendar" ? "active" : ""}
            role="tab" aria-selected={tab === "calendar"}
            onClick={(event) => { event.preventDefault(); setTab("calendar"); }}
          >
            Календарь
          </Link>
          <Link
            href={withPublicQuery(location, "tab", "statistics")}
            prefetch={false}
            className={tab === "statistics" ? "active" : ""}
            role="tab" aria-selected={tab === "statistics"}
            onClick={(event) => { event.preventDefault(); setTab("statistics"); setStatsScreen("overview"); setCategoryId("all"); }}
          >
            Статистика игроков
          </Link>
        </div>
        {tab === "table" && <DivisionTable data={data} />}
        {tab === "calendar" && (
          <section className="calendarPanel divisionCalendar">
            <header>
              <div>
                <span>КАЛЕНДАРЬ МАТЧЕЙ</span>
                <h2>
                  {data.division.name} · сезон {data.season.name}
                </h2>
              </div>
              <div className="calendarStages">
                <button
                  className={stage === "regular" ? "active" : ""}
                  aria-pressed={stage === "regular"}
                  onClick={() => {
                    setStage("regular");
                    setCalendarPage(1);
                  }}
                >
                  Групповой этап
                </button>
                <button
                  className={stage === "playoff" ? "active" : ""}
                  aria-pressed={stage === "playoff"}
                  onClick={() => {
                    setStage("playoff");
                    setCalendarPage(1);
                  }}
                >
                  Плей-офф
                </button>
              </div>
            </header>
            {matches.length ? (
              <>
                <div className={calendarStyles.grid}>
                  {matches.map((game) => {
                    const technicalWinner = game.technicalWinnerTeamEntryId === game.homeTeamEntryId
                      ? "home"
                      : game.technicalWinnerTeamEntryId === game.awayTeamEntryId
                        ? "away"
                        : null;
                    return (
                      <CalendarMatchCard
                        key={game.id}
                        match={game}
                        href={withReturn(`/match/${game.slug}`, location)}
                        homeHref={withReturn(`/team/${game.home.slug}?competition=${game.homeTeamEntryId}`, location)}
                        awayHref={withReturn(`/team/${game.away.slug}?competition=${game.awayTeamEntryId}`, location)}
                        technicalWinner={technicalWinner}
                        stageName={game.stageName}
                      />
                    );
                  })}
                </div>
                {calendarPages > 1 && (
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
                    {Array.from({ length: calendarPages }, (_, index) => (
                      <button
                        key={index}
                        className={calendarPage === index + 1 ? "active" : ""}
                        onClick={() => setCalendarPage(index + 1)}
                      >
                        {index + 1}
                      </button>
                    ))}
                    <button
                      disabled={calendarPage === calendarPages}
                      onClick={() => setCalendarPage((page) => page + 1)}
                    >
                      Далее <UiIcon name="arrow-right" />
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="calendarEmpty">
                <b>МАТЧЕЙ НА ЭТОЙ СТАДИИ НЕТ</b>
                <p>
                  Когда матчи будут добавлены, они автоматически появятся здесь.
                </p>
              </div>
            )}
          </section>
        )}
        {tab === "statistics" && statsScreen === "overview" && <StatisticsOverview players={data.statistics} />}
        {tab === "statistics" && statsScreen === "list" && (
          <section className="calendarPanel divisionStatistics">
            <div className="statisticsMode" style={{ padding: "16px 24px" }}><button onClick={() => { setStatsScreen("overview"); setCategoryId("all"); }}><UiIcon name="arrow-left" /> Все категории статистики</button></div>
            <header>
              <div>
                <span>СТАТИСТИКА ИГРОКОВ</span>
                <h2>
                  {category?.title || data.division.name} · сезон {data.season.name}
                </h2>
              </div>
              <div className="statisticsMode">
                <button
                  className={statView === "skaters" ? "active" : ""}
                  aria-pressed={statView === "skaters"}
                  onClick={() => {
                    setStatView("skaters");
                    setCategoryId("all");
                    setStatSort("points");
                    setStatPage(1);
                  }}
                >
                  Полевые игроки
                </button>
                <button
                  className={statView === "goalkeepers" ? "active" : ""}
                  aria-pressed={statView === "goalkeepers"}
                  onClick={() => {
                    setStatView("goalkeepers");
                    setCategoryId("all");
                    setStatSort("savePercentage");
                    setStatPage(1);
                  }}
                >
                  Вратари
                </button>
              </div>
            </header>
            <nav className="leagueTableMobileControls" aria-label="Прокрутка статистики игроков">
              <button onClick={() => statsViewport.current?.scrollBy({ left: -260, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })} aria-label="Показать предыдущие показатели"><UiIcon name="arrow-left" /></button>
              <span>Смахивайте таблицу влево и вправо</span>
              <button onClick={() => statsViewport.current?.scrollBy({ left: 260, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })} aria-label="Показать следующие показатели"><UiIcon name="arrow-right" /></button>
            </nav>
            <div className="teamStatisticsTable" ref={statsViewport} tabIndex={0} role="region" aria-label="Статистика игроков">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Игрок</th>
                    <th>Команда</th>
                    {(statView === "skaters"
                      ? [
                        ["games", "Сыграно"],
                        ["goals", "Голы"],
                        ["assists", "Передачи"],
                        ["penalty", "Штраф"],
                        ["points", "Очки"],
                      ]
                      : [
                        ["goalieGames", "Игры"],
                        ["goalieMinutes", "Мин"],
                        ["shotsAgainst", "Броски"],
                        ["goalieGoalsAgainst", "ПШ"],
                        ["saves", "Сэйвы"],
                        ["savePercentage", "%ОБ"],
                        ["goalsAgainstAverage", "КН"],
                      ] as Array<[StatSort, string]>).map(([key, label]) => (
                      <th key={key} aria-sort={statSort === key ? (key === "goalsAgainstAverage" ? "ascending" : "descending") : "none"}>
                        <button
                          className={statSort === key ? "active" : ""}
                          onClick={() => {
                            setStatSort(key as StatSort);
                            setStatPage(1);
                          }}
                        >
                          {label}
                          <UiIcon name={statSort === key ? "arrow-down" : "sort"} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!visibleStatistics.length && <tr><td colSpan={statView === "skaters" ? 8 : 10}>{category?.metric === "shutouts" ? "Данные о сухих матчах пока не ведутся." : "Статистика пока не заполнена."}</td></tr>}
                  {visibleStatistics.map((player, index) => (
                    <tr key={player.key}>
                      <td>{(statPage - 1) * statPageSize + index + 1}</td>
                      <td>
                        <Link href={withReturn(`/player/${player.slug}`, location)}>
                          <PublicImage width={240} height={320} sizes="240px" src={player.photoUrl || FALLBACK_PHOTO} alt="" />
                          <strong>
                            {player.name}
                            <small>{player.position}</small>
                          </strong>
                        </Link>
                      </td>
                      <td>
                        <Link
                          className="divisionStatTeam"
                          href={withReturn(`/team/${player.teamSlug}?competition=${data.teams.find(team => team.slug === player.teamSlug)?.id ?? ""}&tab=statistics`, location)}
                        >
                          {player.teamName}
                        </Link>
                      </td>
                      {statView === "skaters" ? <>
                        <td>{player.games}</td>
                        <td>{player.goals}</td>
                        <td>{player.assists}</td>
                        <td>{player.penalty}</td>
                        <td className="statPoints">{player.points}</td>
                      </> : <>
                        <td>{player.goalieGames || "—"}</td>
                        <td>{player.goalieGames ? player.goalieMinutes : "—"}</td>
                        <td>{player.goalieGames ? player.shotsAgainst : "—"}</td>
                        <td>{player.goalieGames ? player.goalieGoalsAgainst : "—"}</td>
                        <td>{player.goalieGames ? player.saves : "—"}</td>
                        <td className="statPoints">
                          {player.savePercentage === null ? "—" : `${player.savePercentage.toFixed(1)}%`}
                        </td>
                        <td>{player.goalsAgainstAverage === null ? "—" : player.goalsAgainstAverage.toFixed(2)}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statPages > 1 && (
              <nav
                className="calendarPagination statisticsPagination"
                aria-label="Страницы статистики"
              >
                <button
                  disabled={statPage === 1}
                  onClick={() => setStatPage((page) => page - 1)}
                >
                  <UiIcon name="arrow-left" /> Назад
                </button>
                {Array.from({ length: statPages }, (_, index) => (
                  <button
                    key={index}
                    className={statPage === index + 1 ? "active" : ""}
                    onClick={() => setStatPage(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  disabled={statPage === statPages}
                  onClick={() => setStatPage((page) => page + 1)}
                >
                  Далее <UiIcon name="arrow-right" />
                </button>
              </nav>
            )}
            <p className="teamStatsNote">
              Нажмите на название показателя, чтобы изменить ранжирование. КН —
              среднее количество пропущенных шайб за 60 минут.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function DivisionTable({ data }: { data: DivisionPageData }) {
  const location = usePublicLocation();
  const tableViewport = useRef<HTMLDivElement>(null);
  const moveTable = (direction: number) =>
    tableViewport.current?.scrollBy({
      left: direction * Math.max(tableViewport.current.clientWidth * 0.72, 240),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });

  return (
    <>
      <div className="leagueTableMobileShell">
        <nav className="leagueTableMobileControls" aria-label="Прокрутка турнирной таблицы">
          <button onClick={() => moveTable(-1)} aria-label="Показать предыдущие столбцы"><UiIcon name="arrow-left" /></button>
          <span>Смахивайте таблицу влево и вправо</span>
          <button onClick={() => moveTable(1)} aria-label="Показать следующие столбцы"><UiIcon name="arrow-right" /></button>
        </nav>
        <div className="leagueTableViewport" ref={tableViewport} tabIndex={0} role="region" aria-label="Турнирная таблица">
          <section className="leagueTable">
        <div className="leagueTableHead">
          <span>#</span>
          <span>Команда</span>
          <span>И</span>
          <span>В</span>
          <span>Н</span>
          <span>П</span>
          <span>Ш</span>
          <span>О</span>
          <span>Последние игры</span>
        </div>
        {data.teams.map((team, index) => (
          <div className="leagueTableRow" key={team.id}>
            <b>{team.rank}</b>
            <Link className="standingTeamLink" href={withReturn(`/team/${team.slug}?competition=${team.id}`, location)}>
              <i className={`teamCrest c${index}`}>
                {team.logoUrl ? (
                  <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" />
                ) : (
                  team.name.slice(0, 1)
                )}
              </i>
              {team.name}
            </Link>
            <span>{team.games}</span>
            <span>{team.wins}</span>
            <span>{team.draws}</span>
            <span>{team.losses}</span>
            <span>
              {team.goalsFor}–{team.goalsAgainst}
            </span>
            <em>{team.points}</em>
            <div className="form">
              {team.form.map((item, formIndex) => (
                <Link
                  href={withReturn(`/match/${item.matchSlug}`, location)}
                  className={item.result}
                  aria-label={`Матч ${formIndex + 1}`}
                  key={`${item.matchSlug}-${formIndex}`}
                >
                  {item.result === "w" ? "В" : item.result === "l" ? "П" : "Н"}
                </Link>
              ))}
            </div>
          </div>
        ))}
          </section>
        </div>
      </div>
      {data.playoffs.map(playoff=><PlayoffBracket key={playoff.id} playoff={playoff}/>)}
    </>
  );
}
