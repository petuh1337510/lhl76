import { describe, expect, it } from "vitest";
import { categoryPlayers, statisticsCategories, isDefender } from "./statistics-categories";
import type { DivisionPlayerStatistic } from "./division-page";
const player = (name: string, extra: Partial<DivisionPlayerStatistic> = {}) => ({ name, position: "Нападающий", isGoalkeeper: false, points: 2, goals: 1, assists: 1, ...extra }) as DivisionPlayerStatistic;
describe("statistics overview", () => {
  it("accepts only the defender position", () => {
    expect(isDefender(" ЗАЩИТНИК ")).toBe(true);
    for (const position of ["Нападающий", "Вратарь", "Нападающий / защитник", "", "Защита"]) expect(isDefender(position)).toBe(false);
  });
  it("has nine unique categories", () => expect(new Set(statisticsCategories.map(c => c.id)).size).toBe(9));
  it("limits defender rankings to defenders", () => {
    const result = categoryPlayers([player("A", { points: 99 }), player("B", { position: "Защитник", points: 5 })], statisticsCategories[6]);
    expect(result.map(p => p.name)).toEqual(["B"]);
  });
  it("sorts goalie average ascending and excludes missing values", () => {
    const result = categoryPlayers([player("A", { isGoalkeeper: true, goalsAgainstAverage: null }), player("B", { isGoalkeeper: true, goalsAgainstAverage: 2 }), player("C", { isGoalkeeper: true, goalsAgainstAverage: 1 })], statisticsCategories[3]);
    expect(result.map(p => p.name)).toEqual(["C", "B"]);
  });
  it("does not invent shutouts", () => expect(categoryPlayers([player("A", { isGoalkeeper: true })], statisticsCategories[5])).toEqual([]));
});
