import { notFound, redirect } from "next/navigation";
import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { prisma } from "@/lib/prisma";

export default async function LegacyStatisticsPage({
  params,
}: {
  params: Promise<{ season: string; division: string; category: string }>;
}) {
  const { season: seasonSlug, division: divisionSlug, category } = await params;
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
      .filter(
        (division) =>
          division.slug === divisionSlug || publicSlug(division.name) === divisionSlug,
      )
      .map((division) => ({ competition, division })),
  );
  const destination =
    candidates.find(({ competition }) => competition.type === "CHAMPIONSHIP") ||
    candidates[0];
  if (!destination) notFound();

  const competitionPath = competitionPublicPath(
    destination.competition.name,
    destination.competition.type,
  );
  const divisionPath = publicSlug(destination.division.name);
  const view = category === "goalies" ? "&view=goalkeepers" : "";
  redirect(
    `/competition/${season.slug}/${competitionPath}/${divisionPath}?tab=statistics${view}`,
  );
}
