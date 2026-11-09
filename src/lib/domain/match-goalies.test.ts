import { describe, expect, it } from "vitest";
import { matchClockResolver, matchClockVersion } from "./match-clock";
import { aggregateMatchGoalies, calculateMatchGoalies, type GoalieMatch } from "./match-goalies";
import { deriveMatchProtocol } from "./match-protocol";

const stint = (playerId: string, from: string, to: string, shotsAgainst?: number) =>
  ({ teamEntryId: "home", playerId, from, to, shotsAgainst });
const goal = (clockSeconds: number | null, situation = "5X5") =>
  ({ teamEntryId: "away", clockSeconds, situation });
const match = (stints: ReturnType<typeof stint>[], goals: GoalieMatch["goals"] = []): GoalieMatch => ({
  status: "FINAL", resultType: "NORMAL", isPlayoff: false, homeTeamEntryId: "home", awayTeamEntryId: "away",
  homeScore: 0, awayScore: goals.length, goals, protocolData: { goalieStints: stints }, shootoutGoals: [],
});

describe("match goalkeeper statistics", () => {
  it("counts the opposing team's period shots for both full-game goalies, including during protocol save", () => {
    const goalieStints = [stint("bars", "00:00", "60:00", 1), { ...stint("armada", "00:00", "60:00"), teamEntryId: "away" }];
    const shots = [{ home: 13, away: 6 }, { home: "12", away: 7 }, { home: 11, away: 8 }];
    const game = { ...match(goalieStints), protocolData: { goalieStints, shots } };
    expect(calculateMatchGoalies(game).map(row => row.shotsAgainst)).toEqual([21, 36]);
    expect(deriveMatchProtocol({ ...game, goalieStints, shots }).contributions.map(row => row.shotsAgainst)).toEqual([21, 36]);
  });

  it("keeps manual counts if a period is missing or the team used a replacement", () => {
    const missing = [{ home: 13, away: 6 }, { home: 12, away: 7 }, { home: 11, away: null }];
    const sole = [stint("bars", "00:00", "60:00", 15)];
    expect(calculateMatchGoalies({ ...match(sole), protocolData: { goalieStints: sole, shots: missing } })[0].shotsAgainst).toBe(15);
    const full = missing.map(row => ({ ...row, away: row.away ?? 0 }));
    expect(calculateMatchGoalies({ ...match(sole), protocolData: { goalieStints: sole, shots: full } })[0].shotsAgainst).toBe(13);
    const replaced = [stint("bars", "00:00", "30:00", 8), stint("backup", "30:00", "60:00", 5)];
    expect(calculateMatchGoalies({ ...match(replaced), protocolData: { goalieStints: replaced, shots: full } }).map(row => row.shotsAgainst)).toEqual([8, 5]);
  });
  it("uses the five real goal times in the Bars–Vympel example, even after the old editor added period offsets", () => {
    const scorerId = "scorer";
    const legacyTimes = ["17:57", "35:41", "36:51", "42:37", "45:17"];
    const legacy = legacyTimes.map(minute => ({ teamEntryId: "away", playerId: scorerId, eventType: "Гол", minute }));
    const resolve = matchClockResolver({ eventTimesAbsolute: true }, legacy);
    const saved = [1077, 3341, 3411, 4957, 5117];
    const normalized = saved.map(seconds => resolve(seconds, "away", scorerId, "Гол"));
    expect(normalized).toEqual([1077, 2141, 2211, 2557, 2717]);
    const row = calculateMatchGoalies(match([stint("goalie", "00:00", "60:00", 34)], normalized.map(time => goal(time))))[0];
    expect(row).toMatchObject({ seconds: 3600, goalsAgainst: 5, shotsAgainst: 34, shutout: false });
    expect((((row.shotsAgainst! - row.goalsAgainst!) / row.shotsAgainst!) * 100).toFixed(1)).toBe("85.3");
    expect(matchClockResolver(null, legacy)(2557, "away", scorerId, "Гол")).toBe(2557);
    expect(matchClockResolver({ eventClockVersion: matchClockVersion }, legacy)(3341, "away", scorerId, "Гол")).toBe(3341);
  });

  it("awards a shutout starting at 55:00 in a single completed game", () => {
    const short = match([stint("goalie", "00:00", "54:59")]);
    const exact = match([stint("goalie", "00:00", "55:00")]);
    expect(calculateMatchGoalies(short)[0].shutout).toBe(false);
    expect(calculateMatchGoalies(exact)[0].shutout).toBe(true);
    expect(aggregateMatchGoalies([short, exact, { ...exact, status: "LIVE" }, { ...exact, resultType: "TECHNICAL" }]).get("home:goalie"))
      .toMatchObject({ games: 2, shutouts: 1, shotsAgainst: null });
  });

  it("adds separate stints and gives the goal at a change to the incoming goalie", () => {
    const rows = calculateMatchGoalies(match([
      stint("main", "00:00", "25:00", 10), stint("backup", "25:00", "30:00", 2), stint("main", "30:00", "60:00", 15),
    ], [goal(1500)]));
    expect(rows).toEqual([
      expect.objectContaining({ playerId: "main", seconds: 3300, goalsAgainst: 0, shotsAgainst: 25, shutout: true }),
      expect.objectContaining({ playerId: "backup", seconds: 300, goalsAgainst: 1, shotsAgainst: 2, shutout: false }),
    ]);
  });

  it("counts a goal at the final horn and ignores goals into an empty net or in the shootout", () => {
    const stints = [stint("goalie", "00:00", "60:00", 12)];
    expect(calculateMatchGoalies(match(stints, [goal(3600)]))[0]).toMatchObject({ goalsAgainst: 1, shutout: false });
    expect(calculateMatchGoalies(match(stints, [goal(3500, "EMPTY_NET")]))[0]).toMatchObject({ goalsAgainst: 0, shutout: true });
    expect(calculateMatchGoalies({
      ...match(stints), isPlayoff: true, awayScore: 1, shootoutGoals: [{ teamEntryId: "away" }],
    })[0]).toMatchObject({ goalsAgainst: 0, shutout: true });
  });

  it("does not award a shutout from incomplete goals, ambiguous time or duplicated time", () => {
    expect(calculateMatchGoalies({ ...match([stint("goalie", "00:00", "60:00")]), awayScore: 1 })[0])
      .toMatchObject({ goalsAgainst: null, shutout: false });
    expect(calculateMatchGoalies(match([stint("goalie", "00:00", "55:00")], [goal(null)]))[0])
      .toMatchObject({ goalsAgainst: null, shutout: false });
    expect(calculateMatchGoalies(match([stint("goalie", "00:00", "55:00")], [goal(4957)]))[0])
      .toMatchObject({ goalsAgainst: null, shutout: false });
    expect(calculateMatchGoalies(match([stint("goalie", "00:00", "60:00")], [goal(4957)]))[0])
      .toMatchObject({ goalsAgainst: 1, shutout: false });
    expect(calculateMatchGoalies(match([stint("goalie", "00:00", "30:00"), stint("goalie", "00:00", "30:00")]))[0])
      .toMatchObject({ seconds: 1800, shutout: false });
    expect(calculateMatchGoalies(match([]))).toEqual([]);
  });
});
