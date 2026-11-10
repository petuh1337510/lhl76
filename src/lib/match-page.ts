import "server-only";

import { competitionPublicPath, publicSlug } from "@/lib/division-page";
import { matchClockResolver } from "@/lib/domain/match-clock";
import { calculateMatchGoalies, sumPeriodShots } from "@/lib/domain/match-goalies";
import { prisma } from "@/lib/prisma";

export type PublicMatchEvent = {
  id: string;
  minute: string | null;
  type: "goal" | "penalty" | "penalty-shot" | "shootout";
  teamName: string;
  playerName: string | null;
  detail: string | null;
};

export type PublicMatchData = {
  slug: string;
  backHref: string;
  season: string;
  competition: string;
  division: string;
  stage: string;
  isPlayoff: boolean;
  startsAt: string | null;
  status: string;
  resultType: string;
  technicalWinner: "home" | "away" | null;
  score: { home: number; away: number };
  periodScores: string | null;
  periods: Array<{ label: string; home: number; away: number }>;
  resultNote: string | null;
  venue: { slug: string; name: string; city: string | null; address: string | null } | null;
  home: {
    slug: string;
    name: string;
    city: string | null;
    logoUrl: string | null;
  };
  away: {
    slug: string;
    name: string;
    city: string | null;
    logoUrl: string | null;
  };
  rosters: {
    home: PublicMatchRosterPlayer[];
    away: PublicMatchRosterPlayer[];
  };
  playerStats: {
    home: PublicMatchPlayerStat[];
    away: PublicMatchPlayerStat[];
  };
  goalieStats: {
    home: PublicMatchGoalieStat[];
    away: PublicMatchGoalieStat[];
  };
  shots: Array<{ label: string; home: number; away: number }>;
  timeouts: Array<{ teamName: string; time: string }>;
  goalieStints: Array<{
    teamName: string;
    playerName: string;
    from: string;
    to: string;
    shotsAgainst: number | null;
  }>;
  shootouts: Array<{
    order: number;
    teamName: string;
    playerName: string;
    goalieName: string | null;
    scored: boolean;
  }>;
  events: PublicMatchEvent[];
};

export type PublicMatchRosterPlayer = {
  id: string;
  slug: string;
  name: string;
  number: string;
  position: string;
  qualification: string;
  photoUrl: string | null;
};

export type PublicMatchPlayerStat = PublicMatchRosterPlayer & {
  goals: number;
  assists: number;
  points: number;
  penaltyMinutes: number;
};

export type PublicMatchGoalieStat = PublicMatchRosterPlayer & {
  timePlayed: string;
  goalsAgainst: number | null;
  shotsAgainst: number | null;
  saves: number | null;
  savePercentage: string;
};

function playerName(
  player: {
    lastName: string;
    firstName: string;
    patronymic: string | null;
  } | null,
) {
  return player
    ? [player.lastName, player.firstName].filter(Boolean).join(" ")
    : null;
}

function periodScores(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value))
    return value
      .map((item) =>
        item && typeof item === "object" && "home" in item && "away" in item
          ? `${Number(item.home) || 0}:${Number(item.away) || 0}`
          : String(item),
      )
      .join(" · ");
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>)
      .map(String)
      .join(" · ");
  return String(value);
}

