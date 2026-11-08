import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {editVersion,nextEditVersion} from '@/lib/edit-version';
import { deleteAdminCard } from "@/lib/admin-card-deletion";

function achievementsText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "string") return value;
  return "";
}

async function handleGET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("choices")) {
    const divisions = await prisma.division.findMany({ include: { competition: { include: { season: true } } }, orderBy: [{ competition: { season: { startsAt: "desc" } } }, { sortOrder: "asc" }] });
    return NextResponse.json(divisions.map((division) => ({ id: division.id, division: division.name, competitionId: division.competition.id, competition: division.competition.name, season: division.competition.season.name })));
  }
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Не указана команда" }, { status: 400 });
  const team = await prisma.team.findUnique({ where: { slug, deletedAt: null }, include: { entries: { include: { division: { include: { competition: { include: { season: true } } } }, _count: { select: { roster: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!team) return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
  return NextResponse.json({ ...team, achievements: achievementsText(team.achievements), entries: team.entries.map((entry) => ({ id: entry.id, season: entry.division.competition.season.name, competition: entry.division.competition.name, division: entry.division.name, players: entry._count.roster })) });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  const version=editVersion(body.expectedUpdatedAt);
  const team = await prisma.team.update({
    where: { id: body.id, updatedAt: version, deletedAt: null },
    data: {
      updatedAt: nextEditVersion(version),
      name: body.name,
      shortName: body.shortName || body.name,
      city: body.city || null,
      shortDescription: body.shortDescription || null,
      description: body.description || null,
      achievements: body.achievements ? body.achievements.split(/\r?\n/).filter(Boolean) : [],
      logoUrl: body.logoUrl || null,
      calendarAccent: body.calendarAccent === undefined ? undefined : body.calendarAccent?.toLowerCase() || null,
      teamPhotoUrl: body.teamPhotoUrl || null,
      vkUrl: body.vkUrl || null,
      telegramUrl: body.telegramUrl || null,
      websiteUrl: body.websiteUrl || null,
    },
  });
  return NextResponse.json(team);
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!body.teamId || !body.divisionId) return NextResponse.json({ error: "Команда и дивизион обязательны" }, { status: 400 });
  const entry = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Division" WHERE id = ${body.divisionId} FOR KEY SHARE`;
    await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${body.teamId} FOR UPDATE`;
    const team = await tx.team.findUnique({ where: { id: body.teamId, deletedAt: null }, select: { id: true } });
    if (!team) return null;
    return tx.teamEntry.upsert({ where: { teamId_divisionId: { teamId: body.teamId, divisionId: body.divisionId } }, create: { teamId: body.teamId, divisionId: body.divisionId }, update: {}, include: { division: { include: { competition: { include: { season: true } } } } } });
  });
  if (!entry) return NextResponse.json({ error: "Команда удалена или не найдена." }, { status: 404 });
  return NextResponse.json(entry);
}

export const GET = withAdmin(handleGET);
export const PATCH = withAdmin(handlePATCH);
export const POST = withAdmin(handlePOST);
export const DELETE = deleteAdminCard("team");
