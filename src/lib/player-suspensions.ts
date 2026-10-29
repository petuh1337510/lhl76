import { prisma } from "@/lib/prisma";
import type {Prisma} from '@prisma/client';
import { isMatchSuspensionBlocking, suspensionRemaining } from "@/lib/domain/suspensions";

export async function getPlayerSuspensionStates(playerIds: string[], moment: Date, excludeMatchId?: string,db:Prisma.TransactionClient=prisma) {
  const suspensions = await db.playerSuspension.findMany({
    where: { status: "ACTIVE", rosterEntry: { playerId: { in: playerIds } }, startsAt: { lte: moment } },
    include: { rosterEntry: { select: { playerId: true, teamEntryId: true, teamEntry: { select: { team: { select: { name: true } }, division: { select: { name: true } } } } } } },
  });
  const results = new Map<string, Array<{ id: string; updatedAt:Date; status: "ACTIVE"; reason: string; note: string | null; sourceTeam: string; sourceDivision: string; matchesCount: number | null; remaining: number | null; startsAt: Date }>>();
  for (const suspension of suspensions) {
    const source = suspension.rosterEntry;
    const completed = suspension.matchesCount ? await db.match.count({
      where: {
        id: excludeMatchId ? { not: excludeMatchId } : undefined,
        status: "FINAL",
        startsAt: { gt: suspension.startsAt, lt: moment },
        OR: [{ homeTeamEntryId: source.teamEntryId }, { awayTeamEntryId: source.teamEntryId }],
      },
    }) : 0;
    if (!isMatchSuspensionBlocking(suspension, moment, completed)) continue;
    const value = { id: suspension.id, updatedAt:suspension.updatedAt, status: "ACTIVE" as const, reason: suspension.reason, note: suspension.note, sourceTeam: source.teamEntry.team.name, sourceDivision: source.teamEntry.division.name, matchesCount: suspension.matchesCount, remaining: suspension.matchesCount ? suspensionRemaining(suspension.matchesCount, completed) : null, startsAt: suspension.startsAt };
    results.set(source.playerId, [...(results.get(source.playerId) || []), value]);
  }
  return results;
}
