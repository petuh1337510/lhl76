import { withAdmin } from "@/lib/admin-guard";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function handleGET() {
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { startsAt: "desc" },
    include: {
      competitions: { select: { id: true } },
    },
  });

  const competitionIds = activeSeason?.competitions.map((item) => item.id) ?? [];
  const divisions = competitionIds.length
    ? await prisma.division.findMany({
        where: { competitionId: { in: competitionIds } },
        select: { id: true },
      })
    : [];
  const divisionIds = divisions.map((item) => item.id);

  const [teamEntries, rosterPlayers, upcomingMatches, draftNews] = await Promise.all([
    divisionIds.length
      ? prisma.teamEntry.findMany({
          where: { divisionId: { in: divisionIds } },
          distinct: ["teamId"],
          select: { teamId: true },
        })
      : [],
    divisionIds.length
      ? prisma.rosterEntry.findMany({
          where: { teamEntry: { divisionId: { in: divisionIds } } },
          distinct: ["playerId"],
          select: { playerId: true },
        })
      : [],
    divisionIds.length
      ? prisma.match.count({
          where: {
            divisionId: { in: divisionIds },
            OR: [
              { status: "LIVE" },
              { status: "SCHEDULED", startsAt: { gte: new Date() } },
            ],
          },
        })
      : 0,
    prisma.news.count({ where: { isPublished: false } }),
  ]);

  const nextMatches = divisionIds.length
    ? await prisma.match.findMany({
        where: {
          divisionId: { in: divisionIds },
          OR: [
            { status: "LIVE" },
            { status: "SCHEDULED", startsAt: { gte: new Date() } },
          ],
        },
        orderBy: [{ status: "asc" }, { startsAt: "asc" }],
        take: 4,
        include: {
          division: true,
          homeTeamEntry: { include: { team: true } },
          awayTeamEntry: { include: { team: true } },
        },
      })
    : [];

  return NextResponse.json({
    activeSeason: activeSeason ? { id: activeSeason.id, name: activeSeason.name } : null,
    counts: {
      upcomingMatches,
      teams: teamEntries.length,
      players: rosterPlayers.length,
      draftNews,
    },
    nextMatches: nextMatches.map((match) => ({
      id: match.id,
      slug: match.slug,
      division: match.division.name,
      home: match.homeTeamEntry.team.name,
      away: match.awayTeamEntry.team.name,
      startsAt: match.startsAt,
      status: match.status,
    })),
  });
}

export const GET = withAdmin(handleGET);
