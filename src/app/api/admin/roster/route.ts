import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {editVersion,nextEditVersion,WriteConflict} from '@/lib/edit-version';
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";

async function handleGET(request: NextRequest) {
  const teamEntryId = request.nextUrl.searchParams.get("teamEntryId");
  const choices = request.nextUrl.searchParams.get("choices");
  if (choices) {
    const entries = await prisma.teamEntry.findMany({ include: { team: true, division: { include: { competition: { include: { season: true } } } } }, orderBy: { team: { name: "asc" } } });
    return NextResponse.json(entries.map((entry) => ({
      id: entry.id,
      team: entry.team.name,
      division: entry.division.name,
      divisionId: entry.division.id,
      competition: entry.division.competition.name,
      competitionId: entry.division.competition.id,
      season: entry.division.competition.season.name,
    })));
  }
  if (!teamEntryId) return NextResponse.json({ error: "Не указана заявка команды" }, { status: 400 });
  const teamEntry = await prisma.teamEntry.findUnique({ where: { id: teamEntryId }, include: { team: true, division: { include: { competition: { include: { season: true } } } }, roster: { include: { suspensions: { orderBy: { createdAt: "desc" } }, player: { include: { ratingCategory: true } } } } } });
  if (!teamEntry) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  const categories = await prisma.classificationCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const activeSuspensions = await getPlayerSuspensionStates(teamEntry.roster.map((item) => item.playerId), new Date());
  return NextResponse.json({
    entry: { id: teamEntry.id, team: teamEntry.team, season: teamEntry.division.competition.season.name, competition: teamEntry.division.competition.name, division: teamEntry.division.name },
    categories,
    roster: teamEntry.roster.map((item) => ({ id: item.id, updatedAt:item.updatedAt, playerId: item.playerId, number: item.number ?? item.player.baseNumber ?? "", numberOverride: item.number ?? "", leadership: item.leadership, status: item.status === "SUSPENDED" ? "ACTIVE" : item.status, suspensions: activeSuspensions.get(item.playerId) || [], player: item.player, classification: item.player.ratingCategory ?? null })).sort((a, b) => a.player.lastName.localeCompare(b.player.lastName, "ru") || a.player.firstName.localeCompare(b.player.firstName, "ru")),
  });
}

async function validRating(categoryId: unknown) {
  if (categoryId === undefined) return true;
  if (typeof categoryId !== "string") return false;
  if (!categoryId) return true;
  return Boolean(await prisma.classificationCategory.findFirst({ where: { id: categoryId, active: true }, select: { id: true } }));
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!body.playerId || !body.teamEntryId) return NextResponse.json({ error: "Игрок и заявка обязательны" }, { status: 400 });
  if (!(await validRating(body.categoryId))) return NextResponse.json({ error: "Неизвестный рейтинг" }, { status: 400 });
  const player = await prisma.player.findUnique({ where: { id: body.playerId }, select: { id: true, baseNumber: true } });
  if (!player) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
  const requestedNumber = String(body.number ?? "").trim();
  const numberOverride = requestedNumber && requestedNumber !== player.baseNumber ? requestedNumber : null;
  const entry = await prisma.$transaction(async tx=>{
   const created=await tx.rosterEntry.create({
    data: { teamEntryId: body.teamEntryId, playerId: body.playerId, number: numberOverride, leadership: body.leadership || "NONE", status: body.status || "ACTIVE" },
    include: { player: true },
   });
   if(body.categoryId!==undefined&&created.player.ratingCategoryId!==(body.categoryId||null)){
    const version=editVersion(body.playerExpectedUpdatedAt);
    await tx.player.update({where:{id:player.id,updatedAt:version},data:{ratingCategoryId:body.categoryId||null,updatedAt:nextEditVersion(version)}});
   }
   return created;
  });
  return NextResponse.json(entry);
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Не указан участник заявки" }, { status: 400 });
  if (!(await validRating(body.categoryId))) return NextResponse.json({ error: "Неизвестный рейтинг" }, { status: 400 });
  const version=editVersion(body.expectedUpdatedAt);
  const entry=await prisma.$transaction(async tx=>{
  const current = await tx.rosterEntry.findUnique({ where: { id: body.id }, include: { player: { select: { baseNumber: true,ratingCategoryId:true } } } });
  if (!current) throw new WriteConflict();
  const requestedNumber = body.number === undefined ? current.number : String(body.number).trim();
  const numberOverride = body.number === undefined || requestedNumber === current.number
    ? current.number
    : requestedNumber && requestedNumber !== current.player.baseNumber ? requestedNumber : null;
  const status = body.status ?? current.status;
  const updated = await tx.rosterEntry.update({ where: { id: body.id,updatedAt:version }, data: { updatedAt:nextEditVersion(version),number: numberOverride, leadership: body.leadership ?? current.leadership, status, leftAt: status === "INACTIVE" ? current.leftAt ?? new Date() : null } });
  if(body.categoryId!==undefined&&current.player.ratingCategoryId!==(body.categoryId||null)){
   const playerVersion=editVersion(body.playerExpectedUpdatedAt);
   await tx.player.update({where:{id:updated.playerId,updatedAt:playerVersion},data:{ratingCategoryId:body.categoryId||null,updatedAt:nextEditVersion(playerVersion)}});
  }
  return updated;
  });
  return NextResponse.json(entry);
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
