import "server-only";

import { calculateStandings } from "@/lib/domain/standings";
import { calculateGoalieMetrics } from "@/lib/domain/goalie-statistics";
import { prisma } from "@/lib/prisma";
import type { DivisionPlayerStatistic, DivisionTeam } from "@/lib/division-page";

/** Only the standings and player fields shown on the homepage. */
export async function getHomeDivisionSummary(divisionId: string): Promise<{
  teams: DivisionTeam[];
  leaders: DivisionPlayerStatistic[];
}> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: {
      teamEntries: {
        select: {
          id: true,
          team: { select: { slug: true, name: true, city: true, logoUrl: true } },
          playerStats: {
            select: {
              id: true, playerId: true, games: true, goals: true, assists: true,
              penaltyMinutes: true, goalieGames: true, goalieSeconds: true,
              shotsAgainst: true, goalieGoalsAgainst: true,
              player: { select: { slug: true, lastName: true, firstName: true, position: true, photoUrl: true } },
            },
          },
        },
      },
      matches: {
        where: { status: "FINAL", isPlayoff: false, stage: { countsForStandings: true } },
        select: {
          slug: true, startsAt: true, homeTeamEntryId: true, awayTeamEntryId: true,
          homeScore: true, awayScore: true, resultType: true, protocolData: true,
          penalties: { select: { teamEntryId: true, minutes: true } },
        },
      },
    },
  });
  if (!division) return { teams: [], leaders: [] };

  const results = division.matches.map((match) => {
    const protocol = match.protocolData && typeof match.protocolData === "object"
      ? match.protocolData as Record<string, unknown> : {};
    return {
      home: match.homeTeamEntryId,
      away: match.awayTeamEntryId,
      homeGoals: match.homeScore,
      awayGoals: match.awayScore,
      homePenaltyMinutes: match.penalties.filter((penalty) => penalty.teamEntryId === match.homeTeamEntryId).reduce((sum, penalty) => sum + penalty.minutes, 0),
      awayPenaltyMinutes: match.penalties.filter((penalty) => penalty.teamEntryId === match.awayTeamEntryId).reduce((sum, penalty) => sum + penalty.minutes, 0),
      technicalWinner: match.resultType === "TECHNICAL" && typeof protocol.technicalWinnerTeamEntryId === "string"
        ? protocol.technicalWinnerTeamEntryId : null,
      excludeGoals: match.resultType === "TECHNICAL",
    };
  });
  const standings = calculateStandings(results);
  const standingsByTeam = new Map(standings.map((row) => [row.team, row]));
  const orderedEntries = [...division.teamEntries].sort((a, b) => {
    const aRow = standingsByTeam.get(a.id);
    const bRow = standingsByTeam.get(b.id);
    if (aRow && bRow) return standings.indexOf(aRow) - standings.indexOf(bRow);
    if (aRow) return -1;
    if (bRow) return 1;
    return a.team.name.localeCompare(b.team.name, "ru");
  });
  const teams: DivisionTeam[] = orderedEntries.map((entry, index) => {
    const row = standingsByTeam.get(entry.id) ?? {
      games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    };
    const form = division.matches
      .filter((match) => match.homeTeamEntryId === entry.id || match.awayTeamEntryId === entry.id)
      .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0))
      .slice(0, 5)
      .reverse()
      .map((match) => {
        const isHome = match.homeTeamEntryId === entry.id;
        const protocol = match.protocolData && typeof match.protocolData === "object"
          ? match.protocolData as Record<string, unknown> : {};
        const own = isHome ? match.homeScore : match.awayScore;
        const opponent = isHome ? match.awayScore : match.homeScore;
        return {
          result: match.resultType === "TECHNICAL"
            ? protocol.technicalWinnerTeamEntryId === entry.id ? "w" as const : "l" as const
            : own === opponent ? "d" as const : own > opponent ? "w" as const : "l" as const,
          matchSlug: match.slug,
        };
      });
    return {
      rank: index + 1, id: entry.id, slug: entry.team.slug, name: entry.team.name,
      city: entry.team.city, logoUrl: entry.team.logoUrl, ...row, form,
    };
  });
  const leaders: DivisionPlayerStatistic[] = division.teamEntries.flatMap((entry) =>
    entry.playerStats.map((stat) => {
      const goalie = calculateGoalieMetrics(stat.goalieSeconds, stat.shotsAgainst, stat.goalieGoalsAgainst);
      return {
        key: `${entry.id}-${stat.playerId}`,
        slug: stat.player.slug,
        name: [stat.player.lastName, stat.player.firstName].filter(Boolean).join(" "),
        position: stat.player.position || "Игрок",
        photoUrl: stat.player.photoUrl,
        teamSlug: entry.team.slug,
        teamName: entry.team.name,
        games: stat.games,
        goals: stat.goals,
        assists: stat.assists,
        penalty: stat.penaltyMinutes,
        points: stat.goals + stat.assists,
        isGoalkeeper: (stat.player.position || "").toLocaleLowerCase("ru").includes("вратар") || stat.goalieGames > 0,
        goalieGames: stat.goalieGames,
        goalieMinutes: Math.floor(stat.goalieSeconds / 60),
        shotsAgainst: stat.shotsAgainst,
        goalieGoalsAgainst: stat.goalieGoalsAgainst,
        saves: goalie.saves,
        savePercentage: goalie.savePercentage,
        goalsAgainstAverage: goalie.goalsAgainstAverage,
      };
    }),
  );
  return { teams, leaders };
}
