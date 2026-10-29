import Link from "next/link";

import { PublicSiteHeader } from "@/components/public-site-header";
import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function counted(value: number, one: string, few: string, many: string) {
  const lastTwo = value % 100;
  const last = value % 10;
  return `${value} ${lastTwo >= 11 && lastTwo <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many}`;
}

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const [query, seasons] = await Promise.all([
    searchParams,
    prisma.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
      select: { id: true, name: true, slug: true, isActive: true },
    }),
  ]);
  const season = seasons.find((item) => item.slug === query.season) ?? seasons[0];
  const tournaments = season ? await prisma.competition.findMany({
    where: { seasonId: season.id, type: "TOURNAMENT" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { divisions: {
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { teamEntries: true, matches: true } } },
    } },
  }) : [];

  return <>
    <PublicSiteHeader />
    <main className="leagueCatalog">
    <section className="leagueCatalogHero"><div className="leagueCatalogShell">
      <span>ЛХЛ-76 · {season?.name ?? "ЯРОСЛАВЛЬ"}</span>
      <h1>ТУРНИРЫ</h1>
      <p>Турниры лиги: участники, календарь и результаты по каждому дивизиону.</p>
    </div></section>
    <div className="leagueCatalogShell leagueCatalogBody">
      {seasons.length > 1 ? <nav className="leagueCatalogSeasons" aria-label="Выбор сезона">{seasons.map((item) => <Link key={item.id} className={item.id === season?.id ? "active" : ""} href={`/tournaments?season=${item.slug}`}>{item.name}</Link>)}</nav> : null}
      {tournaments.length ? <div className="leagueTournamentGrid">{tournaments.map((tournament, index) => <article className="leagueTournamentCard" key={tournament.id}>
        <span className="leagueTournamentNumber">{String(index + 1).padStart(2, "0")} / ТУРНИР</span>
        <h2>{tournament.name}</h2>
        <p>Сезон {season?.name} · {counted(tournament.divisions.length, "дивизион", "дивизиона", "дивизионов")}</p>
        <div className="leagueTournamentDivisions">{tournament.divisions.map((division) => <Link key={division.id} href={`/competition/${season!.slug}/${competitionPublicPath(tournament.name, tournament.type)}/${publicSlug(division.name)}`}>
          <span><strong>{division.name}</strong><small>{counted(division._count.teamEntries, "команда", "команды", "команд")} · {counted(division._count.matches, "матч", "матча", "матчей")}</small></span><i aria-hidden="true">↗</i>
        </Link>)}</div>
        {!tournament.divisions.length ? <span className="leagueTournamentPending">Дивизионы пока не добавлены</span> : null}
      </article>)}</div> : <div className="leagueCatalogEmpty">В выбранном сезоне турниры пока не добавлены.</div>}
    </div>
    </main>
  </>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Турниры','Турниры ЛХЛ-76: участники, расписание, результаты и статистика.','/tournaments');
