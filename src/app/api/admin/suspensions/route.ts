import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {editVersion,nextEditVersion,WriteConflict} from '@/lib/edit-version';
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";
import { parseSuspensionStartDate } from "@/lib/domain/suspensions";

const allowedStatuses = new Set(["ACTIVE", "COMPLETED", "CANCELLED"]);

async function handleGET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const items = await prisma.playerSuspension.findMany({
    include: {
      rosterEntry: {
        include: {
          player: true,
          teamEntry: {
            include: {
              team: true,
              division: { include: { competition: { include: { season: true } } } },
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
  });
  const active = await getPlayerSuspensionStates(items.map((item) => item.rosterEntry.playerId), new Date());
  const now = Date.now();
  const enriched = items.map((item) => {
    const current = active.get(item.rosterEntry.playerId)?.find((value) => value.id === item.id);
    const isFuture = item.startsAt.getTime() > now;
    return { ...item, remaining: current?.remaining ?? (isFuture ? item.matchesCount : item.status === "ACTIVE" ? 0 : null), effectiveStatus: item.status === "ACTIVE" && !current && !isFuture ? "COMPLETED" : item.status };
  });
  return NextResponse.json({ items: status && allowedStatuses.has(status) ? enriched.filter((item) => item.effectiveStatus === status) : enriched });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (!body.rosterEntryId || !String(body.reason || "").trim())
    return NextResponse.json(
      { error: "Укажите игрока и причину дисквалификации" },
      { status: 400 },
    );
  const rosterEntry = await prisma.rosterEntry.findUnique({
    where: { id: body.rosterEntryId },
    select: { id: true, playerId: true },
  });
  if (!rosterEntry)
    return NextResponse.json({ error: "Игрок не найден в заявке" }, { status: 404 });
  const startsAt = parseSuspensionStartDate(body.startsAt);
  if (!startsAt)
    return NextResponse.json({ error: "Укажите корректную дату начала дисквалификации" }, { status: 400 });
  const matchesCount = Number(body.matchesCount);
  if (!Number.isInteger(matchesCount) || matchesCount < 1)
    return NextResponse.json(
      { error: "Количество матчей должно быть целым положительным числом" },
      { status: 400 },
    );
  const suspension = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suspension:${rosterEntry.playerId}`}))`;
    const existing=await getPlayerSuspensionStates([rosterEntry.playerId],startsAt,undefined,tx);
    if(existing.has(rosterEntry.playerId))throw new WriteConflict();
    const created = await tx.playerSuspension.create({
      data: {
        rosterEntryId: rosterEntry.id,
        reason: String(body.reason).trim(),
        note: String(body.note || "").trim() || null,
        startsAt,
        endsAt: null,
        matchesCount,
      },
    });
    return created;
  });
  return NextResponse.json(suspension, { status: 201 });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id || !allowedStatuses.has(body.status))
    return NextResponse.json({ error: "Некорректная дисквалификация" }, { status: 400 });
  const version=editVersion(body.expectedUpdatedAt);
  const current = await prisma.playerSuspension.findUnique({ where: { id: body.id } });
  if (!current)
    return NextResponse.json({ error: "Дисквалификация не найдена" }, { status: 404 });
  const suspension = await prisma.$transaction(async (tx) => {
    const updated = await tx.playerSuspension.update({
      where: { id: current.id,updatedAt:version },
      data: { status: body.status,updatedAt:nextEditVersion(version) },
    });
    return updated;
  });
  return NextResponse.json(suspension);
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);
