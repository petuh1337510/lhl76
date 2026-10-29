import { describe, expect, it } from "vitest";
import { groupLegacyCompetitions, legacyPlayerFieldMap, legacySeason2023_24 } from "./legacy-2023-24";

describe("карта старого сезона 2023/24", () => {
  it("объединяет семь записей JoomSport в три соревнования", () => {
    const competitions = groupLegacyCompetitions();
    expect(legacySeason2023_24).toHaveLength(7);
    expect(competitions.size).toBe(3);
    expect([...competitions.values()].map((items) => items.length).sort()).toEqual([2, 2, 3]);
  });

  it("содержит ровно один чемпионат", () => {
    const championships = [...groupLegacyCompetitions().values()].filter((items) => items[0].competitionType === "CHAMPIONSHIP");
    expect(championships).toHaveLength(1);
  });

  it("не переносит старое поле статуса игрока", () => {
    expect(Object.values(legacyPlayerFieldMap.extra)).not.toContain(9);
  });
});
