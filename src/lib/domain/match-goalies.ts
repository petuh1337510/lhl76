import { parseMatchClock } from "./match-clock";

type TimedGoal = { teamEntryId: string; clockSeconds: number | null; situation: string };
type Interval = { from: number; to: number };
type GoalieStint = Interval & { shots: number | null };

export type GoalieMatch = {
  status: string;
  resultType: string;
  isPlayoff: boolean;
  homeTeamEntryId: string;
  awayTeamEntryId: string;
  homeScore: number;
  awayScore: number;
  protocolData: unknown;
  goals: TimedGoal[];
  shootoutGoals: { teamEntryId: string }[];
};

export const goalieStatisticKey = (teamEntryId: string, playerId: string) => `${teamEntryId}:${playerId}`;
const minimumSeconds = 55 * 60;

function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last && interval.from <= last.to) last.to = Math.max(last.to, interval.to);
    else merged.push({ ...interval });
  }
  return merged;
}

function goalieStints(data: unknown): unknown[] {
  if (!data || typeof data !== "object" || !("goalieStints" in data)) return [];
  return Array.isArray(data.goalieStints) ? data.goalieStints : [];
}

export function sumPeriodShots(periods: unknown, side: "home" | "away"): number | null {
  if (!Array.isArray(periods) || periods.length < 3) return null;
  let total = 0;
  for (const period of periods.slice(0, 3)) {
    const value = period?.[side];
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
    const shots = Number(value);
    if (!Number.isSafeInteger(shots) || shots < 0) return null;
    total += shots;
  }
  return total;
}

export function automaticGoalieShots(stints: readonly unknown[], periods: unknown, homeId: string, awayId: string) {
  const result = new Map<unknown, number>();
  const entries = stints.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  for (const [teamId, opponent] of [[homeId, "away"], [awayId, "home"]] as const) {
    const teamStints = entries.filter(stint => stint.teamEntryId === teamId);
    if (teamStints.length !== 1) continue;
    const [stint] = teamStints;
    if (!stint.playerId || parseMatchClock(stint.from) !== 0 || parseMatchClock(stint.to) !== 3600) continue;
    const shots = sumPeriodShots(periods, opponent);
    if (shots !== null) result.set(stint, shots);
  }
  return result;
}

