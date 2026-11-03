import { describe, expect, it } from "vitest";
import { deriveMatchProtocol } from "./match-protocol";

describe("deriveMatchProtocol", () => {
  it("derives score, periods and player statistics from events", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      status: "FINAL",
      roster: [
        { playerId: "scorer", teamEntryId: "home" },
        { playerId: "assistant", teamEntryId: "home" },
        { playerId: "guest", teamEntryId: "away" },
      ],
      goals: [
        { teamEntryId: "home", scorerId: "scorer", assist1Id: "assistant", period: 1 },
        { teamEntryId: "away", scorerId: "guest", clockSeconds: 1500 },
        { teamEntryId: "home", scorerId: "scorer", period: 3 },
      ],
      penalties: [{ teamEntryId: "home", playerId: "assistant", minutes: 4 }],
    });

    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.periodScores).toEqual([
      { home: 1, away: 0 },
      { home: 0, away: 1 },
      { home: 1, away: 0 },
    ]);
    expect(result.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "scorer", games: 1, goals: 2 }),
        expect.objectContaining({ playerId: "assistant", games: 1, assists: 1, penaltyMinutes: 4 }),
        expect.objectContaining({ playerId: "guest", games: 1, goals: 1 }),
      ]),
    );
  });

  it("does not count a missed in-game penalty shot or any shootout data", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      goals: [
        {
          teamEntryId: "home",
          scorerId: "player",
          situation: "PENALTY_SHOT",
          penaltyShotOutcome: "miss",
          period: 2,
        },
      ],
    });
    expect(result.homeScore).toBe(0);
    expect(result.contributions).toEqual([]);
  });

  it("keeps a team penalty out of every player's penalty minutes", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      status: "FINAL",
      roster: [
        { playerId: "home-player", teamEntryId: "home" },
        { playerId: "away-player", teamEntryId: "away" },
      ],
      penalties: [
        { teamEntryId: "home", playerId: "", minutes: 2 },
        { teamEntryId: "away", playerId: "away-player", minutes: 4 },
      ],
    });

    expect(result.contributions.find((row) => row.playerId === "home-player")?.penaltyMinutes).toBe(0);
    expect(result.contributions.find((row) => row.playerId === "away-player")?.penaltyMinutes).toBe(4);
    expect(result.contributions).toHaveLength(2);
  });

  it("counts a converted penalty shot as a goal and never duplicates an assist", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      goals: [
        {
          teamEntryId: "home",
          scorerId: "scorer",
          assist1Id: "assistant",
          assist2Id: "assistant",
          situation: "PENALTY_SHOT",
          penaltyShotOutcome: "goal",
          period: 1,
        },
      ],
    });
    expect(result.homeScore).toBe(1);
    expect(result.contributions).toEqual([
      expect.objectContaining({ playerId: "scorer", goals: 1 }),
      expect.objectContaining({ playerId: "assistant", assists: 1 }),
    ]);
  });

  it("derives goalkeeper totals from completed stints with entered shots", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      status: "FINAL",
      roster: [{ playerId: "goalie", teamEntryId: "home" }],
      goals: [
        { teamEntryId: "away", scorerId: "guest", clockSeconds: 610 },
        { teamEntryId: "away", scorerId: "guest", clockSeconds: 1210 },
      ],
      goalieStints: [
        {
          teamEntryId: "home",
          playerId: "goalie",
          from: "00:00",
          to: "20:00",
          shotsAgainst: 12,
        },
        {
          teamEntryId: "home",
          playerId: "goalie",
          from: "20:00",
          to: "40:00",
          shotsAgainst: 10,
        },
      ],
    });

    expect(result.contributions).toContainEqual(
      expect.objectContaining({
        playerId: "goalie",
        games: 1,
        goalieGames: 1,
        goalieSeconds: 2400,
        shotsAgainst: 22,
        goalieGoalsAgainst: 2,
      }),
    );
  });

  it("does not invent goalkeeper statistics when shots were not entered", () => {
    const result = deriveMatchProtocol({
      homeTeamEntryId: "home",
      awayTeamEntryId: "away",
      status: "FINAL",
      roster: [{ playerId: "goalie", teamEntryId: "home" }],
      goalieStints: [
        {
          teamEntryId: "home",
          playerId: "goalie",
          from: "00:00",
          to: "60:00",
          shotsAgainst: "",
        },
      ],
    });

    expect(result.contributions).toContainEqual(
      expect.objectContaining({ playerId: "goalie", games: 1, goalieGames: 0 }),
    );
  });
});
