import { prisma } from "@/lib/prisma";
import { legacyProtocolReview } from "@/lib/legacy-protocol-review";

export const dataIssueLabels = {
  FINAL_IMPORT_REVIEW: "Отложено: сверка последнего переноса",
  SCORE_EVENTS_MISMATCH: "Счёт не совпадает с голами протокола",
  FINAL_WITHOUT_ROSTER: "У завершённого матча нет состава",
  EVENT_PLAYER_OUTSIDE_ROSTER: "Участник события отсутствует в составе матча",
} as const;

export type DataIssueCode = keyof typeof dataIssueLabels;

export async function getDataQualityAudit(input: {
  seasonId?: string;
  issue?: string;
  page?: number;
}) {
  const page = Math.max(1, input.page || 1);
  const pageSize = 25;
  const seasons = await prisma.season.findMany({
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  const matches = await prisma.match.findMany({
    where: input.seasonId
      ? { division: { competition: { seasonId: input.seasonId } } }
      : {},
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      status: true,
      resultType: true,
      startsAt: true,
      homeScore: true,
      awayScore: true,
      homeTeamEntryId: true,
      awayTeamEntryId: true,
      division: {
        select: {
          name: true,
          competition: { select: { name: true, season: { select: { id: true, name: true } } } },
        },
      },
      homeTeamEntry: { select: { team: { select: { name: true } } } },
      awayTeamEntry: { select: { team: { select: { name: true } } } },
      goals: {
        select: {
          teamEntryId: true,
          scorerId: true,
          assists: { select: { playerId: true } },
        },
      },
      penalties: { select: { playerId: true } },
      rosters: { select: { rosterEntry: { select: { playerId: true } } } },
    },
  });
  const imported = matches.length
    ? await prisma.legacyImportMap.findMany({
        where: { entityType: "match", entityId: { in: matches.map((match) => match.id) } },
        select: { entityId: true },
      })
    : [];
  const importedIds = new Set(imported.map((item) => item.entityId));

  const audited = matches.flatMap((match) => {
    const issues: DataIssueCode[] = [];
    const reviewNote = legacyProtocolReview[match.id];
    if (reviewNote) issues.push("FINAL_IMPORT_REVIEW");
    const homeGoals = match.goals.filter(
      (goal) => goal.teamEntryId === match.homeTeamEntryId,
    ).length;
    const awayGoals = match.goals.filter(
      (goal) => goal.teamEntryId === match.awayTeamEntryId,
    ).length;
    if (
      match.resultType === "NORMAL" &&
      match.goals.length > 0 &&
      (homeGoals !== match.homeScore || awayGoals !== match.awayScore)
    )
      issues.push("SCORE_EVENTS_MISMATCH");
    if (
      match.status === "FINAL" &&
      match.resultType !== "TECHNICAL" &&
      match.rosters.length === 0
    )
      issues.push("FINAL_WITHOUT_ROSTER");

    const selectedPlayers = new Set(
      match.rosters.map((roster) => roster.rosterEntry.playerId),
    );
    const eventPlayers = new Set(
      [
        ...match.goals.flatMap((goal) => [
          goal.scorerId,
          ...goal.assists.map((assist) => assist.playerId),
        ]),
        ...match.penalties.map((penalty) => penalty.playerId).filter(Boolean),
      ].filter((playerId): playerId is string => Boolean(playerId)),
    );
    const outsideRoster = [...eventPlayers].filter(
      (playerId) => !selectedPlayers.has(playerId),
    ).length;
    if (match.rosters.length > 0 && outsideRoster > 0)
      issues.push("EVENT_PLAYER_OUTSIDE_ROSTER");
    if (!issues.length) return [];

    return [{
      id: match.id,
      slug: match.slug,
      status: match.status,
      startsAt: match.startsAt,
      seasonId: match.division.competition.season.id,
      season: match.division.competition.season.name,
      competition: match.division.competition.name,
      division: match.division.name,
      home: match.homeTeamEntry.team.name,
      away: match.awayTeamEntry.team.name,
      storedScore: `${match.homeScore}:${match.awayScore}`,
      eventScore: `${homeGoals}:${awayGoals}`,
      rosterSize: match.rosters.length,
      eventPlayersOutsideRoster: outsideRoster,
      imported: importedIds.has(match.id),
      reviewNote: reviewNote ?? null,
      issues,
    }];
  });

  const summary = Object.keys(dataIssueLabels).map((code) => ({
    code,
    label: dataIssueLabels[code as DataIssueCode],
    count: audited.filter((match) => match.issues.includes(code as DataIssueCode)).length,
  }));
  const filtered = input.issue
    ? audited.filter((match) => match.issues.includes(input.issue as DataIssueCode))
    : audited;

  return {
    generatedAt: new Date(),
    seasons,
    labels: dataIssueLabels,
    summary,
    overview: {
      matchesChecked: matches.length,
      importedWithIssues: audited.filter((match) => match.imported).length,
      nativeWithIssues: audited.filter((match) => !match.imported).length,
    },
    total: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
  };
}
