import { describe, expect, it } from "vitest";
import { calculateDivisionStatistics } from "./division-statistics";

describe("canonical division statistics", () => {
  it("rebuilds team totals and keeps teams without completed matches", () => {
    const rows = calculateDivisionStatistics(
      ["home", "away", "idle"],
      [
        {
          home: "home",
          away: "away",
          homeGoals: 4,
          awayGoals: 2,
        },
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({ teamEntryId: "home", rank: 1, games: 1, wins: 1, points: 2 }),
      expect.objectContaining({ teamEntryId: "away", rank: 2, games: 1, losses: 1, points: 0 }),
      expect.objectContaining({ teamEntryId: "idle", rank: 3, games: 0, points: 0 }),
    ]);
  });

  it("is a full rebuild, so changing a result cannot double-count a match", () => {
    const first = calculateDivisionStatistics(
      ["a", "b"],
      [{ home: "a", away: "b", homeGoals: 2, awayGoals: 1 }],
    );
    const corrected = calculateDivisionStatistics(
      ["a", "b"],
      [{ home: "a", away: "b", homeGoals: 2, awayGoals: 2 }],
    );

    expect(first[0]).toMatchObject({ games: 1, wins: 1, draws: 0, points: 2 });
    expect(corrected[0]).toMatchObject({ games: 1, wins: 0, draws: 1, points: 1 });
  });
});
