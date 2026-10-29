import { withAdmin } from "@/lib/admin-guard";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlayoffConflict, syncPlayoff } from '@/lib/playoff-service';
import { rebuildDivisionStatistics } from '@/lib/rebuild-division-statistics';
import { z } from 'zod';
import { seriesResult } from '@/lib/domain/playoff';

function parseMoscowDateTime(date: unknown, time: unknown) {
  if (typeof date !== "string" || typeof time !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00+03:00`);
  if (Number.isNaN(value.getTime())) return null;
  const local = new Date(value.getTime() + 3 * 60 * 60 * 1000).toISOString();
  return local.slice(0, 16) === `${date}T${time}` ? value : null;
}

async function venueIsValid(venueId: unknown) {
  return !venueId || (typeof venueId === "string" &&
    Boolean(await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } })));
}

async function handleGET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("choices")) {
    const [divisions, venues] = await Promise.all([
      prisma.division.findMany({
        include: {
          competition: { include: { season: true } },
          teamEntries: {
            include: { team: true },
            orderBy: { team: { name: "asc" } },
          },
        },
        orderBy: [
          { competition: { season: { startsAt: "desc" } } },
          { sortOrder: "asc" },
        ],
      }),
      prisma.venue.findMany({ orderBy: [{ city: "asc" }, { name: "asc" }] }),
    ]);
    return NextResponse.json({
      divisions: divisions.map((division) => ({
        id: division.id,
        name: division.name,
        competitionId: division.competition.id,
        competition: division.competition.name,
        seasonId: division.competition.season.id,
        season: division.competition.season.name,
        teams: division.teamEntries.map((entry) => ({
          id: entry.id,
          name: entry.team.name,
          logoUrl: entry.team.logoUrl,
        })),
      })),
      venues,
    });
  }
  const page = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("page")) || 1,
    ),
    pageSize = 25,
    divisionId = request.nextUrl.searchParams.get("divisionId") || undefined,
    competitionId =
      request.nextUrl.searchParams.get("competitionId") || undefined,
    seasonId = request.nextUrl.searchParams.get("seasonId") || undefined,
    date = request.nextUrl.searchParams.get("date") || undefined,
    result = request.nextUrl.searchParams.get("result") || undefined;
  const suspectedTechnicalWhere = {
    status: "FINAL" as const,
    resultType: "NORMAL" as const,
    goals: { none: {} },
    OR: [
      { homeScore: 5, awayScore: 0 },
      { homeScore: 0, awayScore: 5 },
    ],
  };
  const where = {
    ...(divisionId ? { divisionId } : {}),
    ...(!divisionId && competitionId
      ? { division: { competitionId } }
      : !divisionId && !competitionId && seasonId
        ? { division: { competition: { seasonId } } }
        : {}),
    ...(date
      ? {
          startsAt: {
            gte: new Date(`${date}T00:00:00+03:00`),
            lte: new Date(`${date}T23:59:59.999+03:00`),
          },
        }
      : {}),
    ...(result === "TECHNICAL"
      ? { resultType: "TECHNICAL" as const }
      : result === "REVIEW"
        ? suspectedTechnicalWhere
        : result === "NORMAL"
          ? { resultType: "NORMAL" as const }
          : {}),
  };
  const [total, items] = await prisma.$transaction([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        division: { include: { competition: { include: { season: true } } } },
        homeTeamEntry: { include: { team: true } },
        awayTeamEntry: { include: { team: true } },
        venue: true,
        _count: { select: { goals: true } },
      },
    }),
  ]);
  return NextResponse.json({
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map((match) => ({
      ...match,
      needsTechnicalReview:
        match.status === "FINAL" &&
        match.resultType === "NORMAL" &&
        match._count.goals === 0 &&
        ((match.homeScore === 5 && match.awayScore === 0) ||
          (match.homeScore === 0 && match.awayScore === 5)),
    })),
  });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  if (
    !body.divisionId ||
    !body.homeTeamEntryId ||
    !body.awayTeamEntryId ||
    !body.date ||
    !body.time
  )
    return NextResponse.json(
      { error: "Заполните дивизион, команды, дату и время" },
      { status: 400 },
    );
  if (body.homeTeamEntryId === body.awayTeamEntryId)
    return NextResponse.json(
      { error: "Хозяева и гости должны быть разными командами" },
      { status: 400 },
    );
  const startsAt = parseMoscowDateTime(body.date, body.time);
  if (!startsAt) return NextResponse.json({ error: "Укажите корректные дату и время матча" }, { status: 400 });
  if (!(await venueIsValid(body.venueId)))
    return NextResponse.json({ error: "Выбранная арена не найдена" }, { status: 400 });
  const teams = await prisma.teamEntry.findMany({
    where: { id: { in: [body.homeTeamEntryId, body.awayTeamEntryId] } },
    include: { team: true },
  });
  if (
    teams.length !== 2 ||
    teams.some((team) => team.divisionId !== body.divisionId)
  )
    return NextResponse.json(
      { error: "Обе команды должны относиться к выбранному дивизиону" },
      { status: 400 },
    );
  if (body.isPlayoff !== undefined && typeof body.isPlayoff !== 'boolean')
    return NextResponse.json({error:'Плей-офф должен быть отмечен флажком'}, {status:400});
  const isPlayoff = body.isPlayoff === true;
  const match = await prisma.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.divisionId}))`;
  let seriesLink: {playoffSeriesId:string;playoffGame:number}|undefined;
  if (isPlayoff) {
    const candidates = await tx.playoffSeries.findMany({where:{
      round:{playoff:{divisionId:body.divisionId}},
      OR:[{homeTeamEntryId:body.homeTeamEntryId,awayTeamEntryId:body.awayTeamEntryId},
          {homeTeamEntryId:body.awayTeamEntryId,awayTeamEntryId:body.homeTeamEntryId}],
    },include:{matches:{orderBy:{playoffGame:'asc'}},round:true}});
    const active = candidates.filter(s=>!seriesResult(s.homeTeamEntryId,s.awayTeamEntryId,s.bestOf,s.matches).winner);
    if(active.length!==1)throw new PlayoffConflict(active.length?'Найдено несколько серий для этих команд. Добавьте матч из нужной серии.':'Активная серия для этих команд не найдена. Сначала настройте сетку выбранного дивизиона.');
    const series=active[0];
    if(series.matches.some(m=>m.status!=='FINAL'&&m.status!=='CANCELLED'))throw new PlayoffConflict('В серии уже есть незавершённый матч. Откройте его в календаре и задайте расписание или заполните протокол.');
    seriesLink={playoffSeriesId:series.id,playoffGame:Math.max(0,...series.matches.map(m=>m.playoffGame||0))+1};
    await tx.playoff.update({where:{id:series.round.playoffId},data:{revision:{increment:1}}});
  }
  let stage = await tx.matchStage.findFirst({
    where: {
      divisionId: body.divisionId,
      type: isPlayoff ? "PLAYOFF" : "GROUP_STAGE",
    },
    orderBy: { sortOrder: "asc" },
  });
  if (!stage)
    stage = await tx.matchStage.create({
      data: {
        divisionId: body.divisionId,
        name: isPlayoff ? "Плей-офф" : "Регулярный этап",
        slug: isPlayoff ? "playoff" : "regular-season",
        type: isPlayoff ? "PLAYOFF" : "GROUP_STAGE",
        countsForStandings: !isPlayoff,
      },
    });
  const home = teams.find((team) => team.id === body.homeTeamEntryId)!,
    away = teams.find((team) => team.id === body.awayTeamEntryId)!;
  const slug = `${body.date}-${home.team.slug}-${away.team.slug}-${randomUUID().slice(0, 6)}`;
  if(isPlayoff && stage.countsForStandings)throw new PlayoffConflict('Этап плей-офф ошибочно включён в таблицу. Проверьте настройки этапа.');
  return tx.match.create({
    data: {
      slug,
      divisionId: body.divisionId,
      stageId: stage.id,
      homeTeamEntryId: body.homeTeamEntryId,
      awayTeamEntryId: body.awayTeamEntryId,
      venueId: body.venueId || null,
      startsAt,
      isPlayoff,
      ...seriesLink,
      status: "SCHEDULED",
    },
  });
  }, {timeout:20000});
  return NextResponse.json(match, { status: 201 });
}

