import { notFound, redirect } from "next/navigation";

import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export default async function LegacyDivisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ division: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const season = await prisma.season.findUnique({
    where: { slug: "2026-27" },
    include: {
      competitions: {
        where: { type: "CHAMPIONSHIP" },
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
        include: { divisions: true },
      },
    },
  });
  if (!season) notFound();
  const divisionSlug = route.division === "debut" ? "debyut" : route.division;
  const destination = season.competitions.flatMap((competition) =>
    competition.divisions.map((division) => ({ competition, division })),
  ).find(({ division }) => division.slug === divisionSlug || publicSlug(division.name) === divisionSlug);
  if (!destination) notFound();
  const tab = query.tab === "calendar" || query.tab === "statistics" ? `?tab=${query.tab}` : "";
  redirect(`/competition/${season.slug}/${competitionPublicPath(destination.competition.name, destination.competition.type)}/${publicSlug(destination.division.name)}${tab}`);
}
