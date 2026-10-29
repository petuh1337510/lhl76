import { expect, it } from "vitest";
import { formatPeriodScores } from "./format-period-scores";
it("formats stored period objects without changing scores or order", () => {
  expect(formatPeriodScores([{ home: 0, away: 1 }, { home: 3, away: 0 }])).toBe("0:1 · 3:0");
  expect(formatPeriodScores(["1:2", "0:0"])).toBe("1:2 · 0:0");
  expect(formatPeriodScores(null)).toBeNull();
  expect(formatPeriodScores([{}])).toBeNull();
});
