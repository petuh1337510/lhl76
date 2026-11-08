import "server-only";

import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { calculateGoalieMetrics } from "@/lib/domain/goalie-statistics";
import { prisma } from "@/lib/prisma";
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";

export type PlayerHistoryRow = {
  key: string;
  seasonName: string;
  seasonSlug: string;
  competitionName: string;
  competitionType: "CHAMPIONSHIP" | "TOURNAMENT";
  competitionPath: string;
  divisionName: string;
  divisionPath: string;
  teamName: string;
  teamSlug: string;
  teamLogoUrl: string | null;
  games: number;
  goals: number;
  assists: number;
  penalty: number;
  points: number;
  goalieGames: number;
  goalieSeconds: number;
  shotsAgainst: number;
  goalieGoalsAgainst: number;
  saves: number;
  savePercentage: string;
  goalsAgainstAverage: string;
};

export type PlayerPageData = {
  player: { slug: string; name: string; firstName: string; lastName: string; patronymic: string | null; birthDate: string | null; country: string | null; birthPlace: string | null; position: string; stickHand: string | null; heightCm: number | null; weightKg: number | null; photoUrl: string | null; rating: string };
  current: PlayerHistoryRow | null;
  history: PlayerHistoryRow[];
  totals: { games: number; goals: number; assists: number; points: number; penalty: number; goalieGames: number; goalieSeconds: number; shotsAgainst: number; goalieGoalsAgainst: number; saves: number; savePercentage: string; goalsAgainstAverage: string };
  suspensions: Array<{ id: string; reason: string; note: string | null; sourceTeam: string; sourceDivision: string; remaining: number | null; matchesCount: number | null }>;
};

export async function getPlayerPage(slug: string): Promise<PlayerPageData | null> {
  const player = await prisma.player.findUnique({
    where: { slug, deletedAt: null },
    include: {
      statistics: { include: { teamEntry: { include: { team: true, division: { include: { competition: { include: { season: true } } } } } } } },
      ratingCategory: true,
    },
  });
  if (!player) return null;
  const activeSuspensions = await getPlayerSuspensionStates([player.id], new Date());

  const history = player.statistics.map((stat): PlayerHistoryRow => {
    const division = stat.teamEntry.division;
    const competition = division.competition;
    const season = competition.season;
    const goalie = calculateGoalieMetrics(stat.goalieSeconds, stat.shotsAgainst, stat.goalieGoalsAgainst);
    return {
      key: stat.id,
      seasonName: season.name,
      seasonSlug: season.slug,
      competitionName: competition.name,
      competitionType: competition.type,
      competitionPath: competitionPublicPath(competition.name, competition.type),
      divisionName: division.name,
      divisionPath: publicSlug(division.name),
      teamName: stat.teamEntry.team.name,
      teamSlug: stat.teamEntry.team.slug,
      teamLogoUrl: stat.teamEntry.team.logoUrl,
      games: stat.games,
      goals: stat.goals,
      assists: stat.assists,
      penalty: stat.penaltyMinutes,
      points: stat.goals + stat.assists,
      goalieGames: stat.goalieGames,
      goalieSeconds: stat.goalieSeconds,
      shotsAgainst: stat.shotsAgainst,
      goalieGoalsAgainst: stat.goalieGoalsAgainst,
      saves: goalie.saves,
      savePercentage: goalie.savePercentage === null ? "—" : `${goalie.savePercentage.toFixed(1)}%`,
      goalsAgainstAverage: goalie.goalsAgainstAverage === null ? "—" : goalie.goalsAgainstAverage.toFixed(2),
    };
  }).sort((a, b) => b.seasonName.localeCompare(a.seasonName, "ru") || Number(b.competitionType === "CHAMPIONSHIP") - Number(a.competitionType === "CHAMPIONSHIP") || a.teamName.localeCompare(b.teamName, "ru"));

  const current = history[0] ?? null;
  const totals = history.reduce(
    (sum, row) => ({
      games: sum.games + row.games,
      goals: sum.goals + row.goals,
      assists: sum.assists + row.assists,
      points: sum.points + row.points,
      penalty: sum.penalty + row.penalty,
      goalieGames: sum.goalieGames + row.goalieGames,
      goalieSeconds: sum.goalieSeconds + row.goalieSeconds,
      shotsAgainst: sum.shotsAgainst + row.shotsAgainst,
      goalieGoalsAgainst: sum.goalieGoalsAgainst + row.goalieGoalsAgainst,
      saves: sum.saves + row.saves,
      savePercentage: "—",
      goalsAgainstAverage: "—",
    }),
    { games: 0, goals: 0, assists: 0, points: 0, penalty: 0, goalieGames: 0, goalieSeconds: 0, shotsAgainst: 0, goalieGoalsAgainst: 0, saves: 0, savePercentage: "—", goalsAgainstAverage: "—" },
  );
  const totalGoalie = calculateGoalieMetrics(totals.goalieSeconds, totals.shotsAgainst, totals.goalieGoalsAgainst);
  totals.savePercentage = totalGoalie.savePercentage === null ? "—" : `${totalGoalie.savePercentage.toFixed(1)}%`;
  totals.goalsAgainstAverage = totalGoalie.goalsAgainstAverage === null ? "—" : totalGoalie.goalsAgainstAverage.toFixed(2);
  return {
    player: {
      slug: player.slug,
      name: [player.lastName, player.firstName, player.patronymic].filter(Boolean).join(" "),
      firstName: player.firstName,
      lastName: player.lastName,
      patronymic: player.patronymic,
      birthDate: player.birthDate?.toISOString() ?? null,
      country: player.country,
      birthPlace: player.birthPlace,
      position: player.position || "Игрок",
      stickHand: player.stickHand,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      photoUrl: player.photoUrl,
      rating: player.ratingCategory?.name || "—",
    },
    current,
    history,
    totals,
    suspensions: activeSuspensions.get(player.id) || [],
  };
}
