import { calculateStandings, type MatchResult } from "./standings";

export type DivisionStatisticRow = {
  teamEntryId: string;
  rank: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/**
 * Builds one canonical division snapshot from finalized regular-stage matches.
 * Teams without completed matches are kept at the bottom of the table.
 */
export function calculateDivisionStatistics(
  teamEntryIds: string[],
  results: MatchResult[],
): DivisionStatisticRow[] {
  const calculated = calculateStandings(results);
  const calculatedByTeam = new Map(calculated.map((row) => [row.team, row]));
  const orderedIds = [
    ...calculated.map((row) => row.team),
    ...teamEntryIds.filter((id) => !calculatedByTeam.has(id)).sort(),
  ];

  return orderedIds.map((teamEntryId, index) => {
    const row = calculatedByTeam.get(teamEntryId);
    return {
      teamEntryId,
      rank: index + 1,
      games: row?.games ?? 0,
      wins: row?.wins ?? 0,
      draws: row?.draws ?? 0,
      losses: row?.losses ?? 0,
      goalsFor: row?.goalsFor ?? 0,
      goalsAgainst: row?.goalsAgainst ?? 0,
      points: row?.points ?? 0,
    };
  });
}
