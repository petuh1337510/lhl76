import "server-only";

import { prisma } from "@/lib/prisma";
import { getPlayerSuspensionStates } from "@/lib/player-suspensions";

export type TeamProfilePlayer = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  patronymic: string | null;
  position: string;
  number: string;
  qualification: string;
  birthDate: string;
  photoUrl: string | null;
  leadership: "К" | "А" | null;
  suspended: boolean;
  suspension: { reason: string; note: string | null; sourceTeam: string; sourceDivision: string; remaining: number | null; matchesCount: number | null } | null;
};

export type TeamProfileMatch = {
  id: string;
  slug: string;
  startsAt: string | null;
  status: string;
  homeScore: number;
  awayScore: number;
  technicalWinner: "home" | "away" | null;
  isPlayoff: boolean;
  periodScores: string | null;
  venue: string | null;
  home: TeamProfileMatchTeam;
  away: TeamProfileMatchTeam;
};

export type TeamProfileMatchTeam = {
  slug: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
};

export type TeamProfileStatistic = {
  playerId: string;
  slug: string;
  name: string;
  position: string;
  photoUrl: string | null;
  games: number;
  goals: number;
  assists: number;
  penalty: number;
  points: number;
};

export type TeamProfileCompetition = {
  id: string;
  label: string;
  season: string;
  competition: string;
  division: string;
  players: TeamProfilePlayer[];
  matches: TeamProfileMatch[];
  statistics: TeamProfileStatistic[];
};

export type TeamProfileData = {
  slug: string;
  name: string;
  city: string | null;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  teamPhotoUrl: string | null;
  vkUrl: string | null;
  telegramUrl: string | null;
  websiteUrl: string | null;
  achievements: Array<{ medal: string; year: string; title: string }>;
  competitions: TeamProfileCompetition[];
};

const TEAM_SLUG_ALIASES: Record<string, string> = {
  tanki: "hctanki76",
};

const dateOnly = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" }).format(
        value,
      )
    : "—";

const positionRank = (position: string) => {
  const normalized = position.toLocaleLowerCase("ru");
  if (normalized.includes("врат")) return 0;
  if (normalized.includes("защит")) return 1;
  if (normalized.includes("напад")) return 2;
  return 3;
};

function parseAchievements(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (Array.isArray(item) && item.length >= 3) {
      return [
        {
          medal: String(item[0]),
          year: String(item[1]),
          title: String(item[2]),
        },
      ];
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (record.title)
        return [
          {
            medal: String(record.medal ?? "•"),
            year: String(record.year ?? ""),
            title: String(record.title),
          },
        ];
    }
    return [];
  });
}

import { formatPeriodScores as periodScores } from "./format-period-scores";

