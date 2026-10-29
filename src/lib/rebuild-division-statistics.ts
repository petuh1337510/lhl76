import type { Prisma } from "@prisma/client";
import { calculateDivisionStatistics } from "@/lib/domain/division-statistics";

export async function rebuildDivisionStatistics(
  tx: Prisma.TransactionClient,
  divisionId: string,
) {
  const [teamEntries, matches] = await Promise.all([
    tx.teamEntry.findMany({
      where: { divisionId },
      select: { id: true },
    }),
    tx.match.findMany({
      where: {
        divisionId,
        status: "FINAL",
        isPlayoff: false,
        stage: { countsForStandings: true },
      },
      select: {
        homeTeamEntryId: true,
        awayTeamEntryId: true,
        homeScore: true,
        awayScore: true,
        resultType: true,
        protocolData: true,
        penalties: { select: { teamEntryId: true, minutes: true } },
      },
    }),
  ]);

  const rows = calculateDivisionStatistics(
    teamEntries.map((entry) => entry.id),
    matches.map((match) => {
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
      home: match.homeTeamEntryId,
      away: match.awayTeamEntryId,
      homeGoals: match.homeScore,
      awayGoals: match.awayScore,
      homePenaltyMinutes: match.resultType === "TECHNICAL" ? 0 : match.penalties
        .filter((penalty) => penalty.teamEntryId === match.homeTeamEntryId)
        .reduce((sum, penalty) => sum + penalty.minutes, 0),
      awayPenaltyMinutes: match.resultType === "TECHNICAL" ? 0 : match.penalties
        .filter((penalty) => penalty.teamEntryId === match.awayTeamEntryId)
        .reduce((sum, penalty) => sum + penalty.minutes, 0),
      technicalWinner,
      excludeGoals: match.resultType === "TECHNICAL",
    };
    }),
  );

  for (const row of rows) {
    await tx.teamStatistic.upsert({
      where: { teamEntryId: row.teamEntryId },
      create: {
        teamEntryId: row.teamEntryId,
        games: row.games,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      },
      update: {
        games: row.games,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      },
    });
  }

  // Replacing the division ranks as one snapshot avoids temporary unique-rank
  // collisions when two teams swap places after a corrected protocol.
  await tx.standing.deleteMany({ where: { divisionId } });
  if (rows.length)
    await tx.standing.createMany({
      data: rows.map((row) => ({
        divisionId,
        teamEntryId: row.teamEntryId,
        rank: row.rank,
        points: row.points,
      })),
    });
}
