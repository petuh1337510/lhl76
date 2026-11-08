import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({prisma: {}}));
import { getPlayerSuspensionStates } from "./player-suspensions";
import type { Prisma } from "@prisma/client";
describe("batched suspension counts", () => {
  it("uses one match query for 50 suspensions with different start dates", async () => {
    const rows = Array.from({length: 50}, (_, i) => ({id: String(i), status: "ACTIVE", matchesCount: 3, startsAt: new Date(i % 2 ? "2026-11-03" : "2026-11-01"), rosterEntry: { playerId: String(i), teamEntryId: "a", teamEntry: {team: {name: "A"}, division: {name: "D"}}}}));
    const findMany = vi.fn().mockResolvedValue([{startsAt: new Date("2026-11-02"), homeTeamEntryId: "a", awayTeamEntryId: "b"}]);
    const db = {playerSuspension: {findMany: vi.fn().mockResolvedValue(rows)}, match: {findMany}};
    const result = await getPlayerSuspensionStates(rows.map(row => row.id), new Date("2026-11-08"), "current", db as unknown as Prisma.TransactionClient);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.id).toEqual({not: "current"});
    expect(result.get("0")?.[0].remaining).toBe(2);
    expect(result.get("1")?.[0].remaining).toBe(3);
  });
  it("does not query matches without match-count suspensions", async () => {
    const db = {playerSuspension: {findMany: vi.fn().mockResolvedValue([])}, match: {findMany: vi.fn()}};
    await getPlayerSuspensionStates([], new Date(), undefined, db as unknown as Prisma.TransactionClient);
    expect(db.match.findMany).not.toHaveBeenCalled();
  });
});
