import { describe, expect, it } from "vitest";
import { calculateGoalieMetrics } from "./goalie-statistics";

describe("goalkeeper statistics", () => {
  it("calculates saves, save percentage and goals-against average", () => {
    expect(calculateGoalieMetrics(3600, 40, 2)).toEqual({
      saves: 38,
      savePercentage: 95,
      goalsAgainstAverage: 2,
    });
  });

  it("does not invent rates without shots or played time", () => {
    expect(calculateGoalieMetrics(0, 0, 0)).toEqual({
      saves: 0,
      savePercentage: null,
      goalsAgainstAverage: null,
    });
  });

  it("never returns a negative saves count for incomplete source data", () => {
    expect(calculateGoalieMetrics(1200, 1, 2).saves).toBe(0);
  });
});
