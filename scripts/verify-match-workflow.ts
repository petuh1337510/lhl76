import { NextRequest } from "next/server";
import { PUT as saveProtocol } from "../src/app/api/admin/match-protocol/route";
import { POST as createMatch, PATCH as editSchedule } from "../src/app/api/admin/matches/route";
import { prisma } from "../src/lib/prisma";
import { rebuildDivisionStatistics } from "../src/lib/rebuild-division-statistics";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertResponse(response: Response, message: string) {
  if (!response.ok) throw new Error(`${message}: ${await response.text()}`);
}

const protocolRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/match-protocol", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const matchRequest = (method: "POST" | "PATCH", body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/matches", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

function requireHttpHarness():void {
  throw new Error('Этот старый сценарий прямого вызова API отключён: используйте scripts/check-isolated-readiness.mjs с отдельной восстановленной базой. Рабочие данные изменять нельзя.');
}
async function main() {
  requireHttpHarness();
  const divisions = await prisma.division.findMany({
    include: {
      stages: { where: { countsForStandings: true }, orderBy: { sortOrder: "asc" } },
      teamEntries: {
        include: {
          roster: {
            where: { status: "ACTIVE", suspensions: { none: { status: "ACTIVE" } } },
            take: 1,
          },
        },
      },
    },
  });
  const division = divisions.find(
    (item) => item.stages.length > 0 && item.teamEntries.filter((entry) => entry.roster.length > 0).length >= 2,
  );
  if (!division) throw new Error("Не найден дивизион с двумя действующими составами для проверки");

  const [home, away] = division.teamEntries.filter((entry) => entry.roster.length > 0).slice(0, 2);
  const rosterEntry = home.roster[0];
  const baselinePlayer = await prisma.playerStatistic.findUnique({
    where: { playerId_teamEntryId: { playerId: rosterEntry.playerId, teamEntryId: home.id } },
  });
  const baselineHome = await prisma.teamStatistic.findUnique({ where: { teamEntryId: home.id } });
  const baselineAway = await prisma.teamStatistic.findUnique({ where: { teamEntryId: away.id } });
  const createResponse = await createMatch(matchRequest("POST", {
    divisionId: division.id, homeTeamEntryId: home.id, awayTeamEntryId: away.id,
    date: "2027-01-15", time: "20:15", venueId: "", isPlayoff: false,
  }));
  await assertResponse(createResponse, "Создание матча не прошло");
  assert(createResponse.status === 201, "Создание матча вернуло неверный статус");
  const match: { id: string } = await createResponse.json();

  try {
    const scheduleResponse = await editSchedule(matchRequest("PATCH", {
      matchId: match.id, date: "2027-01-16", time: "21:30", venueId: "",
    }));
    await assertResponse(scheduleResponse, "Изменение расписания не прошло");
    const scheduled = await prisma.match.findUnique({ where: { id: match.id } });
    assert(scheduled?.startsAt?.toISOString() === "2027-01-16T18:30:00.000Z", "Время матча сохранилось не по Москве");
    const common = {
      matchId: match.id,
      rosterEntryIds: [rosterEntry.id],
      numberOverrides: {},
      status: "FINAL",
      protocolData: { eventTimesAbsolute: true, goalieStints: [], shots: [], timeouts: [] },
      shootouts: [],
      resultNote: "Автоматическая проверка сценария матча",
    };
    const invalidTechnical = await saveProtocol(protocolRequest({
      ...common, status: "SCHEDULED", resultType: "TECHNICAL",
      protocolData: { ...common.protocolData, technicalWinnerTeamEntryId: away.id },
      goals: [], penalties: [],
    }));
    assert(invalidTechnical.status === 400, "Технический результат прошёл без статуса «Завершён»");
    const lineupResponse = await saveProtocol(protocolRequest({
      ...common, status: "SCHEDULED", resultType: "NORMAL", goals: [], penalties: [],
    }));
    await assertResponse(lineupResponse, "Состав не сохранился");
    const normalResponse = await saveProtocol(
      protocolRequest({
        ...common,
        resultType: "NORMAL",
        goals: [{ teamEntryId: home.id, scorerId: rosterEntry.playerId, period: 1, clockSeconds: 60, situation: "5X5" }],
        penalties: [{ teamEntryId: home.id, playerId: rosterEntry.playerId, period: 1, clockSeconds: 120, minutes: 2 }],
      }),
    );
    await assertResponse(normalResponse, "Обычный протокол не сохранился");

    const normalMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: { goals: true, penalties: true },
    });
    const normalPlayer = await prisma.playerStatistic.findUnique({
      where: { playerId_teamEntryId: { playerId: rosterEntry.playerId, teamEntryId: home.id } },
    });
    assert(normalMatch?.homeScore === 1 && normalMatch.awayScore === 0, "Счёт обычного матча рассчитан неверно");
    assert(normalMatch.goals.length === 1 && normalMatch.penalties.length === 1, "События обычного матча не сохранились");
    assert(normalPlayer?.goals === (baselinePlayer?.goals ?? 0) + 1, "Гол игрока не попал в статистику");
    assert(normalPlayer?.games === (baselinePlayer?.games ?? 0) + 1, "Участие игрока не попало в статистику");

    const postponedResponse = await saveProtocol(protocolRequest({
      ...common, status: "POSTPONED", resultType: "NORMAL",
      goals: [{ teamEntryId: home.id, scorerId: rosterEntry.playerId, period: 1, clockSeconds: 60, situation: "5X5" }],
      penalties: [],
    }));
    await assertResponse(postponedResponse, "Перенос матча не сохранился");
    const postponedPlayer = await prisma.playerStatistic.findUnique({
      where: { playerId_teamEntryId: { playerId: rosterEntry.playerId, teamEntryId: home.id } },
    });
    assert(postponedPlayer?.goals === (baselinePlayer?.goals ?? 0), "Гол перенесённого матча остался в статистике");

    const technicalResponse = await saveProtocol(
      protocolRequest({
        ...common,
        resultType: "TECHNICAL",
        protocolData: { ...common.protocolData, technicalWinnerTeamEntryId: away.id },
        goals: [{ teamEntryId: home.id, scorerId: rosterEntry.playerId, period: 1, clockSeconds: 60, situation: "5X5" }],
        penalties: [{ teamEntryId: home.id, playerId: rosterEntry.playerId, period: 1, clockSeconds: 120, minutes: 2 }],
        shootouts: [{ teamEntryId: home.id, playerId: rosterEntry.playerId, scored: true }],
      }),
    );
    await assertResponse(technicalResponse, "Технический результат не сохранился");

    const technicalMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: { goals: true, penalties: true, penaltyShots: true },
    });
    const restoredPlayer = await prisma.playerStatistic.findUnique({
      where: { playerId_teamEntryId: { playerId: rosterEntry.playerId, teamEntryId: home.id } },
    });
    const technicalHome = await prisma.teamStatistic.findUnique({ where: { teamEntryId: home.id } });
    const technicalAway = await prisma.teamStatistic.findUnique({ where: { teamEntryId: away.id } });
    assert(technicalMatch?.resultType === "TECHNICAL", "Тип результата не изменился на технический");
    assert(technicalMatch.homeScore === 0 && technicalMatch.awayScore === 0, "Технический результат содержит счёт по шайбам");
    assert(technicalMatch.goals.length === 0 && technicalMatch.penalties.length === 0 && technicalMatch.penaltyShots.length === 0, "События технического матча не очищены");
    assert(restoredPlayer?.goals === (baselinePlayer?.goals ?? 0), "Гол технического матча остался в статистике игрока");
    assert(restoredPlayer?.games === (baselinePlayer?.games ?? 0), "Технический матч остался в статистике участия игрока");
    assert(technicalHome?.games === (baselineHome?.games ?? 0) + 1, "Техническое поражение не учтено как игра команды");
    assert(technicalAway?.games === (baselineAway?.games ?? 0) + 1, "Техническая победа не учтена как игра команды");
    assert(technicalHome?.goalsFor === (baselineHome?.goalsFor ?? 0), "Шайбы технического матча попали хозяевам");
    assert(technicalAway?.goalsFor === (baselineAway?.goalsFor ?? 0), "Шайбы технического матча попали гостям");

    const lockedSchedule = await editSchedule(matchRequest("PATCH", {
      matchId: match.id, date: "2027-01-17", time: "21:30", venueId: "",
    }));
    assert(lockedSchedule.status === 400, "Завершённый матч позволил изменить расписание");

    const correctedResponse = await saveProtocol(protocolRequest({
      ...common, resultType: "NORMAL",
      goals: [{ teamEntryId: home.id, scorerId: rosterEntry.playerId, period: 1, clockSeconds: 90, situation: "5X5" }],
      penalties: [],
    }));
    await assertResponse(correctedResponse, "Исправление технического результата не прошло");
    const correctedMatch = await prisma.match.findUnique({ where: { id: match.id } });
    const correctedPlayer = await prisma.playerStatistic.findUnique({
      where: { playerId_teamEntryId: { playerId: rosterEntry.playerId, teamEntryId: home.id } },
    });
    assert(correctedMatch?.resultType === "NORMAL" && correctedMatch.homeScore === 1, "Обычный результат после исправления неверен");
    assert(correctedPlayer?.goals === (baselinePlayer?.goals ?? 0) + 1, "После исправления гол не вернулся в статистику");

    process.stdout.write("Проверка пройдена: создание, расписание, состав, обычный и технический результаты, исправление статистики.\n");
  } finally {
    const existingMatch = await prisma.match.findUnique({ where: { id: match.id }, select: { id: true } });
    if (existingMatch) {
      await saveProtocol(
        protocolRequest({
          matchId: match.id,
          rosterEntryIds: [],
          numberOverrides: {},
          status: "SCHEDULED",
          resultType: "NORMAL",
          protocolData: { eventTimesAbsolute: true, goalieStints: [], shots: [], timeouts: [] },
          goals: [],
          penalties: [],
          shootouts: [],
          resultNote: null,
        }),
      ).catch(() => undefined);
    }
    await prisma.match.delete({ where: { id: match.id } }).catch(() => undefined);
    await prisma.$transaction((tx) => rebuildDivisionStatistics(tx, division.id));
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
