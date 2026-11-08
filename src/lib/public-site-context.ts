import "server-only";
import { cache } from "react";

import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export type PublicSiteContext = {
  season: { name: string; slug: string };
  championship: { name: string; slug: string; path: string };
  divisions: Array<{ id: string; name: string; slug: string; href: string }>;
  seasons: Array<{ name: string; slug: string; href: string }>;
  tournaments: Array<{ name: string; slug: string; href: string }>;
  championshipHref: string;
  calendarHref: string;
  playersHref: string;
};

export const getPublicSiteContext = cache(async function getPublicSiteContext(): Promise<PublicSiteContext | null> {
  const seasons = await prisma.season.findMany({
    orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { name: "desc" }],
    select: { name: true, slug: true, isActive: true,
      competitions: {
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: { name: true, slug: true, type: true, isActive: true, divisions: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: {id: true, name: true} } },
      },
    },
  });

  const usableSeasons = seasons.filter((season) =>
    season.competitions.some(
      (competition) => competition.type === "CHAMPIONSHIP" && competition.divisions.length > 0,
    ),
  );
  const season = usableSeasons.find((item) => item.isActive) ?? usableSeasons[0];
  if (!season) return null;

  const championships = season.competitions.filter(
    (competition) => competition.type === "CHAMPIONSHIP" && competition.divisions.length > 0,
  );
  const championship = championships.find((item) => item.isActive) ?? championships[0];
  if (!championship) return null;

  const championshipPath = competitionPublicPath(championship.name, championship.type);
  const divisions = championship.divisions.map((division) => {
    const divisionPath = publicSlug(division.name);
    return {
      id: division.id,
      name: division.name,
      slug: divisionPath,
      href: `/competition/${season.slug}/${championshipPath}/${divisionPath}`,
    };
  });
  const firstDivision = divisions[0];
  if (!firstDivision) return null;

  const seasonChoices = usableSeasons.flatMap((seasonItem) => {
    const competition =
      seasonItem.competitions.find(
        (item) => item.type === "CHAMPIONSHIP" && item.isActive && item.divisions.length > 0,
      ) ??
      seasonItem.competitions.find(
        (item) => item.type === "CHAMPIONSHIP" && item.divisions.length > 0,
      );
    if (!competition) return [];
    const division = competition.divisions[0];
    const path = competitionPublicPath(competition.name, competition.type);
    return [{
      name: seasonItem.name,
      slug: seasonItem.slug,
      href: `/competition/${seasonItem.slug}/${path}/${publicSlug(division.name)}`,
    }];
  });

  const tournaments = season.competitions
    .filter((competition) => competition.type === "TOURNAMENT" && competition.divisions.length > 0)
    .map((competition) => ({
      name: competition.name,
      slug: competition.slug,
      href: `/competition/${season.slug}/${competitionPublicPath(competition.name, competition.type)}/${publicSlug(competition.divisions[0].name)}`,
    }));

  return {
    season: { name: season.name, slug: season.slug },
    championship: {
      name: championship.name,
      slug: championship.slug,
      path: championshipPath,
    },
    divisions,
    seasons: seasonChoices,
    tournaments,
    championshipHref: firstDivision.href,
    calendarHref: `${firstDivision.href}?tab=calendar`,
    playersHref: `${firstDivision.href}?tab=statistics`,
  };
});
