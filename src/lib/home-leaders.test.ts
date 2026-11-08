import { expect, it } from "vitest";
import { compactHomeLeaders, homeLeaderCategories, homeLeaderRows } from "./home-leaders";
import type { DivisionPlayerStatistic } from "./division-page";

it("preserves all five leaderboards including ties and goalie eligibility", () => {
  const players = Array.from({length: 300}, (_, i) => ({key: String(i), points: i % 10, goals: i % 7, assists: i % 9, isGoalkeeper: i % 6 === 0, goalsAgainstAverage: i % 5 === 0 ? null : i % 4, savePercentage: i % 5 === 0 ? null : i % 100})) as DivisionPlayerStatistic[];
  const compact = compactHomeLeaders(players);
  expect(compact.length).toBeLessThanOrEqual(25);
  for (const category of homeLeaderCategories) expect(homeLeaderRows(compact, category)).toEqual(homeLeaderRows(players, category));
});
