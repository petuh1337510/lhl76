import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Keep historical season classifications intact; copy only the latest known value.
  const ratings = await prisma.$executeRaw`
    WITH latest AS (
      SELECT DISTINCT ON (pc."playerId") pc."playerId", pc."categoryId"
      FROM "PlayerClassification" pc
      JOIN "Season" s ON s.id = pc."seasonId"
      ORDER BY pc."playerId", (pc."endsAt" IS NULL) DESC, s."startsAt" DESC, pc."startsAt" DESC, pc.id DESC
    )
    UPDATE "Player" p
    SET "ratingCategoryId" = latest."categoryId"
    FROM latest
    WHERE p.id = latest."playerId" AND p."ratingCategoryId" IS NULL
  `;

  // Existing roster numbers stay attached to their entries; they are not erased.
  const numbers = await prisma.$executeRaw`
    WITH latest AS (
      SELECT DISTINCT ON (r."playerId") r."playerId", btrim(r.number) AS number
      FROM "RosterEntry" r
      JOIN "TeamEntry" te ON te.id = r."teamEntryId"
      JOIN "Division" d ON d.id = te."divisionId"
      JOIN "Competition" c ON c.id = d."competitionId"
      JOIN "Season" s ON s.id = c."seasonId"
      WHERE r.number IS NOT NULL AND btrim(r.number) <> ''
      ORDER BY r."playerId", s."startsAt" DESC, c."isActive" DESC, r."updatedAt" DESC, r.id DESC
    )
    UPDATE "Player" p
    SET "baseNumber" = latest.number
    FROM latest
    WHERE p.id = latest."playerId" AND p."baseNumber" IS NULL
  `;
  console.log(`Рейтинг перенесён: ${ratings}; базовый номер перенесён: ${numbers}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