export function calculateMatchGoalies(match: GoalieMatch) {
    if (match.resultType === "TECHNICAL") return [];
    const teams = [match.homeTeamEntryId, match.awayTeamEntryId];
    const goals = teams.map(team => match.goals.filter(goal => goal.teamEntryId === team));
    const shootoutScores = teams.map(team => match.shootoutGoals.filter(goal => goal.teamEntryId === team).length);
    const recordedScores = goals.map((list, index) => list.length + Number(
      match.isPlayoff && goals[0].length === goals[1].length && shootoutScores[index] > shootoutScores[1 - index],
    ));

    const rawStints = goalieStints(match.protocolData);
    const protocol = match.protocolData as { shots?: unknown } | null;
    const automatic = automaticGoalieShots(rawStints, protocol?.shots, match.homeTeamEntryId, match.awayTeamEntryId);
    const stints = new Map<string, { playerId: string; teamEntryId: string; intervals: GoalieStint[]; invalid: boolean }>();
    for (const raw of rawStints) {
      if (!raw || typeof raw !== "object") continue;
      const { playerId, teamEntryId, from, to, shotsAgainst } = raw as Record<string, unknown>;
      if (typeof playerId !== "string" || !playerId || typeof teamEntryId !== "string" || !teams.includes(teamEntryId)) continue;
      const key = goalieStatisticKey(teamEntryId, playerId);
      const stint = stints.get(key) ?? { playerId, teamEntryId, intervals: [], invalid: false };
      const start = parseMatchClock(from), end = parseMatchClock(to);
      const enteredShots = typeof shotsAgainst === "number" || (typeof shotsAgainst === "string" && shotsAgainst.trim()) ? Number(shotsAgainst) : NaN;
      const shots = automatic.get(raw) ?? enteredShots;
      if (start === null || end === null || end <= start) stint.invalid = true;
      else stint.intervals.push({ from: start, to: end, shots: Number.isSafeInteger(shots) && shots >= 0 ? shots : null });
      stints.set(key, stint);
    }

    const players = [...stints.values()];
    const duration = Math.max(3600, ...players.flatMap(stint => stint.intervals.map(interval => interval.to)));
    return players.flatMap(stint => {
      if (stint.invalid) return [];
      const opposition = stint.teamEntryId === match.homeTeamEntryId ? 1 : 0;
      const intervals = mergeIntervals(stint.intervals);
      const otherGoalies = players.filter(other => other.teamEntryId === stint.teamEntryId && other.playerId !== stint.playerId);
      const replacements = otherGoalies.flatMap(other => other.intervals);
      if (intervals.some(({ from, to }) => replacements.some(other => from < other.to && other.from < to))) return [];
      const seconds = intervals.reduce((sum, { from, to }) => sum + to - from, 0);
      const playedFullGame = intervals.length === 1 && intervals[0].from === 0 && seconds === duration && !otherGoalies.length;
      const opposingGoals = goals[opposition].filter(goal => goal.situation !== "EMPTY_NET");
      const hasTime = (time: number | null): time is number => time !== null && Number.isSafeInteger(time) && time >= 0 && time <= duration;
      const knownGoals = recordedScores[opposition] === (opposition === 0 ? match.homeScore : match.awayScore) &&
        (playedFullGame || opposingGoals.every(goal => hasTime(goal.clockSeconds)));
      let goalsAgainst: number | null = null;
      if (knownGoals) {
        // The only goalie who played the whole game faced every non-empty-net goal,
        // including any older goals with missing or corrupted event times.
        goalsAgainst = playedFullGame ? opposingGoals.length : opposingGoals.filter(({ clockSeconds: time }) =>
          hasTime(time) && intervals.some(({ from, to }) => time >= from && (time < to ||
            // At a substitution, the incoming goalie is on the ice. Without a recorded
            // replacement, include a goal at the end of the stint (e.g. at the final horn).
            (time === to && !replacements.some(other => time >= other.from && time < other.to))))).length;
      }

      const enteredSeconds = stint.intervals.reduce((sum, interval) => sum + interval.to - interval.from, 0);
      const shotsAgainst = enteredSeconds === seconds && stint.intervals.every(interval => interval.shots !== null)
        ? stint.intervals.reduce((sum, interval) => sum + (interval.shots ?? 0), 0)
        : null;
      return [{
        playerId: stint.playerId,
        teamEntryId: stint.teamEntryId,
        seconds,
        playedFullGame,
        goalsAgainst,
        shotsAgainst,
        shutout: match.status === "FINAL" && goalsAgainst === 0 && seconds >= minimumSeconds,
      }];
    });
}

export type GoalieProtocolStatistic = {
  games: number;
  seconds: number;
  goalsAgainst: number;
  shotsAgainst: number | null;
  shutouts: number;
};

export function aggregateMatchGoalies(matches: GoalieMatch[]) {
  const totals = new Map<string, GoalieProtocolStatistic>();
  for (const match of matches) {
    if (match.status !== "FINAL") continue;
    for (const row of calculateMatchGoalies(match)) {
      if (row.goalsAgainst === null) continue;
      const key = goalieStatisticKey(row.teamEntryId, row.playerId);
      const previous = totals.get(key) ?? { games: 0, seconds: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 };
      totals.set(key, {
        games: previous.games + 1,
        seconds: previous.seconds + row.seconds,
        goalsAgainst: previous.goalsAgainst + row.goalsAgainst,
        shotsAgainst: previous.shotsAgainst === null || row.shotsAgainst === null ? null : previous.shotsAgainst + row.shotsAgainst,
        shutouts: previous.shutouts + Number(row.shutout),
      });
    }
  }
  return totals;
}
