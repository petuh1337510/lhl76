import { Prisma } from "@prisma/client";

export function rebuildPlayerStatisticsQuery(divisionId: string) {
  return Prisma.sql`
    WITH division AS (
      SELECT ${divisionId}::text AS id
    ), entries AS (
      SELECT id FROM "TeamEntry" WHERE "divisionId" = (SELECT id FROM division)
    ), matches AS (
      SELECT id, status, "homeTeamEntryId", "awayTeamEntryId"
      FROM "Match"
      WHERE "divisionId" = (SELECT id FROM division)
        AND status IN ('FINAL', 'LIVE') AND "resultType" <> 'TECHNICAL'
    ), events AS (
      SELECT DISTINCT r."matchId", e."teamEntryId", e."playerId",
        1 AS games, 0 AS goals, 0 AS assists, 0 AS penalties
      FROM "MatchRoster" r
      JOIN "RosterEntry" e ON e.id = r."rosterEntryId"
      JOIN matches m ON m.id = r."matchId" AND m.status = 'FINAL'
        AND e."teamEntryId" IN (m."homeTeamEntryId", m."awayTeamEntryId")
      UNION ALL
      SELECT g."matchId", g."teamEntryId", g."scorerId", 0, 1, 0, 0
      FROM "Goal" g JOIN matches m ON m.id = g."matchId"
        AND g."teamEntryId" IN (m."homeTeamEntryId", m."awayTeamEntryId")
      UNION ALL
      SELECT a."matchId", a."teamEntryId", a."playerId", 0, 0, 1, 0
      FROM "Assist" a JOIN matches m ON m.id = a."matchId"
        AND a."teamEntryId" IN (m."homeTeamEntryId", m."awayTeamEntryId")
      UNION ALL
      SELECT p."matchId", p."teamEntryId", p."playerId", 0, 0, 0, p.minutes
      FROM "Penalty" p JOIN matches m ON m.id = p."matchId"
        AND p."teamEntryId" IN (m."homeTeamEntryId", m."awayTeamEntryId")
      WHERE p."playerId" IS NOT NULL AND p.minutes <> 0
    ), calculated AS (
      SELECT "teamEntryId", "playerId", sum(games)::int AS games, sum(goals)::int AS goals,
        sum(assists)::int AS assists, sum(penalties)::int AS "penaltyMinutes"
      FROM events JOIN entries ON entries.id = events."teamEntryId"
      GROUP BY "teamEntryId", "playerId"
    ), stored AS (
      SELECT ps.* FROM "PlayerStatistic" ps JOIN entries ON entries.id = ps."teamEntryId"
    )
    INSERT INTO "PlayerStatistic"
      (id, "teamEntryId", "playerId", games, goals, assists, "penaltyMinutes", "updatedAt")
    SELECT gen_random_uuid()::text, "teamEntryId", "playerId",
      coalesce(c.games, 0), coalesce(c.goals, 0), coalesce(c.assists, 0),
      coalesce(c."penaltyMinutes", 0), now()
    FROM calculated c FULL JOIN stored s USING ("teamEntryId", "playerId")
    WHERE (coalesce(c.games, 0), coalesce(c.goals, 0), coalesce(c.assists, 0), coalesce(c."penaltyMinutes", 0))
      IS DISTINCT FROM
      (coalesce(s.games, 0), coalesce(s.goals, 0), coalesce(s.assists, 0), coalesce(s."penaltyMinutes", 0))
    ON CONFLICT ("playerId", "teamEntryId") DO UPDATE
      SET games = excluded.games, goals = excluded.goals, assists = excluded.assists,
        "penaltyMinutes" = excluded."penaltyMinutes", "updatedAt" = excluded."updatedAt"
  `;
}
