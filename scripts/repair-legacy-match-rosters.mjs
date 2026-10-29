import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { readLegacySeason } from "./lib/legacy-2023-24-data.mjs";

const sqlPath = process.argv[2];
if (!sqlPath || !fs.existsSync(sqlPath)) {
  console.error("Usage: node scripts/repair-legacy-match-rosters.mjs <dump.sql>");
  process.exit(1);
}

const db = new PrismaClient();
const sources = await db.legacyImportMap.findMany({
  where: { entityType: "season", source: { startsWith: "joomsport:lhlnew:" } },
  select: { source: true },
  distinct: ["source"],
});

const summary = [];
for (const { source } of sources) {
  const mappings = await db.legacyImportMap.findMany({ where: { source } });
  const divisionIds = mappings
    .filter((row) => row.entityType === "division")
    .map((row) => Number(row.legacyId))
    .filter(Number.isFinite);
  const data = await readLegacySeason(sqlPath, divisionIds.map((id) => ({ id })));
  const matchMap = new Map(mappings.filter((row) => row.entityType === "match").map((row) => [Number(row.legacyId), row.entityId]));
  const playerMap = new Map(mappings.filter((row) => row.entityType === "player").map((row) => [Number(row.legacyId), row.entityId]));
  const teamMap = new Map(mappings.filter((row) => row.entityType === "team").map((row) => [Number(row.legacyId), row.entityId]));
  const matchIds = [...matchMap.values()];
  const matches = await db.match.findMany({
    where: { id: { in: matchIds } },
    include: { homeTeamEntry: true, awayTeamEntry: true },
  });
  const matchById = new Map(matches.map((row) => [row.id, row]));
  const teamEntryIds = [...new Set(matches.flatMap((row) => [row.homeTeamEntryId, row.awayTeamEntryId]))];
  const rosterEntries = await db.rosterEntry.findMany({ where: { teamEntryId: { in: teamEntryIds } } });
  const rosterByTeamPlayer = new Map(rosterEntries.map((row) => [`${row.teamEntryId}:${row.playerId}`, row]));
  const repaired = new Map();

  for (const row of data.squad.filter((item) => String(item.squad_type) === "1")) {
    const matchId = matchMap.get(Number(row.match_id));
    const playerId = playerMap.get(Number(row.player_id));
    const teamId = teamMap.get(Number(row.team_id));
    const match = matchId ? matchById.get(matchId) : null;
    if (!match || !playerId || !teamId) continue;
    const teamEntryId = match.homeTeamEntry.teamId === teamId
      ? match.homeTeamEntryId
      : match.awayTeamEntry.teamId === teamId
        ? match.awayTeamEntryId
        : null;
    if (!teamEntryId) continue;
    const roster = rosterByTeamPlayer.get(`${teamEntryId}:${playerId}`);
    if (!roster) continue;
    repaired.set(`${matchId}:${roster.id}`, {
      id: randomUUID(),
      matchId,
      rosterEntryId: roster.id,
      numberOverride: String(row.match_num || "").trim() || null,
    });
  }

  await db.$transaction(async (tx) => {
    await tx.matchRoster.deleteMany({ where: { matchId: { in: matchIds } } });
    const rows = [...repaired.values()];
    for (let index = 0; index < rows.length; index += 750) {
      await tx.matchRoster.createMany({ data: rows.slice(index, index + 750) });
    }

    await tx.playerStatistic.updateMany({
      where: { teamEntryId: { in: teamEntryIds } },
      data: { games: 0 },
    });
    const finalRosterRows = await tx.matchRoster.findMany({
      where: { matchId: { in: matches.filter((match) => match.status === "FINAL").map((match) => match.id) } },
      include: { rosterEntry: true },
    });
    const games = new Map();
    for (const row of finalRosterRows) {
      const key = `${row.rosterEntry.teamEntryId}:${row.rosterEntry.playerId}`;
      games.set(key, (games.get(key) || 0) + 1);
    }
    for (const [key, count] of games) {
      const [teamEntryId, playerId] = key.split(":");
      await tx.playerStatistic.updateMany({ where: { teamEntryId, playerId }, data: { games: count } });
    }
  }, { maxWait: 30_000, timeout: 600_000 });

  summary.push({ source, matches: matches.length, matchRosters: repaired.size });
}

console.log(JSON.stringify(summary, null, 2));
await db.$disconnect();
