import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { homeMatchDateRange } from "@/lib/home-match-carousel";

export const dynamic = "force-dynamic";

export async function GET() {
  const { from, until } = homeMatchDateRange(new Date());
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["LIVE", "SCHEDULED", "FINAL"] },
      startsAt: { gte: from, lt: until },
      ...(activeSeason
        ? { division: { competition: { seasonId: activeSeason.id } } }
        : {}),
    },
    include: {
      division: true,
      venue: true,
      homeTeamEntry: { include: { team: true } },
      awayTeamEntry: { include: { team: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(
    matches.map((match) => {
      const date = match.startsAt ? new Date(match.startsAt) : null;
      const protocol =
        match.protocolData && typeof match.protocolData === "object"
          ? (match.protocolData as Record<string, unknown>)
          : {};
      const technicalWinner =
        match.resultType === "TECHNICAL" &&
        typeof protocol.technicalWinnerTeamEntryId === "string"
          ? protocol.technicalWinnerTeamEntryId
          : null;
      return {
        slug: match.slug,
        status: match.status,
        startsAt: date?.toISOString() ?? null,
        isPlayoff: match.isPlayoff,
        division: match.division.name,
        date: date
          ? new Intl.DateTimeFormat("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              timeZone: "Europe/Moscow",
            }).format(date)
          : "Дата уточняется",
        time: date
          ? new Intl.DateTimeFormat("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Moscow",
            }).format(date)
          : "—",
        venue: match.venue?.name || "Место уточняется",
        home: match.homeTeamEntry.team.name,
        homeSlug: match.homeTeamEntry.team.slug,
        homeLogoUrl: match.homeTeamEntry.team.logoUrl,
        away: match.awayTeamEntry.team.name,
        awaySlug: match.awayTeamEntry.team.slug,
        awayLogoUrl: match.awayTeamEntry.team.logoUrl,
        score:
          match.status === "SCHEDULED"
            ? null
            : technicalWinner
              ? technicalWinner === match.homeTeamEntryId
                ? "+ : −"
                : "− : +"
              : `${match.homeScore} : ${match.awayScore}`,
        homeWinner:
          technicalWinner
            ? technicalWinner === match.homeTeamEntryId
            : match.homeScore > match.awayScore,
        awayWinner:
          technicalWinner
            ? technicalWinner === match.awayTeamEntryId
            : match.awayScore > match.homeScore,
        periods:
          match.status === "LIVE"
            ? "Счёт обновляется онлайн"
            : match.status === "FINAL"
              ? technicalWinner
                ? "Технический результат"
                : match.isPlayoff
                ? "Плей-офф · матч завершён"
                : "Матч завершён"
              : null,
      };
    }),
  );
}
