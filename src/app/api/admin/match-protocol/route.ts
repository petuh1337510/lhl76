import { withAdmin } from "@/lib/admin-guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deriveMatchProtocol,
  type ProtocolContribution,
} from "@/lib/domain/match-protocol";
import { rebuildDivisionStatistics } from "@/lib/rebuild-division-statistics";
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";
import { syncPlayoff, PlayoffConflict } from '@/lib/playoff-service';
import { matchClockResolver, matchClockVersion } from "@/lib/domain/match-clock";

async function handleGET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug)
    return NextResponse.json({ error: "Не указан матч" }, { status: 400 });
  const match = await prisma.match.findUnique({
    where: { slug },
    include: {
      division: { include: { competition: { include: { season: true } } } },
      venue: true,
      homeTeamEntry: {
        include: {
          team: true,
          roster: {
            where: { status: { not: "INACTIVE" } },
            include: {
              player: true,
              suspensions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      awayTeamEntry: {
        include: {
          team: true,
          roster: {
            where: { status: { not: "INACTIVE" } },
            include: {
              player: true,
              suspensions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      rosters: { include: { rosterEntry: { include: { player: true } } } },
      legacyEvents: {
        where: { eventType: { in: ["Гол", "Штраф"] } },
        select: { teamEntryId: true, playerId: true, eventType: true, minute: true },
      },
      goals: {
        include: {
          scorer: true,
          assists: { include: { player: true }, orderBy: { order: "asc" } },
        },
        orderBy: [{ period: "asc" }, { clockSeconds: "asc" }],
      },
      penalties: {
        include: { player: true },
        orderBy: [{ period: "asc" }, { clockSeconds: "asc" }],
      },
      penaltyShots: {
        include: { player: true, goalie: true },
        orderBy: { attemptOrder: "asc" },
      },
    },
  });
  if (!match)
    return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
  const playerIds = [...new Set([...match.homeTeamEntry.roster, ...match.awayTeamEntry.roster].map((entry) => entry.playerId))];
  const suspensionsByPlayer = await getPlayerSuspensionStates(playerIds, match.startsAt || new Date(), match.id);
  const withSuspensions = (roster: typeof match.homeTeamEntry.roster) => roster.map((entry) => ({
    ...entry,
    suspensions: (suspensionsByPlayer.get(entry.playerId) || []).map((suspension) => ({ ...suspension, endsAt: null })),
  }));
  const { legacyEvents, ...data } = match;
  const matchSeconds = matchClockResolver(match.protocolData, legacyEvents);
  return NextResponse.json({
    ...data,
    goals: match.goals.map(goal => ({ ...goal, clockSeconds: matchSeconds(goal.clockSeconds, goal.teamEntryId, goal.scorerId, "Гол") })),
    penalties: match.penalties.map(penalty => ({ ...penalty, clockSeconds: matchSeconds(penalty.clockSeconds, penalty.teamEntryId, penalty.playerId, "Штраф") })),
    homeTeamEntry: { ...match.homeTeamEntry, roster: withSuspensions(match.homeTeamEntry.roster) },
    awayTeamEntry: { ...match.awayTeamEntry, roster: withSuspensions(match.awayTeamEntry.roster) },
  });
}

async function handlePUT(request: NextRequest) {
  const body = await request.json();
  if(typeof body.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(body.expectedUpdatedAt)))return NextResponse.json({error:'Обновите протокол перед сохранением: отсутствует версия данных.'},{status:409});
  if (!body.matchId)
    return NextResponse.json({ error: "Не указан матч" }, { status: 400 });
  const match = await prisma.match.findUnique({
    where: { id: body.matchId },
    select: {
      id: true,
      divisionId: true,
      homeTeamEntryId: true,
      awayTeamEntryId: true,
      protocolData: true,
      startsAt: true,
      updatedAt: true,
      isPlayoff: true,
      playoffSeriesId: true,
    },
  });
  if (!match)
    return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
  if(match.updatedAt.toISOString()!==body.expectedUpdatedAt)return NextResponse.json({error:'Протокол уже изменён другим редактором. Обновите страницу и проверьте изменения.'},{status:409});
  const allowedStatuses = new Set([
    "SCHEDULED",
    "LIVE",
    "FINAL",
    "POSTPONED",
    "CANCELLED",
  ]);
  if (!allowedStatuses.has(body.status || "SCHEDULED"))
    return NextResponse.json({ error: "Некорректный статус матча" }, { status: 400 });
  const allowedTeams = new Set([match.homeTeamEntryId, match.awayTeamEntryId]);
  const resultType = body.resultType === "TECHNICAL" ? "TECHNICAL" : "NORMAL";
  if (resultType === "TECHNICAL" && body.status !== "FINAL")
    return NextResponse.json(
      { error: "Технический результат возможен только у завершённого матча" },
      { status: 400 },
    );
  const technicalWinnerTeamEntryId = body.protocolData?.technicalWinnerTeamEntryId;
  if (
    resultType === "TECHNICAL" &&
    !allowedTeams.has(technicalWinnerTeamEntryId)
  )
    return NextResponse.json(
      { error: "Для технического результата выберите победителя" },
      { status: 400 },
    );
  if (
    (body.goals || []).some(
      (goal: any) => !allowedTeams.has(goal.teamEntryId),
    ) ||
    (body.penalties || []).some(
      (penalty: any) => !allowedTeams.has(penalty.teamEntryId),
    ) ||
    (body.shootouts || []).some(
      (shot: any) => !allowedTeams.has(shot.teamEntryId),
    )
  )
    return NextResponse.json(
      { error: "Событие относится к посторонней команде" },
      { status: 400 },
    );
  const requestedRosterIds = [...new Set<string>(body.rosterEntryIds || [])];
  const validRosterEntries = requestedRosterIds.length
    ? await prisma.rosterEntry.findMany({
        where: {
          id: { in: requestedRosterIds },
          teamEntryId: { in: [match.homeTeamEntryId, match.awayTeamEntryId] },
        },
        select: {
          id: true,
          playerId: true,
          teamEntryId: true,
        },
      })
    : [];
  if (validRosterEntries.length !== requestedRosterIds.length)
    return NextResponse.json(
      { error: "В составе найден игрок посторонней команды" },
      { status: 400 },
    );
  const blockingSuspensions = await getPlayerSuspensionStates(validRosterEntries.map((entry) => entry.playerId), match.startsAt || new Date(), match.id);
  const suspendedEntry = validRosterEntries.find((entry) => blockingSuspensions.has(entry.playerId));
  if (suspendedEntry)
    return NextResponse.json(
      { error: "Дисквалифицированный игрок не может быть включён в состав матча" },
      { status: 400 },
    );
  const selectedPlayers = new Map<string, Set<string>>([
    [match.homeTeamEntryId, new Set<string>()],
    [match.awayTeamEntryId, new Set<string>()],
  ]);
  for (const roster of validRosterEntries)
    selectedPlayers.get(roster.teamEntryId)?.add(roster.playerId);
  const belongsToSelectedTeam = (playerId: string | undefined, teamEntryId: string) =>
    !playerId || selectedPlayers.get(teamEntryId)?.has(playerId) === true;
  for (const goal of body.goals || []) {
    if (!goal.scorerId)
      return NextResponse.json(
        { error: "Для каждого гола необходимо выбрать автора" },
        { status: 400 },
      );
    if (
      !belongsToSelectedTeam(goal.scorerId, goal.teamEntryId) ||
      !belongsToSelectedTeam(goal.assist1Id, goal.teamEntryId) ||
      !belongsToSelectedTeam(goal.assist2Id, goal.teamEntryId)
    )
      return NextResponse.json(
        { error: "Автор гола и ассистенты должны быть выбраны в составе своей команды" },
        { status: 400 },
      );
    const assistants = [goal.assist1Id, goal.assist2Id].filter(Boolean);
    if (
      assistants.includes(goal.scorerId) ||
      new Set(assistants).size !== assistants.length
    )
      return NextResponse.json(
        { error: "Автор гола и ассистенты должны быть разными игроками" },
        { status: 400 },
      );
  }
  for (const penalty of body.penalties || [])
    if (!belongsToSelectedTeam(penalty.playerId, penalty.teamEntryId))
      return NextResponse.json(
        { error: "Удалённый игрок должен быть выбран в составе своей команды" },
        { status: 400 },
      );
  for (const shot of body.shootouts || []) {
    const opponentTeamEntryId =
      shot.teamEntryId === match.homeTeamEntryId
        ? match.awayTeamEntryId
        : match.homeTeamEntryId;
    if (!shot.playerId)
      return NextResponse.json(
        { error: "Для каждого буллита необходимо выбрать игрока" },
        { status: 400 },
      );
    if (
      !belongsToSelectedTeam(shot.playerId, shot.teamEntryId) ||
      !belongsToSelectedTeam(shot.goalieId, opponentTeamEntryId)
    )
      return NextResponse.json(
        { error: "Участники буллита должны быть выбраны в составах своих команд" },
        { status: 400 },
      );
  }
  for (const stint of body.protocolData?.goalieStints || [])
    if (
      stint.playerId &&
      (!allowedTeams.has(stint.teamEntryId) ||
        !belongsToSelectedTeam(stint.playerId, stint.teamEntryId))
    )
      return NextResponse.json(
        { error: "Вратарь должен быть выбран в составе своей команды" },
        { status: 400 },
      );

  const derived = deriveMatchProtocol({
    homeTeamEntryId: match.homeTeamEntryId,
    awayTeamEntryId: match.awayTeamEntryId,
    goals: body.goals || [],
    penalties: body.penalties || [],
    roster: validRosterEntries,
    goalieStints: body.protocolData?.goalieStints || [],
    status: body.status,
  });
  const newContributions =
    resultType === "TECHNICAL" || ["SCHEDULED", "POSTPONED", "CANCELLED"].includes(body.status)
      ? [] : derived.contributions;
  const persistedGoals = resultType === "TECHNICAL" ? [] : body.goals || [];
  const persistedPenalties = resultType === "TECHNICAL" ? [] : body.penalties || [];
  const persistedShootouts = resultType === "TECHNICAL" ? [] : body.shootouts || [];
  let finalHomeScore = resultType === "TECHNICAL" ? 0 : derived.homeScore;
  let finalAwayScore = resultType === "TECHNICAL" ? 0 : derived.awayScore;
  // The deciding shootout goal affects the match/series result, not player goal totals.
  if(match.isPlayoff && resultType !== 'TECHNICAL' && body.status === 'FINAL' && finalHomeScore === finalAwayScore){
    const homeShots=persistedShootouts.filter((s:any)=>s.teamEntryId===match.homeTeamEntryId&&s.scored).length;
    const awayShots=persistedShootouts.filter((s:any)=>s.teamEntryId===match.awayTeamEntryId&&s.scored).length;
    if(homeShots>awayShots)finalHomeScore++;else if(awayShots>homeShots)finalAwayScore++;
  }
  const finalPeriodScores =
    resultType === "TECHNICAL"
      ? [
          { home: 0, away: 0 },
          { home: 0, away: 0 },
          { home: 0, away: 0 },
        ]
      : derived.periodScores;
  const previousProtocol =
    match.protocolData && typeof match.protocolData === "object"
      ? (match.protocolData as Record<string, unknown>)
      : {};
  const previousContributions = Array.isArray(previousProtocol.statContributions)
    ? (previousProtocol.statContributions as ProtocolContribution[])
    : [];
  const updatedAt = await prisma.$transaction(async (tx) => {
    // Serialize recalculation within the division, then atomically claim the
    // exact version the editor loaded. A stale submission changes nothing.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.divisionId}))`;
    const claimed=await tx.match.updateMany({where:{id:match.id,updatedAt:new Date(body.expectedUpdatedAt)},data:{updatedAt:new Date()}});
    if(claimed.count!==1){const conflict=new Error('Concurrent protocol edit');conflict.name='WriteConflict';throw conflict;}
    await tx.assist.deleteMany({ where: { matchId: body.matchId } });
    await tx.goal.deleteMany({ where: { matchId: body.matchId } });
    await tx.penalty.deleteMany({ where: { matchId: body.matchId } });
    await tx.penaltyShot.deleteMany({ where: { matchId: body.matchId } });
    await tx.matchRoster.deleteMany({ where: { matchId: body.matchId } });
    if (requestedRosterIds.length)
      await tx.matchRoster.createMany({
        data: requestedRosterIds.map((rosterEntryId) => ({
          matchId: body.matchId,
          rosterEntryId,
          numberOverride: body.numberOverrides?.[rosterEntryId] || null,
        })),
      });
    for (const goal of persistedGoals) {
      if (
        goal.situation === "PENALTY_SHOT" &&
        goal.penaltyShotOutcome === "miss"
      ) {
        await tx.penaltyShot.create({
          data: {
            matchId: body.matchId,
            teamEntryId: goal.teamEntryId,
            playerId: goal.scorerId,
            phase: "IN_GAME",
            attemptOrder: Number(goal.attemptOrder) || 1,
            period: Number(goal.period) || null,
            clockSeconds: goal.clockSeconds != null && Number.isFinite(Number(goal.clockSeconds))
              ? Number(goal.clockSeconds)
              : null,
            scored: false,
          },
        });
        continue;
      }
      const created = await tx.goal.create({
        data: {
          matchId: body.matchId,
          teamEntryId: goal.teamEntryId,
          scorerId: goal.scorerId,
          period: Number(goal.period) || null,
          clockSeconds: goal.clockSeconds != null && Number.isFinite(Number(goal.clockSeconds))
            ? Number(goal.clockSeconds)
            : null,
          situation: goal.situation || "5X5",
        },
      });
      const assistants = [goal.assist1Id, goal.assist2Id].filter(Boolean);
      if (assistants.length)
        await tx.assist.createMany({
          data: assistants.map((playerId: string, index: number) => ({
            goalId: created.id,
            matchId: body.matchId,
            teamEntryId: goal.teamEntryId,
            playerId,
            order: index + 1,
          })),
        });
    }
    if (persistedShootouts.length)
      await tx.penaltyShot.createMany({
        data: persistedShootouts.map((shot: any, index: number) => ({
          matchId: body.matchId,
          teamEntryId: shot.teamEntryId,
          playerId: shot.playerId,
          goalieId: shot.goalieId || null,
          phase: "SHOOTOUT",
          attemptOrder: index + 1,
          period: null,
          clockSeconds: null,
          scored: Boolean(shot.scored),
        })),
      });
    if (persistedPenalties.length)
      await tx.penalty.createMany({
        data: persistedPenalties.map((penalty: any) => ({
          matchId: body.matchId,
          teamEntryId: penalty.teamEntryId,
          playerId: penalty.playerId || null,
          period: Number(penalty.period) || null,
          clockSeconds: penalty.clockSeconds != null && Number.isFinite(Number(penalty.clockSeconds))
            ? Number(penalty.clockSeconds)
            : null,
          minutes: Number(penalty.minutes) || 2,
          reasonCode: penalty.reasonCode || null,
          reason: penalty.reason || null,
        })),
      });
    const previousMap = new Map(
      previousContributions.map((row) => [
        `${row.playerId}:${row.teamEntryId}`,
        row,
      ]),
    );
    const nextMap = new Map(
      newContributions.map((row) => [`${row.playerId}:${row.teamEntryId}`, row]),
    );
    for (const key of new Set([...previousMap.keys(), ...nextMap.keys()])) {
      const previous = previousMap.get(key);
      const next = nextMap.get(key);
      const playerId = next?.playerId || previous!.playerId;
      const teamEntryId = next?.teamEntryId || previous!.teamEntryId;
      const existing = await tx.playerStatistic.findUnique({
        where: { playerId_teamEntryId: { playerId, teamEntryId } },
      });
      if (existing) {
        await tx.playerStatistic.update({
          where: { id: existing.id },
          data: {
            games: {
              increment: (next?.games || 0) - (previous?.games || 0),
            },
            goals: { increment: (next?.goals || 0) - (previous?.goals || 0) },
            assists: {
              increment: (next?.assists || 0) - (previous?.assists || 0),
            },
            penaltyMinutes: {
              increment:
                (next?.penaltyMinutes || 0) -
                (previous?.penaltyMinutes || 0),
            },
            goalieGames: {
              increment: (next?.goalieGames || 0) - (previous?.goalieGames || 0),
            },
            goalieSeconds: {
              increment:
                (next?.goalieSeconds || 0) - (previous?.goalieSeconds || 0),
            },
            shotsAgainst: {
              increment:
                (next?.shotsAgainst || 0) - (previous?.shotsAgainst || 0),
            },
            goalieGoalsAgainst: {
              increment:
                (next?.goalieGoalsAgainst || 0) -
                (previous?.goalieGoalsAgainst || 0),
            },
          },
        });
      } else if (next) {
        await tx.playerStatistic.create({ data: next });
      }
    }
    const savedMatch = await tx.match.update({
      where: { id: body.matchId },
      select: { updatedAt: true },
      data: {
        status: body.status || "SCHEDULED",
        resultType,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        periodScores: finalPeriodScores,
        protocolData: {
          ...(body.protocolData || {}),
          eventClockVersion: matchClockVersion,
          statContributions: newContributions,
        },
        resultNote: body.resultNote || null,
      },
    });
    await rebuildDivisionStatistics(tx, match.divisionId);
    if (match.isPlayoff && body.status === 'FINAL' && resultType !== 'TECHNICAL' && finalHomeScore === finalAwayScore)
      throw new PlayoffConflict('В завершённом матче плей-офф не может быть ничьей. Укажите решающий результат.');
    if (match.playoffSeriesId) {
      const series = await tx.playoffSeries.findUniqueOrThrow({where:{id:match.playoffSeriesId},include:{round:true}});
      await syncPlayoff(tx, series.round.playoffId);
    }
    return savedMatch.updatedAt;
  });
  return NextResponse.json({
    ok: true,
    updatedAt: updatedAt.toISOString(),
    score: { home: finalHomeScore, away: finalAwayScore },
    recalculated: {
      playerStatistics: true,
      teamStatistics: true,
      standings: true,
    },
  });
}

export const GET = withAdmin(handleGET);
export const PUT = withAdmin(handlePUT);
