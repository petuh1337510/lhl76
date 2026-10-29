import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getSeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { name: "desc" }],
    include: {
      competitions: {
        include: {
          divisions: {
            include: { _count: { select: { teamEntries: true, matches: true } } },
          },
        },
      },
    },
  });

  return seasons.map((season) => {
    const divisions = season.competitions.flatMap((competition) => competition.divisions);
    return {
      id: season.id,
      name: season.name,
      slug: season.slug,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      isActive: season.isActive,
      competitions: season.competitions.length,
      championships: season.competitions.filter((item) => item.type === "CHAMPIONSHIP").length,
      tournaments: season.competitions.filter((item) => item.type === "TOURNAMENT").length,
      divisions: divisions.length,
      teams: divisions.reduce((total, division) => total + division._count.teamEntries, 0),
      matches: divisions.reduce((total, division) => total + division._count.matches, 0),
      canActivate:
        season.competitions.some((item) => item.type === "CHAMPIONSHIP") &&
        divisions.length > 0 &&
        divisions.some((division) => division._count.teamEntries > 0),
    };
  });
}

async function handleGET() {
  return NextResponse.json({ items: await getSeasons() });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Не выбран сезон" }, { status: 400 });

  const season = await prisma.season.findUnique({
    where: { id: body.id },
    include: {
      competitions: {
        include: { divisions: { include: { _count: { select: { teamEntries: true } } } } },
      },
    },
  });
  if (!season) return NextResponse.json({ error: "Сезон не найден" }, { status: 404 });

  const championship = season.competitions.find((item) => item.type === "CHAMPIONSHIP");
  const divisions = season.competitions.flatMap((item) => item.divisions);
  if (!championship || divisions.length === 0 || !divisions.some((item) => item._count.teamEntries > 0)) {
    return NextResponse.json(
      { error: "Сначала добавьте в сезон чемпионат, дивизион и хотя бы одну команду." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.season.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.season.update({ where: { id: season.id }, data: { isActive: true } }),
  ]);

  return NextResponse.json({ ok: true, items: await getSeasons() });
}

export const GET = withAdmin(handleGET);
export const PATCH = withAdmin(handlePATCH);