async function handlePATCH(request: NextRequest) {
  const body = await request.json();
  if(body.action==='mark-playoff')return mutateExisting(body,false);
  if (typeof body.matchId !== "string")
    return NextResponse.json({ error: "Матч не указан" }, { status: 400 });
  const match = await prisma.match.findUnique({ where: { id: body.matchId } });
  if (!match) return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
  if (match.status === "LIVE" || match.status === "FINAL")
    return NextResponse.json({ error: "У начавшегося матча расписание нельзя менять здесь" }, { status: 400 });
  const startsAt = parseMoscowDateTime(body.date, body.time);
  if (!startsAt) return NextResponse.json({ error: "Укажите корректные дату и время матча" }, { status: 400 });
  if (!(await venueIsValid(body.venueId)))
    return NextResponse.json({ error: "Выбранная арена не найдена" }, { status: 400 });
  const updated = await prisma.match.update({
    where: { id: match.id },
    data: { startsAt, venueId: body.venueId || null },
  });
  return NextResponse.json(updated);
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PATCH = withAdmin(handlePATCH);

const existingInput=z.object({matchId:z.string().uuid(),expectedUpdatedAt:z.string().datetime(),action:z.enum(['mark-playoff','delete-empty'])}).strict();
async function mutateExisting(body:unknown,remove:boolean){
  const parsed=existingInput.safeParse(body);
  if(!parsed.success||remove!==(parsed.data.action==='delete-empty'))return NextResponse.json({error:'Обновите страницу и повторите действие.'},{status:400});
  const b=parsed.data;
  const result=await prisma.$transaction(async tx=>{
    const scope=await tx.match.findUnique({where:{id:b.matchId},select:{divisionId:true}});
    if(!scope)throw new PlayoffConflict('Матч уже удалён. Обновите список.');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope.divisionId}))`;
    const match=await tx.match.findUniqueOrThrow({where:{id:b.matchId},include:{_count:{select:{rosters:true,goals:true,assists:true,penalties:true,legacyEvents:true,penaltyShots:true}},playoffSeries:{select:{round:{select:{playoffId:true}}}}}});
    if(match.updatedAt.toISOString()!==b.expectedUpdatedAt)throw new PlayoffConflict('Матч изменён другим редактором. Обновите страницу.');
    if(remove){
      const hasJson=(value:unknown)=>value!==null&&JSON.stringify(value)!=='{}'&&JSON.stringify(value)!=='[]';
      if(match.status!=='SCHEDULED'||match.homeScore||match.awayScore||match.resultType!=='NORMAL'||match.resultNote||Object.values(match._count).some(Boolean)||hasJson(match.protocolData)||hasJson(match.periodScores))throw new PlayoffConflict('Удалять можно только запланированный пустой матч без состава, событий и протокола. Матчи с данными защищены от удаления.');
      await tx.match.delete({where:{id:match.id}});
      if(match.playoffSeries)await syncPlayoff(tx,match.playoffSeries.round.playoffId);
    }else{
      if(match.isPlayoff)throw new PlayoffConflict('Матч уже отмечен как плей-офф.');
      if(match.status!=='FINAL')throw new PlayoffConflict('Эта отметка доступна для завершённого матча.');
      const stage=await tx.matchStage.upsert({where:{divisionId_slug:{divisionId:match.divisionId,slug:'managed-playoff'}},create:{divisionId:match.divisionId,name:'Плей-офф',slug:'managed-playoff',type:'PLAYOFF',countsForStandings:false},update:{countsForStandings:false}});
      await tx.match.update({where:{id:match.id},data:{isPlayoff:true,stageId:stage.id}});
      await rebuildDivisionStatistics(tx,match.divisionId);
    }
    return {ok:true};
  },{timeout:20000});
  return NextResponse.json(result);
}
export const DELETE=withAdmin(async request=>mutateExisting(await request.json(),true));
