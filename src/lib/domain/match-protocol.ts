export type ProtocolGoalInput = {
  teamEntryId: string;
  scorerId?: string;
  assist1Id?: string;
  assist2Id?: string;
  situation?: string;
  penaltyShotOutcome?: string;
  period?: number | string | null;
  clockSeconds?: number | string | null;
};

export type ProtocolPenaltyInput = {
  teamEntryId: string;
  playerId?: string;
  minutes?: number | string | null;
};

export type ProtocolRosterInput = {
  playerId: string;
  teamEntryId: string;
};

export type ProtocolGoalieStintInput = {
  teamEntryId: string;
  playerId?: string;
  from?: string;
  to?: string;
  shotsAgainst?: number | string | null;
};

export type ProtocolContribution = {
  playerId: string;
  teamEntryId: string;
  goals: number;
  assists: number;
  penaltyMinutes: number;
  games: number;
  goalieGames: number;
  goalieSeconds: number;
  shotsAgainst: number;
  goalieGoalsAgainst: number;
};

const isMissedPenaltyShot = (goal: ProtocolGoalInput) =>
  goal.situation === "PENALTY_SHOT" && goal.penaltyShotOutcome === "miss";

function eventPeriod(goal: ProtocolGoalInput) {
  const explicit = Number(goal.period);
  if ([1, 2, 3].includes(explicit)) return explicit;
  const seconds = Number(goal.clockSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) return 1;
  return seconds < 1200 ? 1 : seconds < 2400 ? 2 : 3;
}

export function deriveMatchProtocol(input: {
  homeTeamEntryId: string;
  awayTeamEntryId: string;
  goals?: ProtocolGoalInput[];
  penalties?: ProtocolPenaltyInput[];
  roster?: ProtocolRosterInput[];
  goalieStints?: ProtocolGoalieStintInput[];
  status?: string;
}) {
  const goals = (input.goals || []).filter((goal) => !isMissedPenaltyShot(goal));
  const contributions = new Map<string, ProtocolContribution>();
  const add = (
    playerId: string | undefined,
    teamEntryId: string,
    field:
      | "goals"
      | "assists"
      | "penaltyMinutes"
      | "games"
      | "goalieGames"
      | "goalieSeconds"
      | "shotsAgainst"
      | "goalieGoalsAgainst",
    amount: number,
  ) => {
    if (!playerId || !Number.isFinite(amount) || amount === 0) return;
    const key = `${playerId}:${teamEntryId}`;
    const row = contributions.get(key) || {
      playerId,
      teamEntryId,
      goals: 0,
      assists: 0,
      penaltyMinutes: 0,
      games: 0,
      goalieGames: 0,
      goalieSeconds: 0,
      shotsAgainst: 0,
      goalieGoalsAgainst: 0,
    };
    row[field] += amount;
    contributions.set(key, row);
  };

  for (const goal of goals) {
    add(goal.scorerId, goal.teamEntryId, "goals", 1);
    for (const assistantId of new Set([goal.assist1Id, goal.assist2Id])) {
      if (assistantId && assistantId !== goal.scorerId)
        add(assistantId, goal.teamEntryId, "assists", 1);
    }
  }
  for (const penalty of input.penalties || []) {
    const parsed = Number(penalty.minutes);
    add(
      penalty.playerId,
      penalty.teamEntryId,
      "penaltyMinutes",
      Number.isFinite(parsed) && parsed > 0 ? parsed : 2,
    );
  }
  if (input.status === "FINAL")
    for (const player of input.roster || [])
      add(player.playerId, player.teamEntryId, "games", 1);

  if (input.status === "FINAL") {
    const goalieAppearances = new Set<string>();
    const secondsAt = (value?: string) => {
      const [minutes, seconds] = (value || "").split(":").map(Number);
      return Number.isFinite(minutes) && Number.isFinite(seconds)
        ? Math.max(0, minutes * 60 + seconds)
        : 0;
    };
    for (const stint of input.goalieStints || []) {
      if (
        stint.shotsAgainst === "" ||
        stint.shotsAgainst === null ||
        stint.shotsAgainst === undefined
      )
        continue;
      const shots = Number(stint.shotsAgainst);
      if (!stint.playerId || !Number.isFinite(shots) || shots < 0) continue;
      const key = `${stint.playerId}:${stint.teamEntryId}`;
      const from = secondsAt(stint.from);
      const to = Math.max(from, secondsAt(stint.to));
      const goalsAgainst = goals.filter((goal) => {
        const clock = Number(goal.clockSeconds);
        return (
          goal.teamEntryId !== stint.teamEntryId &&
          Number.isFinite(clock) &&
          clock >= from &&
          clock < to
        );
      }).length;
      if (!goalieAppearances.has(key)) {
        add(stint.playerId, stint.teamEntryId, "goalieGames", 1);
        goalieAppearances.add(key);
      }
      add(stint.playerId, stint.teamEntryId, "goalieSeconds", to - from);
      add(stint.playerId, stint.teamEntryId, "shotsAgainst", shots);
      add(stint.playerId, stint.teamEntryId, "goalieGoalsAgainst", goalsAgainst);
    }
  }

  const scoreFor = (teamEntryId: string) =>
    goals.filter((goal) => goal.teamEntryId === teamEntryId).length;
  const periods = [1, 2, 3].map((period) => ({
    home: goals.filter(
      (goal) => goal.teamEntryId === input.homeTeamEntryId && eventPeriod(goal) === period,
    ).length,
    away: goals.filter(
      (goal) => goal.teamEntryId === input.awayTeamEntryId && eventPeriod(goal) === period,
    ).length,
  }));

  return {
    homeScore: scoreFor(input.homeTeamEntryId),
    awayScore: scoreFor(input.awayTeamEntryId),
    periodScores: periods,
    contributions: [...contributions.values()],
  };
}

