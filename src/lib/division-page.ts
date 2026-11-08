import "server-only";

import { calculateStandings } from "@/lib/domain/standings";
import { calculateGoalieMetrics } from "@/lib/domain/goalie-statistics";
import { goalieStatisticKey } from "@/lib/domain/match-goalies";
import { getGoalieProtocolStatistics, goalieStatisticsFor } from "@/lib/goalie-protocol-statistics";
import { prisma } from "@/lib/prisma";
import { playoffInclude, playoffView, type PlayoffView } from '@/lib/playoff-service';

export type DivisionChoice = {
  seasonName: string;
  seasonSlug: string;
  competitionName: string;
  competitionPath: string;
  competitionType: "CHAMPIONSHIP" | "TOURNAMENT";
  divisionName: string;
  divisionPath: string;
  href: string;
};

export type DivisionTeam = {
  rank: number;
  id: string;
  slug: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: Array<{ result: "w" | "d" | "l"; matchSlug: string }>;
};

export type DivisionMatch = {
  id: string;
  homeTeamEntryId: string;
  awayTeamEntryId: string;
  slug: string;
  startsAt: string | null;
  status: string;
  homeScore: number;
  awayScore: number;
  resultType: string;
  technicalWinnerTeamEntryId: string | null;
  isPlayoff: boolean;
  periodScores: string | null;
  venue: string | null;
  stageName: string;
  stageType: string;
  home: DivisionMatchTeam;
  away: DivisionMatchTeam;
};

export type DivisionMatchTeam = {
  slug: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  calendarAccent: string | null;
};

export type DivisionPlayerStatistic = {
  key: string;
  slug: string;
  name: string;
  position: string;
  photoUrl: string | null;
  teamSlug: string;
  teamName: string;
  games: number;
  goals: number;
  assists: number;
  penalty: number;
  points: number;
  isGoalkeeper: boolean;
  goalieGames: number;
  goalieMinutes: number;
  shotsAgainst: number | null;
  goalieGoalsAgainst: number;
  shutouts: number | null;
  saves: number | null;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
};

export type DivisionPageData = {
  season: { name: string; slug: string };
  competition: {
    name: string;
    path: string;
    type: "CHAMPIONSHIP" | "TOURNAMENT";
  };
  division: { name: string; path: string };
  choices: DivisionChoice[];
  teams: DivisionTeam[];
  matches: DivisionMatch[];
  statistics: DivisionPlayerStatistic[];
  playoffs: PlayoffView[];
};

