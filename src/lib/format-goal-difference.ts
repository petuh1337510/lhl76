/** Signed difference between goals scored and conceded in the standings. */
export function formatGoalDifference(goalsFor: number, goalsAgainst: number): string {
  const difference = goalsFor - goalsAgainst;
  return `${difference > 0 ? "+" : ""}${difference}`;
}
