import { PublicImage } from "@/components/public-image";
import { PlayerPhotoViewer } from "./player-photo-viewer";
import Link from "next/link";
import { PublicReturnLink } from "@/components/public-return-link";
import { notFound } from "next/navigation";
import { PublicSiteHeader } from "@/components/public-site-header";
import { getPlayerPage, type PlayerHistoryRow } from "@/lib/player-page";

function formatBirthDate(value: string | null) {
  if (!value) return "Не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

function PlayerHistorySection({
  title,
  rows,
  emptyMessage,
  isGoalkeeper,
  hasGoalkeeperStats,
}: {
  title: string;
  rows: PlayerHistoryRow[];
  emptyMessage: string;
  isGoalkeeper: boolean;
  hasGoalkeeperStats: boolean;
}) {
  return (
    <section className="playerHistoryBlock" tabIndex={0} role="region" aria-label={title}>
      <div className="playerHistoryTitle">
        <h2>{title}</h2>
      </div>
      {rows.length ? (
        <div className={`playerHistory${isGoalkeeper && !hasGoalkeeperStats ? " goalkeeper" : hasGoalkeeperStats ? " goalkeeperDetailed" : ""}`}>
          <div>
            <span>СЕЗОН</span><span>КОМАНДА · СОРЕВНОВАНИЕ</span>
            <span>И</span>
            {hasGoalkeeperStats && <><span>МИН</span><span>БР</span><span>ПШ</span><span>%ОБ</span><span>КН</span></>}
            {!isGoalkeeper && <><span>Г</span><span>А</span><span>ШТР</span><span>О</span></>}
          </div>
          {rows.map((row) => (
            <Link
              href={`/competition/${row.seasonSlug}/${row.competitionPath}/${row.divisionPath}`}
              key={row.key}
            >
              <b>{row.seasonName}</b>
              <strong className="playerHistoryTeam">
                <i>
                  {row.teamLogoUrl ? (
                    <PublicImage width={160} height={160} sizes="160px" src={row.teamLogoUrl} alt="" />
                  ) : (
                    row.teamName.slice(0, 1)
                  )}
                </i>
                <span>
                  {row.teamName}
                  <small>{row.competitionName} · {row.divisionName}</small>
                </span>
              </strong>
              <span>{row.games}</span>
              {hasGoalkeeperStats && <>
                <span>{row.goalieGames ? Math.floor(row.goalieSeconds / 60) : "—"}</span>
                <span>{row.goalieGames ? row.shotsAgainst : "—"}</span>
                <span>{row.goalieGames ? row.goalieGoalsAgainst : "—"}</span>
                <em>{row.goalieGames ? row.savePercentage : "—"}</em>
                <span>{row.goalieGames ? row.goalsAgainstAverage : "—"}</span>
              </>}
              {!isGoalkeeper && <>
                <span>{row.goals}</span><span>{row.assists}</span>
                <span>{row.penalty}</span><em>{row.points}</em>
              </>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="matchEmpty">{emptyMessage}</p>
      )}
    </section>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPlayerPage(slug);
  if (!data) notFound();
  const { player, current, history, totals, suspensions } = data;
  const isGoalkeeper = player.position.toLocaleLowerCase("ru").includes("вратар");
  const hasGoalkeeperStats = isGoalkeeper && totals.goalieGames > 0;
  const championships = history.filter((row) => row.competitionType === "CHAMPIONSHIP");
  const tournaments = history.filter((row) => row.competitionType === "TOURNAMENT");
  const currentHref = current
    ? `/competition/${current.seasonSlug}/${current.competitionPath}/${current.divisionPath}`
    : "/";

  return (
    <main className="playerPublic">
      <PublicSiteHeader />
      <section className="playerHero">
        <PublicReturnLink fallback={currentHref}>← К соревнованию</PublicReturnLink>
        <div className="playerIdentity">
          <PlayerPhotoViewer photoUrl={player.photoUrl} name={player.name} />
          <div>
            <span>
              {current
                ? `${current.seasonName} · ${current.competitionName} · ${current.teamName}`
                : "ПРОФИЛЬ ИГРОКА"}
            </span>
            <h1>{player.name}</h1>
          </div>
        </div>

        <div className="playerHeroDetails">
          <HeroFact label="Дата рождения" value={formatBirthDate(player.birthDate)} />
          <HeroFact label="Гражданство" value={player.country || "Не указано"} />
          <HeroFact label="Место рождения" value={player.birthPlace || "Не указано"} />
          <HeroFact label="Амплуа" value={player.position} />
          <HeroFact label="Рейтинг" value={player.rating} />
          {player.stickHand && <HeroFact label="Хват" value={player.stickHand} />}
          {player.heightCm && <HeroFact label="Рост" value={`${player.heightCm} см`} />}
          {player.weightKg && <HeroFact label="Вес" value={`${player.weightKg} кг`} />}
        </div>

        {suspensions.length > 0 && <section className="playerSuspensionNotice" aria-label="Действующая дисквалификация">
          <h2>Дисквалификация</h2>
          {suspensions.map((suspension) => <div key={suspension.id}>
            <p>{suspension.reason}</p>
            {suspension.note && <p className="playerSuspensionNote">{suspension.note}</p>}
            <small>Отсчёт: {suspension.sourceTeam} · {suspension.sourceDivision}{suspension.remaining !== null ? ` · осталось ${suspension.remaining} из ${suspension.matchesCount} матчей` : ""}. До окончания дисквалификации игрок не может участвовать в матчах других команд.</small>
          </div>)}
        </section>}

        <div className="playerCareerStats">
          <span>{hasGoalkeeperStats ? "СТАТИСТИКА ВРАТАРЯ В ЛХЛ-76" : isGoalkeeper ? "УЧАСТИЕ В МАТЧАХ ЛХЛ-76" : "ОБЩАЯ СТАТИСТИКА В ЛХЛ-76"}</span>
          <div className={`playerStats${isGoalkeeper && !hasGoalkeeperStats ? " goalkeeper" : ""}`}>
            <article><b>{totals.games}</b><small>игр</small></article>
            {hasGoalkeeperStats && <>
              <article><b>{Math.floor(totals.goalieSeconds / 60)}</b><small>минут</small></article>
              <article><b>{totals.shotsAgainst}</b><small>бросков</small></article>
              <article><b>{totals.goalieGoalsAgainst}</b><small>пропущено</small></article>
              <article><b>{totals.saves}</b><small>сэйвов</small></article>
              <article><b>{totals.savePercentage}</b><small>% отраж.</small></article>
              <article><b>{totals.goalsAgainstAverage}</b><small>КН</small></article>
            </>}
            {!isGoalkeeper && <>
              <article><b>{totals.goals}</b><small>голов</small></article>
              <article><b>{totals.assists}</b><small>передач</small></article>
              <article><b>{totals.points}</b><small>очков</small></article>
              <article><b>{totals.penalty}</b><small>штр. мин.</small></article>
            </>}
          </div>
        </div>
      </section>

      <section className="playerContent">
        <p className="tableScrollHint">Смахивайте таблицу влево и вправо, чтобы увидеть все показатели.</p>
        <PlayerHistorySection title="Статистика по чемпионатам" rows={championships} emptyMessage="Нет статистики по чемпионатам." isGoalkeeper={isGoalkeeper} hasGoalkeeperStats={hasGoalkeeperStats} />
        <PlayerHistorySection title="Статистика по турнирам" rows={tournaments} emptyMessage="Нет статистики по турнирам." isGoalkeeper={isGoalkeeper} hasGoalkeeperStats={hasGoalkeeperStats} />
      </section>
    </main>
  );
}
import {entityMetadata} from '@/lib/entity-metadata';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return entityMetadata('player',decodeURIComponent((await params).slug),await searchParams);}
