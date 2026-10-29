export type GoalieMetrics = {
  saves: number;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
};

export function calculateGoalieMetrics(
  goalieSeconds: number,
  shotsAgainst: number,
  goalsAgainst: number,
): GoalieMetrics {
  const seconds = Math.max(0, goalieSeconds || 0);
  const shots = Math.max(0, shotsAgainst || 0);
  const conceded = Math.max(0, goalsAgainst || 0);
  const saves = Math.max(0, shots - conceded);

  return {
    saves,
    savePercentage: shots ? (saves / shots) * 100 : null,
    goalsAgainstAverage: seconds ? (conceded * 3600) / seconds : null,
  };
}
