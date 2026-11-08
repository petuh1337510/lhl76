import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx } = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), player: { updateMany: vi.fn() }, team: { updateMany: vi.fn() } };
  const db = {
    $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
    player: { findUnique: vi.fn() }, team: { findUnique: vi.fn() },
  };
  return { db, tx };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));

import { deleteAdminCard } from "./admin-card-deletion";

const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-11-01T12:00:00.000Z";
const request = (kind: "player" | "team", expectedUpdatedAt = version) => new NextRequest(`http://localhost/api/admin/${kind}`, {
  method: "DELETE", body: JSON.stringify({ id, expectedUpdatedAt }),
});

describe("admin card deletion", () => {
  beforeEach(() => vi.resetAllMocks());

  it("marks only an unchanged player without roster or protocol history as deleted", async () => {
    tx.player.updateMany.mockResolvedValue({ count: 1 });
    expect((await deleteAdminCard("player")(request("player"))).status).toBe(200);
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain('FROM "Player"');
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(tx.player.updateMany).toHaveBeenCalledWith({
      where: {
        id, deletedAt: null, updatedAt: new Date(version),
        rosterEntries: { none: {} }, classifications: { none: {} }, statistics: { none: {} },
        goals: { none: {} }, assists: { none: {} }, penalties: { none: {} },
        legacyEvents: { none: {} }, penaltyShots: { none: {} }, facedPenaltyShots: { none: {} },
      },
      data: { deletedAt: expect.any(Date), updatedAt: expect.any(Date) },
    });
  });

  it("returns a conflict for a team linked to a competition", async () => {
    tx.team.updateMany.mockResolvedValue({ count: 0 });
    db.team.findUnique.mockResolvedValue({ updatedAt: new Date(version), deletedAt: null });
    const response = await deleteAdminCard("team")(request("team"));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/привязана/);
    expect(tx.team.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, deletedAt: null, updatedAt: new Date(version), entries: { none: {} } },
    }));
  });

  it("distinguishes stale and already deleted cards", async () => {
    tx.team.updateMany.mockResolvedValue({ count: 0 });
    db.team.findUnique.mockResolvedValueOnce({ updatedAt: new Date(), deletedAt: null })
      .mockResolvedValueOnce({ updatedAt: new Date(), deletedAt: new Date() });
    const stale = await deleteAdminCard("team")(request("team"));
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toMatch(/изменилась/);
    expect((await deleteAdminCard("team")(request("team"))).status).toBe(404);
  });
});
