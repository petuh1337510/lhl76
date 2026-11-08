import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const playerFields = ["firstName", "patronymic", "country", "birthPlace", "league"] as const;
const limit = 10;

async function popularValues(table: "Player" | "Team", field: (typeof playerFields)[number] | "city") {
  // SQL identifiers come only from the fixed allowlist above, never from the request.
  const column = Prisma.raw(`"${field}"`);
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    SELECT btrim(${column}) AS value
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE "deletedAt" IS NULL AND btrim(${column}) <> ''
    GROUP BY 1
    ORDER BY count(*) DESC, value ASC
    LIMIT ${limit}
  `;
  return rows.map(row => row.value);
}

export const GET = withAdmin(async request => {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "player") {
    const fields = await Promise.all(playerFields.map(async field => [field, await popularValues("Player", field)] as const));
    return NextResponse.json(Object.fromEntries(fields));
  }
  if (scope === "city") {
    return NextResponse.json({ city: await popularValues("Team", "city") });
  }
  return NextResponse.json({ error: "Неизвестный тип подсказок." }, { status: 400 });
});
