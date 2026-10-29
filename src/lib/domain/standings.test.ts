import { describe, expect, it } from "vitest";
import { calculateStandings } from "./standings";

describe("турнирная таблица", () => {
  it("начисляет 2 очка за победу и 1 за ничью", () => {
    const table = calculateStandings([{ home: "A", away: "B", homeGoals: 3, awayGoals: 1 }, { home: "A", away: "C", homeGoals: 2, awayGoals: 2 }]);
    expect(table[0]).toMatchObject({ team: "A", games: 2, wins: 1, draws: 1, points: 3 });
  });

  it("при равенстве очков сначала учитывает очки в личных встречах", () => {
    const table = calculateStandings([
      { home: "Альянс", away: "Балтика", homeGoals: 1, awayGoals: 2 },
      { home: "Альянс", away: "Волки", homeGoals: 3, awayGoals: 1 },
      { home: "Балтика", away: "Волки", homeGoals: 0, awayGoals: 2 },
    ]);
    expect(table.map((row) => row.team)).toEqual(["Альянс", "Волки", "Балтика"]);
  });

  it("в последнюю очередь предпочитает команду с меньшим количеством штрафных минут", () => {
    const table = calculateStandings([
      { home: "Танки", away: "Волки", homeGoals: 2, awayGoals: 1, homePenaltyMinutes: 10, awayPenaltyMinutes: 4 },
      { home: "Волки", away: "Танки", homeGoals: 2, awayGoals: 1, homePenaltyMinutes: 4, awayPenaltyMinutes: 10 },
    ]);
    expect(table[0].team).toBe("Волки");
  });

  it("учитывает технический результат без шайб в разнице голов", () => {
    const table = calculateStandings([
      { home: "А", away: "Б", homeGoals: 0, awayGoals: 0, homePenaltyMinutes: 20, awayPenaltyMinutes: 10, technicalWinner: "А", excludeGoals: true },
    ]);
    expect(table[0]).toMatchObject({ team: "А", games: 1, wins: 1, points: 2, goalsFor: 0, goalsAgainst: 0, penaltyMinutes: 0 });
    expect(table[1]).toMatchObject({ team: "Б", games: 1, losses: 1, points: 0, goalsFor: 0, goalsAgainst: 0, penaltyMinutes: 0 });
  });
});
