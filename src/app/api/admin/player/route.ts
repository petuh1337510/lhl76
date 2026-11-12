import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {editVersion,nextEditVersion} from '@/lib/edit-version';
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";
import { deleteAdminCard } from "@/lib/admin-card-deletion";

function serialize(player: any, activeSuspensions: any[] = []) {
  return {
    id: player.id,
    updatedAt: player.updatedAt.toISOString(),
    slug: player.slug,
    firstName: player.firstName,
    lastName: player.lastName,
    patronymic: player.patronymic ?? "",
    nativeName: player.nativeName ?? "",
    birthDate: player.birthDate ? player.birthDate.toISOString().slice(0, 10) : "",
    country: player.country ?? "",
    birthPlace: player.birthPlace ?? "",
    position: player.position ?? "",
    stickHand: player.stickHand ?? "",
    heightCm: player.heightCm ?? "",
    weightKg: player.weightKg ?? "",
    league: player.league ?? "",
    baseNumber: player.baseNumber ?? "",
    ratingCategoryId: player.ratingCategoryId ?? "",
    rating: player.ratingCategory?.name ?? "",
    photoUrl: player.photoUrl ?? "",
    laureatePhotoUrl: player.laureatePhotoUrl ?? "",
    assignments: [...player.rosterEntries]
      .sort((left: any, right: any) => {
        const leftCompetition = left.teamEntry.division.competition;
        const rightCompetition = right.teamEntry.division.competition;
        return rightCompetition.season.startsAt.getTime() - leftCompetition.season.startsAt.getTime()
          || Number(rightCompetition.type === "CHAMPIONSHIP") - Number(leftCompetition.type === "CHAMPIONSHIP")
          || leftCompetition.name.localeCompare(rightCompetition.name, "ru")
          || left.teamEntry.division.name.localeCompare(right.teamEntry.division.name, "ru")
          || left.teamEntry.team.name.localeCompare(right.teamEntry.team.name, "ru")
          || left.id.localeCompare(right.id);
      })
      .map((entry: any) => ({
      id: entry.id,
      updatedAt: entry.updatedAt.toISOString(),
      teamEntryId: entry.teamEntryId,
      season: entry.teamEntry.division.competition.season.name,
      competition: entry.teamEntry.division.competition.name,
      competitionType: entry.teamEntry.division.competition.type,
      division: entry.teamEntry.division.name,
      team: entry.teamEntry.team.name,
      number: entry.number ?? player.baseNumber ?? "",
      numberOverride: entry.number ?? "",
      leadership: entry.leadership,
      status: entry.status === "INACTIVE" ? "INACTIVE" : activeSuspensions.length ? "SUSPENDED" : "ACTIVE",
      suspensions: activeSuspensions,
      })),
  };
}

async function handleGET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("categories")) {
    const categories = await prisma.classificationCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
    return NextResponse.json({ categories });
  }
  const slug = request.nextUrl.searchParams.get("slug");
  const id = request.nextUrl.searchParams.get("id");
  const [player, categories] = await Promise.all([prisma.player.findFirst({
    where: { deletedAt: null, ...(id ? { id } : slug ? { slug } : {}) },
    include: { ratingCategory: true, rosterEntries: { include: { suspensions: { orderBy: { createdAt: "desc" } }, teamEntry: { include: { team: true, division: { include: { competition: { include: { season: true } } } } } } } } },
  }), prisma.classificationCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })]);
  if (!player) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
  const activeSuspensions = await getPlayerSuspensionStates([player.id], new Date());
  return NextResponse.json({ ...serialize(player, activeSuspensions.get(player.id) || []), categories: categories.map(({ id, name }) => ({ id, name })) });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Не указан игрок" }, { status: 400 });
  const version=editVersion(body.expectedUpdatedAt);
  const ratingCategoryId = String(body.ratingCategoryId ?? "").trim();
  if (ratingCategoryId && !(await prisma.classificationCategory.findFirst({ where: { id: ratingCategoryId, active: true } }))) {
    return NextResponse.json({ error: "Неизвестный рейтинг" }, { status: 400 });
  }
  const player = await prisma.player.update({
    where: { id: body.id, updatedAt: version, deletedAt: null },
    data: {
      updatedAt: nextEditVersion(version),
      firstName: body.firstName,
      lastName: body.lastName,
      patronymic: body.patronymic || null,
      nativeName: body.nativeName || null,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      country: body.country || null,
      birthPlace: body.birthPlace || null,
      position: body.position || null,
      stickHand: body.stickHand || null,
      heightCm: body.heightCm ? Number(body.heightCm) : null,
      weightKg: body.weightKg ? Number(body.weightKg) : null,
      league: body.league || null,
      baseNumber: String(body.baseNumber ?? "").trim() || null,
      ratingCategoryId: ratingCategoryId || null,
      photoUrl: body.photoUrl || null,
      laureatePhotoUrl: body.laureatePhotoUrl || null,
    },
    include: { ratingCategory: true, rosterEntries: { include: { suspensions: { orderBy: { createdAt: "desc" } }, teamEntry: { include: { team: true, division: { include: { competition: { include: { season: true } } } } } } } } },
  });
  const categories = await prisma.classificationCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const activeSuspensions = await getPlayerSuspensionStates([player.id], new Date());
  return NextResponse.json({ ...serialize(player, activeSuspensions.get(player.id) || []), categories: categories.map(({ id, name }) => ({ id, name })) });
}

export const GET = withAdmin(handleGET);
export const PATCH = withAdmin(handlePATCH);
export const DELETE = deleteAdminCard("player");