export async function getTeamProfile(
  requestedSlug: string,
): Promise<TeamProfileData | null> {
  const resolvedSlug = TEAM_SLUG_ALIASES[requestedSlug] ?? requestedSlug;
  const team = await prisma.team.findFirst({
    where: { slug: resolvedSlug, deletedAt: null },
    include: {
      entries: {
        include: {
          division: { include: { competition: { include: { season: true } } } },
          roster: {
            include: {
              player: {
                include: { ratingCategory: true },
              },
            },
          },
          playerStats: { include: { player: true } },
          homeMatches: {
            include: {
              venue: true,
              homeTeamEntry: { include: { team: true } },
              awayTeamEntry: { include: { team: true } },
            },
          },
          awayMatches: {
            include: {
              venue: true,
              homeTeamEntry: { include: { team: true } },
              awayTeamEntry: { include: { team: true } },
            },
          },
        },
      },
    },
  });

  if (!team) return null;
  const activeSuspensions = await getPlayerSuspensionStates(
    [...new Set(team.entries.flatMap((entry) => entry.roster.map((roster) => roster.playerId)))],
    new Date(),
  );

  const orderedEntries = [...team.entries].sort((a, b) => {
    const seasonOrder =
      b.division.competition.season.startsAt.getTime() -
      a.division.competition.season.startsAt.getTime();
    if (seasonOrder) return seasonOrder;
    const typeOrder =
      (a.division.competition.type === "CHAMPIONSHIP" ? 0 : 1) -
      (b.division.competition.type === "CHAMPIONSHIP" ? 0 : 1);
    if (typeOrder) return typeOrder;
    return (
      a.division.competition.sortOrder - b.division.competition.sortOrder ||
      a.division.sortOrder - b.division.sortOrder
    );
  });

  const competitions = orderedEntries.map((entry): TeamProfileCompetition => {
    const season = entry.division.competition.season;
    const players = entry.roster
      .filter((rosterEntry) => rosterEntry.status !== "INACTIVE")
      .map((rosterEntry): TeamProfilePlayer => {
        const player = rosterEntry.player;
        return {
          id: player.id,
          slug: player.slug,
          firstName: player.firstName,
          lastName: player.lastName,
          patronymic: player.patronymic,
          position: player.position || "Игрок",
          number: rosterEntry.number || player.baseNumber || "—",
          qualification: player.ratingCategory?.name || "—",
          birthDate: dateOnly(player.birthDate),
          photoUrl: player.photoUrl,
          leadership:
            rosterEntry.leadership === "CAPTAIN"
              ? "К"
              : rosterEntry.leadership === "ASSISTANT"
                ? "А"
                : null,
          suspended: activeSuspensions.has(player.id),
          suspension: activeSuspensions.get(player.id)?.[0] ?? null,
        };
      })
      .sort(
        (a, b) =>
          positionRank(a.position) - positionRank(b.position) ||
          a.lastName.localeCompare(b.lastName, "ru") ||
          a.firstName.localeCompare(b.firstName, "ru"),
      );

    const matches = [...entry.homeMatches, ...entry.awayMatches]
      .sort(
        (a, b) =>
          (a.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
      )
      .map(
        (match): TeamProfileMatch => ({
          id: match.id,
          slug: match.slug,
          startsAt: match.startsAt?.toISOString() ?? null,
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          technicalWinner:
            match.resultType === "TECHNICAL" &&
            match.protocolData &&
            typeof match.protocolData === "object" &&
            typeof (match.protocolData as Record<string, unknown>).technicalWinnerTeamEntryId === "string"
              ? (match.protocolData as Record<string, unknown>).technicalWinnerTeamEntryId === match.homeTeamEntryId
                ? "home"
                : (match.protocolData as Record<string, unknown>).technicalWinnerTeamEntryId === match.awayTeamEntryId
                  ? "away"
                  : null
              : null,
          isPlayoff: match.isPlayoff,
          periodScores: periodScores(match.periodScores),
          venue: match.venue
            ? [match.venue.name, match.venue.city].filter(Boolean).join(" · ")
            : null,
          home: {
            slug: match.homeTeamEntry.team.slug,
            name: match.homeTeamEntry.team.name,
            city: match.homeTeamEntry.team.city,
            logoUrl: match.homeTeamEntry.team.logoUrl,
          },
          away: {
            slug: match.awayTeamEntry.team.slug,
            name: match.awayTeamEntry.team.name,
            city: match.awayTeamEntry.team.city,
            logoUrl: match.awayTeamEntry.team.logoUrl,
          },
        }),
      );

    const statistics = entry.playerStats.map(
      (stat): TeamProfileStatistic => ({
        playerId: stat.playerId,
        slug: stat.player.slug,
        name: [
          stat.player.lastName,
          stat.player.firstName,
        ]
          .filter(Boolean)
          .join(" "),
        position: stat.player.position || "Игрок",
        photoUrl: stat.player.photoUrl,
        games: stat.games,
        goals: stat.goals,
        assists: stat.assists,
        penalty: stat.penaltyMinutes,
        points: stat.goals + stat.assists,
      }),
    );

    return {
      id: entry.id,
      label: `${season.name} · ${entry.division.competition.name} · ${entry.division.name}`,
      season: season.name,
      competition: entry.division.competition.name,
      division: entry.division.name,
      players,
      matches,
      statistics,
    };
  });

  return {
    slug: requestedSlug,
    name: team.name,
    city: team.city,
    shortDescription: team.shortDescription,
    description: team.description,
    logoUrl: team.logoUrl,
    teamPhotoUrl: team.teamPhotoUrl,
    vkUrl: team.vkUrl,
    telegramUrl: team.telegramUrl,
    websiteUrl: team.websiteUrl,
    achievements: parseAchievements(team.achievements),
    competitions,
  };
}