const transliteration: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "j",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "cz",
  ч: "ch",
  ш: "sh",
  щ: "shh",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function publicSlug(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function competitionPublicPath(
  name: string,
  type: "CHAMPIONSHIP" | "TOURNAMENT",
) {
  return type === "CHAMPIONSHIP" ? "championship" : publicSlug(name);
}

import { formatPeriodScores as scorePeriods } from "./format-period-scores";

export async function getDivisionPage(
  seasonPath: string,
  requestedCompetition: string,
  requestedDivision: string,
): Promise<DivisionPageData | null> {
  const seasons = await prisma.season.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      competitions: {
        orderBy: { sortOrder: "asc" },
        include: { divisions: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  const season = seasons.find((item) => item.slug === seasonPath);
  if (!season) return null;
  const competition = season.competitions.find(
    (item) =>
      competitionPublicPath(item.name, item.type) === requestedCompetition ||
      publicSlug(item.slug) === requestedCompetition ||
      item.slug === requestedCompetition,
  );
  if (!competition) return null;
  const division = competition.divisions.find(
    (item) =>
      publicSlug(item.name) === requestedDivision ||
      publicSlug(item.slug) === requestedDivision ||
      item.slug === requestedDivision,
  );
  if (!division) return null;

  const choices: DivisionChoice[] = seasons.flatMap((seasonItem) =>
    seasonItem.competitions.flatMap((competitionItem) => {
      const compPath = competitionPublicPath(
        competitionItem.name,
        competitionItem.type,
      );
      return competitionItem.divisions.map((divisionItem) => {
        const divPath = publicSlug(divisionItem.name);
        return {
          seasonName: seasonItem.name,
          seasonSlug: seasonItem.slug,
          competitionName: competitionItem.name,
          competitionPath: compPath,
          competitionType: competitionItem.type,
          divisionName: divisionItem.name,
          divisionPath: divPath,
          href: `/competition/${seasonItem.slug}/${compPath}/${divPath}`,
        };
      });
    }),
  );

  const [details, goalieProtocols] = await Promise.all([prisma.division.findUnique({
    where: { id: division.id },
    include: {
      teamEntries: {
        include: {
          team: true,
          playerStats: { include: { player: true } },
        },
      },
      matches: {
        orderBy: { startsAt: "asc" },
        include: {
          stage: true,
          venue: true,
          penalties: true,
          homeTeamEntry: { include: { team: true } },
          awayTeamEntry: { include: { team: true } },
        },
      },
    },
  }), getGoalieProtocolStatistics({ divisionId: division.id })]);
  if (!details) return null;

  const standingsMatches = details.matches.filter(
    (match) => match.status === "FINAL" && !match.isPlayoff && match.stage.countsForStandings,
  );
  const calculated = calculateStandings(
    standingsMatches.map((match) => {
      const protocol =
        match.protocolData && typeof match.protocolData === "object"
          ? (match.protocolData as Record<string, unknown>)
          : {};
      return {
      home: match.homeTeamEntryId,
      away: match.awayTeamEntryId,
      homeGoals: match.homeScore,
      awayGoals: match.awayScore,
      homePenaltyMinutes: match.penalties
        .filter((penalty) => penalty.teamEntryId === match.homeTeamEntryId)
        .reduce((sum, penalty) => sum + penalty.minutes, 0),
      awayPenaltyMinutes: match.penalties
        .filter((penalty) => penalty.teamEntryId === match.awayTeamEntryId)
        .reduce((sum, penalty) => sum + penalty.minutes, 0),
      technicalWinner:
        match.resultType === "TECHNICAL" &&
        typeof protocol.technicalWinnerTeamEntryId === "string"
          ? protocol.technicalWinnerTeamEntryId
          : null,
      excludeGoals: match.resultType === "TECHNICAL",
    };
    }),
  );
  const calculatedByTeam = new Map(calculated.map((row) => [row.team, row]));
  const orderedEntries = [...details.teamEntries].sort((a, b) => {
    const aRow = calculatedByTeam.get(a.id);
    const bRow = calculatedByTeam.get(b.id);
    if (aRow && bRow)
      return calculated.indexOf(aRow) - calculated.indexOf(bRow);
    if (aRow) return -1;
    if (bRow) return 1;
    return a.team.name.localeCompare(b.team.name, "ru");
  });

  const teams = orderedEntries.map((entry, index): DivisionTeam => {
    const row = calculatedByTeam.get(entry.id) ?? {
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
    const form = standingsMatches
      .filter(
        (match) =>
          match.homeTeamEntryId === entry.id ||
          match.awayTeamEntryId === entry.id,
      )
      .sort(
        (a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0),
      )
      .slice(0, 5)
      .reverse()
      .map((match) => {
        const isHome = match.homeTeamEntryId === entry.id;
        const protocol =
          match.protocolData && typeof match.protocolData === "object"
            ? (match.protocolData as Record<string, unknown>)
            : {};
        const technicalWinner = protocol.technicalWinnerTeamEntryId;
        const own = isHome ? match.homeScore : match.awayScore;
        const opponent = isHome ? match.awayScore : match.homeScore;
        return {
          result:
            match.resultType === "TECHNICAL"
              ? technicalWinner === entry.id
                ? ("w" as const)
                : ("l" as const)
              : own === opponent
              ? ("d" as const)
              : own > opponent
                ? ("w" as const)
                : ("l" as const),
          matchSlug: match.slug,
        };
      });
    return {
      rank: index + 1,
      id: entry.id,
      slug: entry.team.slug,
      name: entry.team.name,
      city: entry.team.city,
      logoUrl: entry.team.logoUrl,
      ...row,
      form,
    };
  });

  const matches = details.matches.map(
    (match): DivisionMatch => ({
      id: match.id,
      homeTeamEntryId: match.homeTeamEntryId,
      awayTeamEntryId: match.awayTeamEntryId,
      slug: match.slug,
      startsAt: match.startsAt?.toISOString() ?? null,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      resultType: match.resultType,
      technicalWinnerTeamEntryId:
        match.resultType === "TECHNICAL" &&
        match.protocolData &&
        typeof match.protocolData === "object" &&
        typeof (match.protocolData as Record<string, unknown>).technicalWinnerTeamEntryId === "string"
          ? ((match.protocolData as Record<string, unknown>).technicalWinnerTeamEntryId as string)
          : null,
      isPlayoff: match.isPlayoff,
      periodScores: scorePeriods(match.periodScores),
      venue: match.venue
        ? [match.venue.name, match.venue.city].filter(Boolean).join(" · ")
        : null,
      stageName: match.stage.name,
      stageType: match.stage.type,
      home: {
        slug: match.homeTeamEntry.team.slug,
        name: match.homeTeamEntry.team.name,
        city: match.homeTeamEntry.team.city,
        logoUrl: match.homeTeamEntry.team.logoUrl,
        calendarAccent: match.homeTeamEntry.team.calendarAccent,
      },
      away: {
        slug: match.awayTeamEntry.team.slug,
        name: match.awayTeamEntry.team.name,
        city: match.awayTeamEntry.team.city,
        logoUrl: match.awayTeamEntry.team.logoUrl,
        calendarAccent: match.awayTeamEntry.team.calendarAccent,
      },
    }),
  );

  const statistics = details.teamEntries.flatMap((entry) =>
    entry.playerStats.map((stat): DivisionPlayerStatistic => {
      const totals = goalieStatisticsFor(stat, goalieProtocols.get(goalieStatisticKey(entry.id, stat.playerId)));
      const goalie = calculateGoalieMetrics(
        totals.goalieSeconds,
        totals.shotsAgainst ?? 0,
        totals.goalieGoalsAgainst,
      );
      return {
        key: `${entry.id}-${stat.playerId}`,
        slug: stat.player.slug,
        name: [
          stat.player.lastName,
          stat.player.firstName,
        ]
          .filter(Boolean)
          .join(" "),
        position: stat.player.position || "Игрок",
        photoUrl: stat.player.photoUrl,
        teamSlug: entry.team.slug,
        teamName: entry.team.name,
        games: stat.games,
        goals: stat.goals,
        assists: stat.assists,
        penalty: stat.penaltyMinutes,
        points: stat.goals + stat.assists,
        isGoalkeeper:
          (stat.player.position || "").toLocaleLowerCase("ru").includes("вратар") ||
          totals.goalieGames > 0,
        goalieGames: totals.goalieGames,
        goalieMinutes: Math.floor(totals.goalieSeconds / 60),
        shotsAgainst: totals.shotsAgainst,
        goalieGoalsAgainst: totals.goalieGoalsAgainst,
        shutouts: totals.shutouts,
        saves: totals.shotsAgainst === null ? null : goalie.saves,
        savePercentage: goalie.savePercentage,
        goalsAgainstAverage: goalie.goalsAgainstAverage,
      };
    }),
  );

  return {
    season: { name: season.name, slug: season.slug },
    competition: {
      name: competition.name,
      path: competitionPublicPath(competition.name, competition.type),
      type: competition.type,
    },
    division: { name: division.name, path: publicSlug(division.name) },
    choices,
    teams,
    matches,
    statistics,
    playoffs: (await prisma.playoff.findMany({where:{divisionId:division.id,published:true},include:playoffInclude})).map(playoffView),
  };
}
