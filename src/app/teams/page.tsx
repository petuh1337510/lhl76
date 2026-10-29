import { PublicImage } from "@/components/public-image";
import Link from "next/link";

import { PublicSiteHeader } from "@/components/public-site-header";
import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const [query, seasons] = await Promise.all([
    searchParams,
    prisma.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
      select: { id: true, name: true, slug: true, isActive: true },
    }),
  ]);
  const season = seasons.find((item) => item.slug === query.season) ?? seasons[0];
  const competitions = season ? await prisma.competition.findMany({
    where: { seasonId: season.id },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      divisions: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { teamEntries: { include: { team: true } } },
      },
    },
  }) : [];
  const groups = competitions.flatMap((competition) => competition.divisions.map((division) => ({
    competition,
    division,
    teams: division.teamEntries
      .map((entry) => entry.team)
      .filter((team) => !team.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name, "ru")),
  }))).filter((group) => group.teams.length > 0);
  const teamCount = new Set(groups.flatMap((group) => group.teams.map((team) => team.id))).size;

  return <>
    <PublicSiteHeader />
    <main className="leagueCatalog">
    <section className="leagueCatalogHero"><div className="leagueCatalogShell">
      <span>ЛХЛ-76 · {season?.name ?? "ЯРОСЛАВЛЬ"}</span>
      <h1>КОМАНДЫ ЛИГИ</h1>
      <p>{season ? `${teamCount} команд в соревнованиях сезона ${season.name}. Выберите дивизион или откройте карточку команды.` : "Команды лиги появятся здесь после добавления сезона."}</p>
    </div></section>
    <div className="leagueCatalogShell leagueCatalogBody">
      {seasons.length > 1 ? <nav className="leagueCatalogSeasons" aria-label="Выбор сезона">{seasons.map((item) => <Link key={item.id} className={item.id === season?.id ? "active" : ""} href={`/teams?season=${item.slug}`}>{item.name}</Link>)}</nav> : null}
      {groups.length ? groups.map(({ competition, division, teams }) => <section className="leagueCatalogBlock" key={division.id}>
        <header><div><small>{competition.name} · {season?.name}</small><h2>{division.name}</h2></div><Link href={`/competition/${season!.slug}/${competitionPublicPath(competition.name, competition.type)}/${publicSlug(division.name)}`}>ОТКРЫТЬ ДИВИЗИОН →</Link></header>
        <div className="leagueCatalogGrid">{teams.map((team) => <Link className="leagueTeamCard" href={`/team/${team.slug}`} key={team.id}>
          <span className="leagueTeamCrest">{team.logoUrl ? <PublicImage width={160} height={160} sizes="160px" src={team.logoUrl} alt="" /> : <b>{team.shortName.slice(0, 2)}</b>}</span>
          <span><strong>{team.name}</strong><small>{team.city || "Ярославская область"}</small></span><i aria-hidden="true">↗</i>
        </Link>)}</div>
      </section>) : <div className="leagueCatalogEmpty">В выбранном сезоне команды пока не добавлены.</div>}
    </div>
    </main>
  </>;
}
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata('Команды','Команды ЛХЛ-76: составы, календарь и статистика игроков.','/teams');
