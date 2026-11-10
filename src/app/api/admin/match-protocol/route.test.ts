import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const database = vi.hoisted(() => {
  const deleteMany = vi.fn();
  const tx = {
    $executeRaw: vi.fn(),
    match: { updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    assist: { deleteMany },
    goal: { deleteMany, create: vi.fn() },
    penalty: { deleteMany },
    penaltyShot: { deleteMany },
    matchRoster: { deleteMany },
    teamEntry: { findMany: vi.fn() },
    teamStatistic: { upsert: vi.fn() },
    standing: { deleteMany, createMany: vi.fn() },
  };
  return { tx, findMatch: vi.fn(), transaction: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
vi.mock("@/lib/prisma", () => ({
  prisma: { match: { findUnique: database.findMatch }, $transaction: database.transaction },
}));
vi.mock("@/lib/player-suspensions", () => ({ getPlayerSuspensionStates: () => new Map() }));

const version = new Date("2026-11-10T00:00:00Z");
const match = { id: "match", divisionId: "division", homeTeamEntryId: "home", awayTeamEntryId: "away", updatedAt: version };

function save(protocolData: Record<string, unknown>, status = "FINAL") {
  return PUT(new NextRequest("http://localhost/api/admin/match-protocol", {
    method: "PUT",
    body: JSON.stringify({ matchId: match.id, expectedUpdatedAt: version.toISOString(), status, protocolData }),
  }));
}

describe("manual match result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.findMatch.mockResolvedValue(match);
    database.transaction.mockImplementation((callback) => callback(database.tx));
    database.tx.match.updateMany.mockResolvedValue({ count: 1 });
    database.tx.match.update.mockResolvedValue({ updatedAt: version });
    database.tx.teamEntry.findMany.mockResolvedValue([{ id: "home" }, { id: "away" }]);
    database.tx.match.findMany.mockImplementation(() => {
      const saved = database.tx.match.update.mock.lastCall?.[0].data;
      return [{ ...match, ...saved, penalties: [] }];
    });
  });

  it("persists a final score without goal events and updates the standings", async () => {
    const manualScore = { home: 4, away: 0 };
    const response = await save({ manualScore });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ score: manualScore, periodScores: [] });
    expect(database.tx.match.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FINAL", homeScore: 4, awayScore: 0, protocolData: expect.objectContaining({ manualScore }) }),
    }));
    expect(database.tx.goal.create).not.toHaveBeenCalled();
    expect(database.tx.teamStatistic.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamEntryId: "home" },
      update: expect.objectContaining({ wins: 1, goalsFor: 4, goalsAgainst: 0 }),
    }));
  });

  it("keeps a saved score unless explicitly returned to goal-based scoring", async () => {
    const manualScore = { home: 4, away: 0 };
    database.findMatch.mockResolvedValue({ ...match, protocolData: { manualScore } });
    expect(await (await save({ staffNote: "Секретарь" })).json()).toMatchObject({ score: manualScore });
    expect(await (await save({ manualScore: null })).json()).toMatchObject({ score: { home: 0, away: 0 } });
  });

  it("rejects incomplete, non-final and drawn playoff scores before writing", async () => {
    expect((await save({ manualScore: { home: 2 } })).status).toBe(400);
    expect((await save({ manualScore: { home: 2, away: 1 } }, "LIVE")).status).toBe(400);
    database.findMatch.mockResolvedValue({ ...match, isPlayoff: true });
    expect((await save({ manualScore: { home: 1, away: 1 } })).status).toBe(400);
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
