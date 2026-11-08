import "server-only";

import type { Prisma } from "@prisma/client";
import { aggregateMatchGoalies, type GoalieProtocolStatistic } from "@/lib/domain/match-goalies";
import { matchClockResolver } from "@/lib/domain/match-clock";
import { prisma } from "@/lib/prisma";

export async function getGoalieProtocolStatistics(scope: Prisma.MatchWhereInput, playerId?: string) {
  const matches = await prisma.match.findMany({
    where: {
      ...scope,
      status: "FINAL",
      resultType: { not: "TECHNICAL" },
      protocolData: playerId
        ? { path: ["goalieStints"], array_contains: [{ playerId }] }
        : { path: ["goalieStints"], not: [] },
    },
    select: {
      status: true,
      resultType: true,
      isPlayoff: true,
      homeTeamEntryId: true,
      awayTeamEntryId: true,
      homeScore: true,
      awayScore: true,
      protocolData: true,
      goals: { select: { teamEntryId: true, scorerId: true, clockSeconds: true, situation: true } },
      legacyEvents: {
        where: { eventType: "Гол" },
        select: { teamEntryId: true, playerId: true, eventType: true, minute: true },
      },
      penaltyShots: { where: { phase: "SHOOTOUT", scored: true }, select: { teamEntryId: true } },
    },
  });
  return aggregateMatchGoalies(matches.map(({ penaltyShots, legacyEvents, ...match }) => {
    const clock = matchClockResolver(match.protocolData, legacyEvents);
    return {
      ...match,
      goals: match.goals.map(goal => ({ ...goal, clockSeconds: clock(goal.clockSeconds, goal.teamEntryId, goal.scorerId, "Гол") })),
      shootoutGoals: penaltyShots,
    };
  }));
}

export function goalieStatisticsFor(stored: { goalieGames: number; goalieSeconds: number; goalieGoalsAgainst: number; shotsAgainst: number }, protocol?: GoalieProtocolStatistic) {
  return protocol ? {
    goalieGames: protocol.games,
    goalieSeconds: protocol.seconds,
    goalieGoalsAgainst: protocol.goalsAgainst,
    shotsAgainst: protocol.shotsAgainst,
    shutouts: protocol.shutouts,
  } : {
    goalieGames: stored.goalieGames,
    goalieSeconds: stored.goalieSeconds,
    goalieGoalsAgainst: stored.goalieGoalsAgainst,
    shotsAgainst: stored.shotsAgainst,
    shutouts: null,
  };
}