export async function getPublicMatch(
  slug: string,
): Promise<PublicMatchData | null> {
  const match = await prisma.match.findUnique({
    where: { slug },
    include: {
      venue: true,
      stage: true,
      division: { include: { competition: { include: { season: true } } } },
      homeTeamEntry: {
        include: {
          team: true,
          roster: {
            include: {
              player: {
                include: {
                  ratingCategory: true,
                },
              },
            },
          },
        },
      },
      awayTeamEntry: {
        include: {
          team: true,
          roster: {
            include: {
              player: {
                include: {
                  ratingCategory: true,
                },
              },
            },
          },
        },
      },
      rosters: {
        include: {
          rosterEntry: {
            include: {
              player: {
                include: {
                  ratingCategory: true,
                },
              },
            },
          },
        },
      },
      legacyEvents: {
        orderBy: [{ minute: "asc" }, { eventType: "asc" }],
        include: { player: true, teamEntry: { include: { team: true } } },
      },
      goals: {
        include: {
          scorer: true,
          assists: { include: { player: true }, orderBy: { order: "asc" } },
          teamEntry: { include: { team: true } },
        },
      },
      penalties: {
        include: { player: true, teamEntry: { include: { team: true } } },
      },
      penaltyShots: {
        include: {
          player: true,
          goalie: true,
          teamEntry: { include: { team: true } },
        },
        orderBy: { attemptOrder: "asc" },
      },
    },
  });
  if (!match) return null;

  const protocol =
    match.protocolData && typeof match.protocolData === "object"
      ? (match.protocolData as Record<string, unknown>)
      : {};
  const legacyGoals = match.legacyEvents.filter(
    (event) => event.eventType.toLocaleLowerCase("ru") === "гол",
  );
  const legacyPenalties = match.legacyEvents.filter(
    (event) => event.eventType.toLocaleLowerCase("ru") === "штраф",
  );
  // An edited protocol is authoritative. Legacy rows remain in the database
  // for import history, but must not hide newly saved goals or resurrect deletions.
  const editedProtocol = protocol.eventTimesAbsolute === true;
  const publicGoals = editedProtocol || legacyGoals.length === 0 ? match.goals : [];
  const publicPenalties = editedProtocol || legacyPenalties.length === 0 ? match.penalties : [];
  const timelineLegacyGoals = editedProtocol ? [] : legacyGoals;
  const timelineLegacyPenalties = editedProtocol ? [] : legacyPenalties;
  const clock = (seconds: number | null) =>
    seconds === null
      ? null
      : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const matchSeconds = matchClockResolver(protocol, match.legacyEvents);
  const eventClock = (
    seconds: number | null,
    teamEntryId: string,
    playerId: string | null,
    legacyType: "Гол" | "Штраф",
  ) => clock(matchSeconds(seconds, teamEntryId, playerId, legacyType));
  const eventSort = (value: string | null) => {
    if (!value) return 0;
    const [minutes, seconds] = value.split(":").map(Number);
    return minutes * 60 + seconds;
  };
  const events: (PublicMatchEvent & { sort: number })[] = [
    ...publicGoals.map((goal) => ({
      id: goal.id,
      minute: eventClock(goal.clockSeconds, goal.teamEntryId, goal.scorerId, "Гол"),
      type: "goal" as const,
      teamName: goal.teamEntry.team.name,
      playerName: playerName(goal.scorer),
      detail:
        goal.situation === "PENALTY_SHOT"
          ? "Штрафной бросок реализован"
          : [
              goal.situation || "5×5",
              goal.assists.length
                ? `Передачи: ${goal.assists
                    .map((assist) => playerName(assist.player))
                    .filter(Boolean)
                    .join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
      sort: eventSort(eventClock(goal.clockSeconds, goal.teamEntryId, goal.scorerId, "Гол")),
    })),
    ...publicPenalties.map((penalty) => ({
      id: penalty.id,
      minute: eventClock(penalty.clockSeconds, penalty.teamEntryId, penalty.playerId, "Штраф"),
      type: "penalty" as const,
      teamName: penalty.teamEntry.team.name,
      playerName: penalty.playerId ? playerName(penalty.player) : "Командный штраф",
      detail:
        [
          !penalty.playerId ? penalty.teamEntry.team.name : null,
          `${penalty.minutes} мин.`,
          penalty.reason,
          penalty.reasonCode ? `код ${penalty.reasonCode}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      sort: eventSort(eventClock(penalty.clockSeconds, penalty.teamEntryId, penalty.playerId, "Штраф")),
    })),
    ...match.penaltyShots.map((shot) => ({
      id: shot.id,
      minute:
        shot.phase === "SHOOTOUT"
          ? `Б${shot.attemptOrder}`
          : clock(shot.clockSeconds),
      type:
        shot.phase === "SHOOTOUT"
          ? ("shootout" as const)
          : ("penalty-shot" as const),
      teamName: shot.teamEntry.team.name,
      playerName: playerName(shot.player),
      detail: [
        shot.phase === "SHOOTOUT" ? "Послематчевый буллит" : "Штрафной бросок",
        shot.scored ? "реализован" : "не реализован",
        shot.goalie ? `вратарь: ${playerName(shot.goalie)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      sort:
        shot.phase === "SHOOTOUT"
          ? 100000 + shot.attemptOrder
          : (shot.clockSeconds ?? 0),
    })),
    ...timelineLegacyGoals.map((event) => {
      const assists = match.legacyEvents
        .filter(
          (candidate) =>
            candidate.eventType.toLocaleLowerCase("ru") === "передача" &&
            candidate.minute === event.minute &&
            candidate.teamEntryId === event.teamEntryId,
        )
        .map((candidate) => playerName(candidate.player))
        .filter(Boolean);
      return {
        id: event.id,
        minute: event.minute,
        type: "goal" as const,
        teamName: event.teamEntry?.team.name ?? "Команда",
        playerName: playerName(event.player),
        detail: assists.length ? `Передачи: ${assists.join(", ")}` : null,
        sort: Number((event.minute || "0").replace(":", ".")),
      };
    }),
    ...timelineLegacyPenalties.map((event) => ({
      id: event.id,
      minute: event.minute,
      type: "penalty" as const,
      teamName: event.teamEntry?.team.name ?? "Команда",
      playerName: event.playerId ? playerName(event.player) : "Командный штраф",
      detail:
        [!event.playerId ? event.teamEntry?.team.name : null, event.count ? `${event.count} мин.` : null, event.reason]
          .filter(Boolean)
          .join(" · ") || null,
      sort: Number((event.minute || "0").replace(":", ".")),
    })),
  ].sort((a, b) => a.sort - b.sort);

  const competition = match.division.competition;
  const technicalWinnerTeamEntryId =
    match.resultType === "TECHNICAL" &&
    typeof protocol.technicalWinnerTeamEntryId === "string"
      ? protocol.technicalWinnerTeamEntryId
      : null;
  const technicalWinner =
    technicalWinnerTeamEntryId === match.homeTeamEntryId
      ? "home"
      : technicalWinnerTeamEntryId === match.awayTeamEntryId
        ? "away"
        : null;
  const technical = match.resultType === "TECHNICAL" && technicalWinner !== null;
  const rawPeriods = Array.isArray(match.periodScores)
    ? (match.periodScores as Array<{ home?: unknown; away?: unknown }>)
    : [];
  const periods = rawPeriods.map((row, index) => ({
    label: `${index + 1} период`,
    home: Number(row?.home) || 0,
    away: Number(row?.away) || 0,
  }));
  const rawShots = Array.isArray(protocol.shots)
    ? (protocol.shots as Array<{ home?: unknown; away?: unknown }>)
    : [];
  const shots = rawShots.map((row, index) => ({
    label: `${index + 1} период`,
    home: Number(row?.home) || 0,
    away: Number(row?.away) || 0,
  }));
  const allPlayers = new Map(
    match.rosters.map((row) => [
      row.rosterEntry.playerId,
      row.rosterEntry.player,
    ]),
  );
  const rosterFor = (teamEntryId: string): PublicMatchRosterPlayer[] =>
    match.rosters
      .filter((row) => row.rosterEntry.teamEntryId === teamEntryId)
      .map((row) => {
        return {
          id: row.rosterEntry.playerId,
          slug: row.rosterEntry.player.deletedAt ? "" : row.rosterEntry.player.slug,
          name: playerName(row.rosterEntry.player) || "Игрок",
          number: row.numberOverride || row.rosterEntry.number || row.rosterEntry.player.baseNumber || "—",
          position: row.rosterEntry.player.position || "Игрок",
          qualification: row.rosterEntry.player.ratingCategory?.name || "—",
          photoUrl: row.rosterEntry.player.photoUrl,
        };
      })
      .sort(
        (a, b) =>
          Number(a.number.replace(/\D/g, "")) -
            Number(b.number.replace(/\D/g, "")) ||
          a.name.localeCompare(b.name, "ru"),
      );
  const statParticipantsFor = (
    teamEntryId: string,
  ): PublicMatchRosterPlayer[] => {
    const participants = new Map(
      rosterFor(teamEntryId).map((player) => [player.id, player]),
    );
    const seasonRoster =
      teamEntryId === match.homeTeamEntryId
        ? match.homeTeamEntry.roster
        : match.awayTeamEntry.roster;
    const eventPlayers = [
      ...match.goals
        .filter((goal) => goal.teamEntryId === teamEntryId)
        .flatMap((goal) => [goal.scorer, ...goal.assists.map((assist) => assist.player)]),
      ...match.penalties
        .filter((penalty) => penalty.teamEntryId === teamEntryId)
        .map((penalty) => penalty.player)
        .filter((player): player is NonNullable<typeof player> => Boolean(player)),
    ];

    for (const eventPlayer of eventPlayers) {
      if (participants.has(eventPlayer.id)) continue;
      const rosterEntry = seasonRoster.find(
        (entry) => entry.playerId === eventPlayer.id,
      );
      participants.set(eventPlayer.id, {
        id: eventPlayer.id,
        slug: eventPlayer.deletedAt ? "" : eventPlayer.slug,
        name: playerName(eventPlayer) || "Игрок",
        number: rosterEntry?.number || rosterEntry?.player.baseNumber || "—",
        position: eventPlayer.position || "Игрок",
        qualification: rosterEntry?.player.ratingCategory?.name || "—",
        photoUrl: eventPlayer.photoUrl,
      });
    }

    return [...participants.values()];
  };
  const statsFor = (teamEntryId: string): PublicMatchPlayerStat[] =>
    statParticipantsFor(teamEntryId)
      .map((player) => {
        const goals = match.goals.filter(
          (goal) => goal.teamEntryId === teamEntryId && goal.scorerId === player.id,
        ).length;
        const assists = match.goals
          .filter((goal) => goal.teamEntryId === teamEntryId)
          .reduce(
            (total, goal) =>
              total +
              goal.assists.filter((assist) => assist.playerId === player.id)
                .length,
            0,
          );
        const penaltyMinutes = match.penalties
          .filter(
            (penalty) =>
              penalty.teamEntryId === teamEntryId && penalty.playerId === player.id,
          )
          .reduce((total, penalty) => total + penalty.minutes, 0);
        return {
          ...player,
          goals,
          assists,
          points: goals + assists,
          penaltyMinutes,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goals - a.goals ||
          a.name.localeCompare(b.name, "ru"),
      );
  const teamNameById = (teamEntryId: string) =>
    teamEntryId === match.homeTeamEntryId
      ? match.homeTeamEntry.team.name
      : match.awayTeamEntry.team.name;
  const timeouts = Array.isArray(protocol.timeouts)
    ? (protocol.timeouts as Array<{ teamEntryId?: string; time?: string }>).map(
        (row) => ({
          teamName: teamNameById(row.teamEntryId || ""),
          time: row.time || "—",
        }),
      )
    : [];
  const goalieStints = Array.isArray(protocol.goalieStints)
    ? (
        protocol.goalieStints as Array<{
          teamEntryId?: string;
          playerId?: string;
          from?: string;
          to?: string;
          shotsAgainst?: unknown;
        }>
      ).map((row) => ({
        teamName: teamNameById(row.teamEntryId || ""),
        playerName:
          playerName(allPlayers.get(row.playerId || "") || null) ||
          "Игрок не указан",
        from: row.from || "00:00",
        to: row.to || "60:00",
        shotsAgainst:
          row.shotsAgainst === "" || row.shotsAgainst === undefined
            ? null
            : Math.max(0, Number(row.shotsAgainst) || 0),
      }))
    : [];
  const matchGoalies = calculateMatchGoalies({
    ...match,
    goals: match.goals.map(goal => ({ ...goal, clockSeconds: matchSeconds(goal.clockSeconds, goal.teamEntryId, goal.scorerId, "Гол") })),
    shootoutGoals: match.penaltyShots.filter(shot => shot.phase === "SHOOTOUT" && shot.scored),
  });
  const goalieStatsFor = (
    teamEntryId: string,
    fallbackShotsAgainst: number | null,
  ): PublicMatchGoalieStat[] => {
    const roster = new Map(rosterFor(teamEntryId).map(player => [player.id, player]));
    return matchGoalies.filter(goalie => goalie.teamEntryId === teamEntryId).map(goalie => {
      const player = roster.get(goalie.playerId);
      const shotsAgainst = goalie.shotsAgainst ?? (goalie.playedFullGame ? fallbackShotsAgainst : null);
      const goalsAgainst = goalie.goalsAgainst;
      const saves = shotsAgainst === null || goalsAgainst === null ? null : Math.max(0, shotsAgainst - goalsAgainst);
      return {
        id: goalie.playerId,
        slug: player?.slug || "",
        name: player?.name || "Игрок не указан",
        number: player?.number || "—",
        position: player?.position || "Вратарь",
        qualification: player?.qualification || "—",
        photoUrl: player?.photoUrl || null,
        timePlayed: `${Math.floor(goalie.seconds / 60)}:${String(goalie.seconds % 60).padStart(2, "0")}`,
        goalsAgainst,
        shotsAgainst,
        saves,
        savePercentage:
          shotsAgainst && saves !== null
            ? `${((saves / shotsAgainst) * 100).toFixed(1)}%`
            : "—",
      };
    });
  };
  const teamShape = (entry: typeof match.homeTeamEntry) => ({
    slug: entry.team.slug,
    name: entry.team.name,
    city: entry.team.city,
    logoUrl: entry.team.logoUrl,
  });
  return {
    slug: match.slug,
    backHref: `/competition/${competition.season.slug}/${competitionPublicPath(competition.name, competition.type)}/${publicSlug(match.division.name)}`,
    season: competition.season.name,
    competition: competition.name,
    division: match.division.name,
    stage: match.stage.name,
    isPlayoff: match.isPlayoff,
    startsAt: match.startsAt?.toISOString() ?? null,
    status: match.status,
    resultType: match.resultType,
    technicalWinner,
    score: { home: match.homeScore, away: match.awayScore },
    periodScores: technical ? null : periodScores(match.periodScores),
    periods: technical ? [] : periods,
    resultNote: match.resultNote,
    venue: match.venue
      ? {
          slug: match.venue.slug,
          name: match.venue.name,
          city: match.venue.city,
          address: match.venue.address,
        }
      : null,
    home: teamShape(match.homeTeamEntry),
    away: teamShape(match.awayTeamEntry),
    rosters: {
      home: rosterFor(match.homeTeamEntryId),
      away: rosterFor(match.awayTeamEntryId),
    },
    playerStats: {
      home: statsFor(match.homeTeamEntryId).map((row) => technical ? { ...row, goals: 0, assists: 0, points: 0, penaltyMinutes: 0 } : row),
      away: statsFor(match.awayTeamEntryId).map((row) => technical ? { ...row, goals: 0, assists: 0, points: 0, penaltyMinutes: 0 } : row),
    },
    goalieStats: {
      home: technical ? [] : goalieStatsFor(
        match.homeTeamEntryId,
        sumPeriodShots(rawShots, "away"),
      ),
      away: technical ? [] : goalieStatsFor(
        match.awayTeamEntryId,
        sumPeriodShots(rawShots, "home"),
      ),
    },
    shots: technical ? [] : shots,
    timeouts: technical ? [] : timeouts,
    goalieStints: technical ? [] : goalieStints,
    shootouts: technical ? [] : match.penaltyShots
      .filter((shot) => shot.phase === "SHOOTOUT")
      .map((shot) => ({
        order: shot.attemptOrder,
        teamName: shot.teamEntry.team.name,
        playerName: playerName(shot.player) || "Игрок не указан",
        goalieName: playerName(shot.goalie),
        scored: shot.scored,
      })),
    events: technical ? [] : events.map(({ sort: _sort, ...event }) => event),
  };
}
