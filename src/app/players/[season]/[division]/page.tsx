import { notFound, redirect } from "next/navigation";

import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ season: string; division: string }>;
}) {
  const { season: seasonSlug, division: divisionSlug } = await params;
  const season = await prisma.season.findUnique({
    where: { slug: seasonSlug },
    include: {
      competitions: {
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
        include: { divisions: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!season) notFound();

  const candidates = season.competitions.flatMap((competition) =>
    competition.divisions
      .filter((division) => division.slug === divisionSlug || publicSlug(division.name) === divisionSlug)
      .map((division) => ({ competition, division })),
  );
  const destination = candidates.find(({ competition }) => competition.type === "CHAMPIONSHIP") ?? candidates[0];
  if (!destination) notFound();

  redirect(`/competition/${season.slug}/${competitionPublicPath(destination.competition.name, destination.competition.type)}/${publicSlug(destination.division.name)}?tab=statistics`);
}
