import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  attachmentUrl, galleryIds, legacyBindings, metaValue, postSlug, postTitle,
  readLegacySeason, serializedString,
} from "./lib/legacy-2023-24-data.mjs";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const sqlPath = args.find((argument) => !argument.startsWith("--"));
const commit = args.includes("--commit");
const replace = args.includes("--replace");
const jsonOnly = args.includes("--json");
const requestedSeason = args.find((argument) => argument.startsWith("--season="))?.split("=")[1] || "2023-24";
const seasonConfigs = {
  "2023-24": {
    name: "2023/24", slug: "2023-24", startsAt: "2023-09-01T00:00:00+03:00", endsAt: "2024-05-31T23:59:59+03:00",
    bindings: legacyBindings,
  },
  "2024-25": {
    name: "2024/25", slug: "2024-25", startsAt: "2024-08-01T00:00:00+03:00", endsAt: "2025-05-31T23:59:59+03:00",
    bindings: [
      { id: 7881, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Плюс" },
      { id: 7880, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель" },
      { id: 7121, competition: "Памяти Локомотива 2024", type: "TOURNAMENT", division: "Любитель Плюс" },
      { id: 7122, competition: "Памяти Локомотива 2024", type: "TOURNAMENT", division: "Любитель" },
      { id: 11172, competition: "Апрельский 2025", type: "TOURNAMENT", division: "Плюс" },
      { id: 11173, competition: "Апрельский 2025", type: "TOURNAMENT", division: "Любитель" },
      { id: 11110, competition: "Апрельский 2025", type: "TOURNAMENT", division: "Старт" },
    ],
  },
  "2025-26": {
    name: "2025/26", slug: "2025-26", startsAt: "2025-09-01T00:00:00+03:00", endsAt: "2026-05-31T23:59:59+03:00",
    bindings: [
      { id: 11617, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Плюс" },
      { id: 11618, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель" },
      { id: 11620, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Старт" },
      { id: 13320, competition: "Апрельский 2026", type: "TOURNAMENT", division: "Любитель Плюс" },
      { id: 13321, competition: "Апрельский 2026", type: "TOURNAMENT", division: "Любитель" },
      { id: 13322, competition: "Апрельский 2026", type: "TOURNAMENT", division: "Старт" },
      { id: 13325, competition: "Апрельский 2026", type: "TOURNAMENT", division: "Дебют" },
    ],
  },
  "2026-27": {
    name: "2026/27", slug: "2026-27", startsAt: "2026-08-01T00:00:00+03:00", endsAt: "2027-05-31T23:59:59+03:00",
    bindings: [
      { id: 13855, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Плюс" },
      { id: 13854, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель" },
      { id: 13852, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Старт" },
      { id: 13853, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Дебют" },
      { id: 13648, competition: "Памяти Локомотива 2026", type: "TOURNAMENT", division: "Плюс" },
      { id: 13650, competition: "Памяти Локомотива 2026", type: "TOURNAMENT", division: "Старт" },
      { id: 13652, competition: "Памяти Локомотива 2026", type: "TOURNAMENT", division: "Дебют" },
    ],
  },
};
const config = seasonConfigs[requestedSeason];
if (!config) {
  console.error(`Неизвестный сезон ${requestedSeason}. Доступно: ${Object.keys(seasonConfigs).join(", ")}`);
  process.exit(1);
}
const SOURCE = `joomsport:lhlnew:${requestedSeason}`;
if (!sqlPath || !fs.existsSync(sqlPath)) {
  console.error("Usage: pnpm legacy:import -- <dump.sql> [--commit] [--replace]");
  process.exit(1);
}

function assertSafeTarget() {
  if (!commit) return;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Для записи требуется DATABASE_URL тестовой базы.");
  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, "");
  if (!/(?:test|import|staging)/i.test(database) || process.env.LEGACY_IMPORT_CONFIRM !== requestedSeason) {
    throw new Error(`Импорт разрешен только в базу с test/import/staging в имени и с LEGACY_IMPORT_CONFIRM=${requestedSeason}.`);
  }
}

const slugify = (value, fallback) => {
  const slug = String(value || "").toLowerCase().replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");
  return slug || fallback;
};
const plainText = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
const intOrNull = (value) => /^\d+$/.test(String(value || "")) ? Number(value) : null;
const clockSecondsOrNull = (value) => {
  const text = String(value || "").trim();
  if (/^\d{1,3}:\d{2}$/.test(text)) {
    const [minutes, seconds] = text.split(":").map(Number);
    return seconds < 60 ? minutes * 60 + seconds : null;
  }
  const minutes = intOrNull(text);
  return minutes === null ? null : minutes * 60;
};
const dateOrNull = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) || value === "0000-00-00") return null;
  const date = new Date(`${value}T00:00:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const startDate = (date, time) => dateOrNull(date)
  ? new Date(`${date}T${/^\d{1,2}:\d{2}$/.test(String(time)) ? String(time).padStart(5, "0") : "00:00"}:00+03:00`)
  : null;
const chunks = (items, size = 750) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const createMany = async (model, items) => { for (const chunk of chunks(items)) if (chunk.length) await model.createMany({ data: chunk }); };
const unique = (items) => [...new Set(items)];

function classifyStage(name) {
  if (/за\s*3|треть/i.test(name)) return ["THIRD_PLACE", false];
  if (/1\/4/i.test(name)) return ["QUARTERFINAL", false];
  if (/1\/2/i.test(name)) return ["SEMIFINAL", false];
  if (/финал/i.test(name) && !/плей-?офф/i.test(name)) return ["FINAL", false];
  if (/плей-?офф/i.test(name)) return ["OTHER", false];
  return ["GROUP_STAGE", true];
}

function makeUniqueSlugs(records, selector, fallbackPrefix) {
  records = [...records];
  const used = new Set();
  return new Map(records.map((id) => {
    const base = slugify(selector(id), `${fallbackPrefix}-${id}`);
    let value = base;
    if (used.has(value)) value = `${base}-${id}`;
    used.add(value);
    return [id, value];
  }));
}

function calculateStandings(teamEntryIds, matches, penalties) {
  const blank = (teamEntryId) => ({ teamEntryId, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, penaltyMinutes: 0 });
  const table = new Map(teamEntryIds.map((id) => [id, blank(id)]));
  for (const match of matches) {
    const home = table.get(match.homeTeamEntryId); const away = table.get(match.awayTeamEntryId);
    if (!home || !away) continue;
    home.games++; away.games++;
    home.goalsFor += match.homeScore; home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore; away.goalsAgainst += match.homeScore;
    if (match.homeScore === match.awayScore) { home.draws++; away.draws++; home.points++; away.points++; }
    else if (match.homeScore > match.awayScore) { home.wins++; home.points += 2; away.losses++; }
    else { away.wins++; away.points += 2; home.losses++; }
  }
  for (const penalty of penalties) table.get(penalty.teamEntryId).penaltyMinutes += penalty.minutes;
  const base = [...table.values()].sort((a, b) => b.points - a.points);
  const result = [];
  for (let start = 0; start < base.length;) {
    let end = start + 1; while (end < base.length && base[end].points === base[start].points) end++;
    const group = base.slice(start, end);
    const tied = new Set(group.map((row) => row.teamEntryId));
    const direct = new Map(group.map((row) => [row.teamEntryId, blank(row.teamEntryId)]));
    for (const match of matches.filter((item) => tied.has(item.homeTeamEntryId) && tied.has(item.awayTeamEntryId))) {
      const home = direct.get(match.homeTeamEntryId); const away = direct.get(match.awayTeamEntryId);
      home.goalsFor += match.homeScore; home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore; away.goalsAgainst += match.homeScore;
      if (match.homeScore === match.awayScore) { home.points++; away.points++; }
      else (match.homeScore > match.awayScore ? home : away).points += 2;
    }
    group.sort((a, b) => (direct.get(b.teamEntryId).points - direct.get(a.teamEntryId).points)
      || ((b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
      || ((direct.get(b.teamEntryId).goalsFor - direct.get(b.teamEntryId).goalsAgainst) - (direct.get(a.teamEntryId).goalsFor - direct.get(a.teamEntryId).goalsAgainst))
      || (b.goalsFor - a.goalsFor) || (b.wins - a.wins) || (a.penaltyMinutes - b.penaltyMinutes)
      || a.teamEntryId.localeCompare(b.teamEntryId));
    result.push(...group); start = end;
  }
  return result;
}

function buildPlan(data, identity = { teams: new Map(), players: new Map(), venues: new Map() }) {
  const bindings = config.bindings;
  const bindingById = new Map(bindings.map((binding) => [binding.id, binding]));
  const season = { id: randomUUID(), name: config.name, slug: config.slug, startsAt: new Date(config.startsAt), endsAt: new Date(config.endsAt), isActive: false };
  const competitionGroups = new Map();
  for (const binding of bindings) {
    const key = `${binding.type}:${binding.competition}`;
    if (!competitionGroups.has(key)) competitionGroups.set(key, { id: randomUUID(), seasonId: season.id, name: binding.competition, slug: slugify(binding.competition, key), type: binding.type, sortOrder: competitionGroups.size, isActive: false });
  }
  const competitions = [...competitionGroups.values()];
  const divisions = bindings.map((binding, sortOrder) => ({
    id: randomUUID(), competitionId: competitionGroups.get(`${binding.type}:${binding.competition}`).id,
    name: binding.division, slug: slugify(binding.division, `division-${binding.id}`), sortOrder,
    legacySeasonId: binding.id,
  }));
  const divisionByLegacy = new Map(divisions.map((division) => [division.legacySeasonId, division]));
  const officialTeamIdsByDivision = new Map(bindings.map((binding) => [binding.id, new Set([
    ...data.standings.filter((row) => Number(row.season_id) === binding.id).map((row) => Number(row.participant_id)),
    ...data.matches.filter((row) => Number(row.seasonID) === binding.id).flatMap((row) => [Number(row.teamHomeID), Number(row.teamAwayID)]),
  ].filter(Boolean))]));
  const teamIds = new Set([...officialTeamIdsByDivision.values()].flatMap((ids) => [...ids]));
  const validPlayerList = data.playerlist.filter((row) => officialTeamIdsByDivision.get(Number(row.season_id))?.has(Number(row.team_id)));
  const playerIds = new Set([
    ...validPlayerList.map((row) => Number(row.player_id)), ...data.squad.map((row) => Number(row.player_id)),
    ...data.matchEvents.map((row) => Number(row.player_id)),
  ].filter(Boolean));
  const teamSlugs = makeUniqueSlugs(teamIds, (id) => postSlug(data, id, `team-${id}`), "team");
  const playerSlugs = makeUniqueSlugs(playerIds, (id) => postSlug(data, id, `player-${id}`), "player");
  const imageFromGallery = (id) => attachmentUrl(data, galleryIds(metaValue(data, id, "vdw_gallery_id"))[0]);
  const teams = [...teamIds].map((legacyId) => {
    const teamExtra = metaValue(data, legacyId, "_joomsport_team_ef");
    const thumbnail = Number(metaValue(data, legacyId, "_thumbnail_id"));
    const existingId = identity.teams.get(String(legacyId));
    return { id: existingId || randomUUID(), reused: Boolean(existingId), legacyId, slug: teamSlugs.get(legacyId), name: postTitle(data, legacyId), shortName: postTitle(data, legacyId), city: serializedString(teamExtra, 11) || null, description: plainText(data.posts.get(legacyId)?.content), logoUrl: attachmentUrl(data, thumbnail), teamPhotoUrl: imageFromGallery(legacyId) };
  });
  const teamByLegacy = new Map(teams.map((team) => [team.legacyId, team]));
  const players = [...playerIds].map((legacyId) => {
    const personal = metaValue(data, legacyId, "_joomsport_player_personal");
    const extra = metaValue(data, legacyId, "_joomsport_player_ef");
    const directPhoto = serializedString(extra, 15);
    return {
      id: identity.players.get(String(legacyId)) || randomUUID(), reused: identity.players.has(String(legacyId)), legacyId, slug: playerSlugs.get(legacyId),
      firstName: serializedString(personal, "first_name"), lastName: serializedString(personal, "last_name"),
      patronymic: serializedString(personal, "short_name") || null, nativeName: serializedString(personal, "home_name") || null,
      birthDate: dateOrNull(serializedString(extra, 1)), country: serializedString(extra, 2) || null,
      birthPlace: serializedString(extra, 3) || null, position: serializedString(extra, 4) || null,
      stickHand: serializedString(extra, 5) || null, heightCm: intOrNull(serializedString(extra, 6)),
      weightKg: intOrNull(serializedString(extra, 7)), league: serializedString(extra, 14) || null,
      photoUrl: imageFromGallery(legacyId) || (/^https?:\/\//.test(directPhoto) ? directPhoto : null),
      laureatePhotoUrl: /^https?:\/\//.test(directPhoto) ? directPhoto : null,
      laureateAchievements: serializedString(extra, 16) || null,
      qualification: serializedString(extra, 10) || null, fallbackNumber: serializedString(extra, 8) || null,
    };
  });
  const playerByLegacy = new Map(players.map((player) => [player.legacyId, player]));
  const teamEntries = [];
  for (const [legacySeasonId, ids] of officialTeamIdsByDivision) for (const teamId of ids) teamEntries.push({ id: randomUUID(), teamId: teamByLegacy.get(teamId).id, divisionId: divisionByLegacy.get(legacySeasonId).id, legacySeasonId, legacyTeamId: teamId });
  const teamEntryByKey = new Map(teamEntries.map((entry) => [`${entry.legacySeasonId}:${entry.legacyTeamId}`, entry]));
  const primaryRosterKeys = new Set(validPlayerList.map((row) => `${row.season_id}:${row.team_id}:${row.player_id}`));
  const historicalKeys = new Set([
    ...data.squad.map((row) => `${row.season_id}:${row.team_id}:${row.player_id}`),
    ...data.matchEvents.map((row) => `${row.season_id}:${row.t_id}:${row.player_id}`),
  ].filter((key) => teamEntryByKey.has(key.split(":").slice(0, 2).join(":"))));
  const rosterKeys = unique([...primaryRosterKeys, ...historicalKeys]);
  const rosterEntries = rosterKeys.map((key) => {
    const [legacySeasonId, legacyTeamId, legacyPlayerId] = key.split(":").map(Number);
    // Пока команда не назначила игроку отдельный номер на новом сайте,
    // во всех заявках используем единый базовый номер из профиля JoomSport.
    const number = playerByLegacy.get(legacyPlayerId).fallbackNumber;
    return { id: randomUUID(), teamEntryId: teamEntryByKey.get(`${legacySeasonId}:${legacyTeamId}`).id, playerId: playerByLegacy.get(legacyPlayerId).id, number: number || null, status: primaryRosterKeys.has(key) ? "ACTIVE" : "INACTIVE", legacyKey: key };
  });
  const rosterByKey = new Map(rosterEntries.map((entry) => [entry.legacyKey, entry]));
  const stageKeys = unique(data.matches.map((row) => `${row.seasonID}:${row.mdID}`));
  const stages = stageKeys.map((key, sortOrder) => {
    const [legacySeasonId, legacyMatchdayId] = key.split(":").map(Number); const name = data.terms.get(legacyMatchdayId) || `Стадия ${legacyMatchdayId}`; const [type, countsForStandings] = classifyStage(name);
    return { id: randomUUID(), divisionId: divisionByLegacy.get(legacySeasonId).id, name, slug: slugify(name, `stage-${legacyMatchdayId}`), type, sortOrder, countsForStandings, legacyKey: key };
  });
  const stageByKey = new Map(stages.map((stage) => [stage.legacyKey, stage]));
  const venueNames = unique(data.matches.map((row) => metaValue(data, Number(row.postID), "_joomsport_match_venue")).filter((value) => value && value !== "0").map(String));
  const venues = venueNames.map((legacyName) => {
    const about = String(metaValue(data, Number(legacyName), "_joomsport_venue_about") || "");
    const name = data.terms.get(Number(legacyName)) || postTitle(data, Number(legacyName)) || legacyName;
    const address = serializedString(metaValue(data, Number(legacyName), "_joomsport_venue_personal"), "venue_addr") || null;
    const locationText = `${name} ${address || ""} ${about}`;
    const city = /переславл/i.test(locationText) ? "Переславль-Залесский"
      : /рыбинск/i.test(locationText) ? "Рыбинск"
        : /некрасов/i.test(locationText) ? "Некрасовское"
          : /ярославл|гуор/i.test(locationText) ? "Ярославль" : null;
    const existingId = identity.venues.get(`${name}::${city || ""}`);
    return { id: existingId || randomUUID(), reused: Boolean(existingId), name, address, city, legacyName };
  });
  const venueByLegacy = new Map(venues.map((venue) => [venue.legacyName, venue]));
  const matchSlugs = makeUniqueSlugs(data.matches.map((row) => Number(row.postID)), (id) => postSlug(data, id, `match-${id}`), "match");
  const matches = data.matches.map((row) => ({
    id: randomUUID(), legacyId: Number(row.postID), slug: matchSlugs.get(Number(row.postID)), divisionId: divisionByLegacy.get(Number(row.seasonID)).id,
    stageId: stageByKey.get(`${row.seasonID}:${row.mdID}`).id,
    homeTeamEntryId: teamEntryByKey.get(`${row.seasonID}:${row.teamHomeID}`).id, awayTeamEntryId: teamEntryByKey.get(`${row.seasonID}:${row.teamAwayID}`).id,
    venueId: venueByLegacy.get(String(metaValue(data, Number(row.postID), "_joomsport_match_venue")))?.id || null,
    startsAt: startDate(row.date, row.time), status: Number(row.status) === 1 ? "FINAL" : "SCHEDULED",
    resultType: "NORMAL", resultNote: (!row.date || row.date === "0000-00-00") ? "Дата отсутствовала в старой базе" : null,
    homeScore: Number(row.scoreHome || 0), awayScore: Number(row.scoreAway || 0), legacySeasonId: Number(row.seasonID),
  }));
  const matchByLegacy = new Map(matches.map((match) => [match.legacyId, match]));
  // JoomSport keeps both checked and unchecked players for every match.
  // squad_type=1 is the actual match squad shown on the legacy public page;
  // squad_type=0 is the rest of the season roster and must not be imported.
  const matchRosters = [...new Map(data.squad.filter((row) => String(row.squad_type) === "1").map((row) => {
    const roster = rosterByKey.get(`${row.season_id}:${row.team_id}:${row.player_id}`); const match = matchByLegacy.get(Number(row.match_id));
    return roster && match ? [`${match.id}:${roster.id}`, { id: randomUUID(), matchId: match.id, rosterEntryId: roster.id, numberOverride: null }] : [randomUUID(), null];
  }).filter(([, value]) => value)).values()];
  const goals = []; const assists = []; const penalties = []; const unlinkedAssists = [];
  const orderedEvents = [...data.matchEvents].sort((a, b) => Number(a.match_id) - Number(b.match_id) || Number(a.eordering) - Number(b.eordering) || Number(a.id) - Number(b.id));
  const recentGoals = new Map();
  for (const event of orderedEvents) {
    const match = matchByLegacy.get(Number(event.match_id)); const player = playerByLegacy.get(Number(event.player_id)); const teamEntry = teamEntryByKey.get(`${event.season_id}:${event.t_id}`);
    if (!match || !teamEntry) continue;
    const clockSeconds = clockSecondsOrNull(event.minutes_input || event.minutes); const period = clockSeconds === null ? null : Math.max(1, Math.floor(clockSeconds / 1200) + 1);
    const eventKey = `${event.match_id}:${event.t_id}:${event.minutes_input || event.minutes}`;
    if (Number(event.e_id) === 1 && player) {
      const goal = { id: randomUUID(), matchId: match.id, teamEntryId: teamEntry.id, scorerId: player.id, period, clockSeconds };
      goals.push(goal); recentGoals.set(eventKey, goal);
    } else if (Number(event.e_id) === 2 && player) {
      const goal = recentGoals.get(eventKey);
      const order = goal ? assists.filter((assist) => assist.goalId === goal.id).length + 1 : 1;
      assists.push({ id: randomUUID(), goalId: goal?.id || null, matchId: match.id, teamEntryId: teamEntry.id, playerId: player.id, order });
      if (!goal) unlinkedAssists.push(Number(event.id));
    } else if (Number(event.e_id) === 3) penalties.push({ id: randomUUID(), matchId: match.id, teamEntryId: teamEntry.id, playerId: player?.id || null, period, clockSeconds, minutes: Math.max(1, Number(event.ecount || 1)), reason: event.Eventreason === null || event.Eventreason === "" ? null : String(event.Eventreason) });
  }
  const legacyEvents = data.matchEvents.map((event) => {
    const match = matchByLegacy.get(Number(event.match_id));
    if (!match) return null;
    return {
      id: randomUUID(), source: SOURCE, legacyId: String(event.id), matchId: match.id,
      teamEntryId: teamEntryByKey.get(`${event.season_id}:${event.t_id}`)?.id || null,
      playerId: playerByLegacy.get(Number(event.player_id))?.id || null,
      eventCode: String(event.e_id), eventType: data.events.get(Number(event.e_id)) || `Событие ${event.e_id}`,
      count: Number(event.ecount || 1), minute: String(event.minutes_input || event.minutes || "") || null,
      reason: event.Eventreason === null || event.Eventreason === "" ? null : String(event.Eventreason),
      raw: { ordering: Number(event.eordering || 0), minuteEnd: event.minutes_end || null, additionalTo: Number(event.additional_to || 0), stageId: Number(event.stage_id || 0) },
    };
  }).filter(Boolean);
  const qualifications = unique(players.map((player) => player.qualification).filter(Boolean));
  return { season, competitions, divisions, teams, players, teamEntries, rosterEntries, stages, venues, matches, matchRosters, goals, assists, penalties, legacyEvents, qualifications, unlinkedAssists, bindingById, teamEntryByKey, playerByLegacy, matchByLegacy };
}

function publicRows(plan) {
  const omit = (item, keys) => Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)));
  return {
    season: plan.season,
    competitions: plan.competitions,
    divisions: plan.divisions.map((item) => omit(item, ["legacySeasonId"])),
    teams: plan.teams.filter((item) => !item.reused).map((item) => omit(item, ["legacyId", "reused"])),
    players: plan.players.filter((item) => !item.reused).map((item) => omit(item, ["legacyId", "reused", "qualification", "fallbackNumber"])),
    teamEntries: plan.teamEntries.map((item) => omit(item, ["legacySeasonId", "legacyTeamId"])),
    rosterEntries: plan.rosterEntries.map((item) => omit(item, ["legacyKey"])),
    stages: plan.stages.map((item) => omit(item, ["legacyKey"])),
    venues: plan.venues.filter((item) => !item.reused).map((item) => omit(item, ["legacyName", "reused"])),
    matches: plan.matches.map((item) => omit(item, ["legacyId", "legacySeasonId"])),
  };
}

async function importPlan(db, plan) {
  const rows = publicRows(plan);
  return db.$transaction(async (tx) => {
    const existingImport = await tx.legacyImportMap.findFirst({
      where: { source: SOURCE },
      select: { id: true },
    });
    if (existingImport && !replace) throw new Error(`Сезон ${config.name} уже импортирован из этого источника. Для полной замены используйте --replace.`);
    if (existingImport) {
      const seasonMapping = await tx.legacyImportMap.findFirst({
        where: { source: SOURCE, entityType: "season", legacyId: requestedSeason },
        select: { entityId: true },
      });
      if (!seasonMapping) throw new Error(`Не найдена привязка импортированного сезона ${config.name}; безопасная замена отменена.`);
      const previousSeason = await tx.season.findUnique({
        where: { id: seasonMapping.entityId },
        select: {
          isActive: true,
          competitions: { select: { name: true, type: true, isActive: true } },
        },
      });
      if (!previousSeason) throw new Error(`Импортированный сезон ${config.name} не найден; безопасная замена отменена.`);
      rows.season.isActive = previousSeason.isActive;
      for (const competition of rows.competitions) {
        competition.isActive = previousSeason.competitions.find(
          (item) => item.name === competition.name && item.type === competition.type,
        )?.isActive ?? false;
      }
      await tx.legacyImportMap.deleteMany({ where: { source: SOURCE } });
      await tx.match.deleteMany({
        where: { division: { competition: { seasonId: seasonMapping.entityId } } },
      });
      await tx.season.delete({ where: { id: seasonMapping.entityId } });
    }
    await tx.season.create({ data: rows.season });
    await createMany(tx.competition, rows.competitions); await createMany(tx.division, rows.divisions);
    await createMany(tx.team, rows.teams); await createMany(tx.player, rows.players);
    await createMany(tx.teamEntry, rows.teamEntries); await createMany(tx.rosterEntry, rows.rosterEntries);
    await createMany(tx.matchStage, rows.stages); await createMany(tx.venue, rows.venues); await createMany(tx.match, rows.matches);
    await createMany(tx.matchRoster, plan.matchRosters); await createMany(tx.goal, plan.goals); await createMany(tx.assist, plan.assists); await createMany(tx.penalty, plan.penalties); await createMany(tx.legacyMatchEvent, plan.legacyEvents);
    const existingCategories = await tx.classificationCategory.findMany({ where: { name: { in: plan.qualifications } } });
    const existingNames = new Set(existingCategories.map((category) => category.name));
    await createMany(tx.classificationCategory, plan.qualifications.filter((name) => !existingNames.has(name)).map((name, index) => ({ id: randomUUID(), name, level: index + 1, sortOrder: index })));
    const categories = await tx.classificationCategory.findMany({ where: { name: { in: plan.qualifications } } });
    const categoryByName = new Map(categories.map((category) => [category.name, category]));
    await createMany(tx.playerClassification, plan.players.filter((player) => player.qualification).map((player) => ({ id: randomUUID(), playerId: player.id, seasonId: plan.season.id, categoryId: categoryByName.get(player.qualification).id, startsAt: plan.season.startsAt })));
    const mappings = [
      { entityType: "season", legacyId: requestedSeason, entityId: plan.season.id },
      ...plan.competitions.map((item) => ({ entityType: "competition", legacyId: `${item.type}:${item.name}`, entityId: item.id })),
      ...plan.divisions.map((item) => ({ entityType: "division", legacyId: String(item.legacySeasonId), entityId: item.id })),
      ...plan.teams.map((item) => ({ entityType: "team", legacyId: String(item.legacyId), entityId: item.id })),
      ...plan.players.map((item) => ({ entityType: "player", legacyId: String(item.legacyId), entityId: item.id })),
      ...plan.matches.map((item) => ({ entityType: "match", legacyId: String(item.legacyId), entityId: item.id })),
    ].map((item) => ({ id: randomUUID(), source: SOURCE, ...item }));
    await createMany(tx.legacyImportMap, mappings);
    const finalMatchIds = new Set(plan.matches.filter((match) => match.status === "FINAL").map((match) => match.id));
    const rosterById = new Map(plan.rosterEntries.map((entry) => [entry.id, entry]));
    const playerStats = new Map();
    const stat = (playerId, teamEntryId) => { const key = `${playerId}:${teamEntryId}`; if (!playerStats.has(key)) playerStats.set(key, { id: randomUUID(), playerId, teamEntryId, games: 0, goals: 0, assists: 0, penaltyMinutes: 0 }); return playerStats.get(key); };
    for (const row of plan.matchRosters.filter((item) => finalMatchIds.has(item.matchId))) { const roster = rosterById.get(row.rosterEntryId); stat(roster.playerId, roster.teamEntryId).games++; }
    for (const goal of plan.goals.filter((item) => finalMatchIds.has(item.matchId))) stat(goal.scorerId, goal.teamEntryId).goals++;
    for (const assist of plan.assists) if (finalMatchIds.has(assist.matchId)) stat(assist.playerId, assist.teamEntryId).assists++;
    for (const penalty of plan.penalties.filter((item) => item.playerId && finalMatchIds.has(item.matchId))) stat(penalty.playerId, penalty.teamEntryId).penaltyMinutes += penalty.minutes;
    await createMany(tx.playerStatistic, [...playerStats.values()]);
    for (const division of plan.divisions) {
      const stageIds = new Set(plan.stages.filter((stage) => stage.divisionId === division.id && stage.countsForStandings).map((stage) => stage.id));
      const divisionMatches = plan.matches.filter((match) => match.divisionId === division.id && match.status === "FINAL" && stageIds.has(match.stageId));
      const matchIds = new Set(divisionMatches.map((match) => match.id));
      const teamIds = plan.teamEntries.filter((entry) => entry.divisionId === division.id).map((entry) => entry.id);
      const table = calculateStandings(teamIds, divisionMatches, plan.penalties.filter((penalty) => matchIds.has(penalty.matchId)));
      await createMany(tx.teamStatistic, table.map((row) => ({ id: randomUUID(), teamEntryId: row.teamEntryId, games: row.games, wins: row.wins, draws: row.draws, losses: row.losses, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, points: row.points })));
      await createMany(tx.standing, table.map((row, index) => ({ id: randomUUID(), divisionId: division.id, teamEntryId: row.teamEntryId, rank: index + 1, points: row.points })));
    }
    const seasonFilter = { division: { competition: { seasonId: plan.season.id } } };
    const [competitions, divisions, teams, players, teamEntries, rosterEntries, stages, venues, matches, matchRosters, goals, assists, penalties, legacyEvents, savedMappings] = await Promise.all([
      tx.competition.count({ where: { seasonId: plan.season.id } }),
      tx.division.count({ where: { competition: { seasonId: plan.season.id } } }),
      tx.team.count({ where: { id: { in: plan.teams.map((item) => item.id) } } }),
      tx.player.count({ where: { id: { in: plan.players.map((item) => item.id) } } }),
      tx.teamEntry.count({ where: seasonFilter }),
      tx.rosterEntry.count({ where: { teamEntry: seasonFilter } }),
      tx.matchStage.count({ where: seasonFilter }),
      tx.venue.count({ where: { id: { in: plan.venues.map((item) => item.id) } } }),
      tx.match.count({ where: seasonFilter }),
      tx.matchRoster.count({ where: { match: seasonFilter } }),
      tx.goal.count({ where: { match: seasonFilter } }),
      tx.assist.count({ where: { match: seasonFilter } }),
      tx.penalty.count({ where: { match: seasonFilter } }),
      tx.legacyMatchEvent.count({ where: { match: seasonFilter } }),
      tx.legacyImportMap.count({ where: { source: SOURCE } }),
    ]);
    const verification = { competitions, divisions, teams, players, teamEntries, rosterEntries, stages, venues, matches, matchRosters, goals, assists, penalties, legacyEvents, mappings: savedMappings };
    const expected = { competitions: plan.competitions.length, divisions: plan.divisions.length, teams: plan.teams.length, players: plan.players.length, teamEntries: plan.teamEntries.length, rosterEntries: plan.rosterEntries.length, stages: plan.stages.length, venues: plan.venues.length, matches: plan.matches.length, matchRosters: plan.matchRosters.length, goals: plan.goals.length, assists: plan.assists.length, penalties: plan.penalties.length, legacyEvents: plan.legacyEvents.length, mappings: mappings.length };
    const mismatches = Object.keys(expected).filter((key) => verification[key] !== expected[key]).map((key) => `${key}: ${verification[key]} вместо ${expected[key]}`);
    if (mismatches.length) throw new Error(`Контрольная сверка не пройдена, транзакция отменена: ${mismatches.join(", ")}`);
    return { verification, playerStatistics: playerStats.size };
  }, { maxWait: 30_000, timeout: 600_000 });
}

assertSafeTarget();
if (!jsonOnly) console.log("Чтение старого SQL-дампа…");
const identityDb = new PrismaClient();
let identity;
try {
  const [mappings, venues] = await Promise.all([
    identityDb.legacyImportMap.findMany({
      where: { source: { startsWith: "joomsport:lhlnew:" }, entityType: { in: ["team", "player"] } },
      select: { entityType: true, legacyId: true, entityId: true },
    }),
    identityDb.venue.findMany({ select: { id: true, name: true, city: true } }),
  ]);
  identity = {
    teams: new Map(mappings.filter((item) => item.entityType === "team").map((item) => [item.legacyId, item.entityId])),
    players: new Map(mappings.filter((item) => item.entityType === "player").map((item) => [item.legacyId, item.entityId])),
    venues: new Map(venues.map((item) => [`${item.name}::${item.city || ""}`, item.id])),
  };
} finally {
  await identityDb.$disconnect();
}
const data = await readLegacySeason(sqlPath, config.bindings);
const plan = buildPlan(data, identity);
const summary = {
  mode: commit ? (replace ? "REPLACE" : "COMMIT") : "PLAN_ONLY", source: SOURCE,
  entities: { seasons: 1, competitions: plan.competitions.length, divisions: plan.divisions.length, teams: plan.teams.length, newTeams: plan.teams.filter((item) => !item.reused).length, reusedTeams: plan.teams.filter((item) => item.reused).length, players: plan.players.length, newPlayers: plan.players.filter((item) => !item.reused).length, reusedPlayers: plan.players.filter((item) => item.reused).length, teamEntries: plan.teamEntries.length, rosterEntries: plan.rosterEntries.length, stages: plan.stages.length, venues: plan.venues.length, newVenues: plan.venues.filter((item) => !item.reused).length, matches: plan.matches.length, matchRosters: plan.matchRosters.length, goals: plan.goals.length, assists: plan.assists.length, penalties: plan.penalties.length, legacyEvents: plan.legacyEvents.length },
  warnings: { unlinkedAssists: plan.unlinkedAssists.length, matchesWithoutDate: plan.matches.filter((match) => !match.startsAt).length },
};
if (!commit) console.log(JSON.stringify({ ...summary, writesPerformed: 0, next: "Добавьте --commit и защитные переменные тестовой базы." }, null, 2));
else {
  const db = new PrismaClient();
  try { const result = await importPlan(db, plan); console.log(JSON.stringify({ ...summary, writesPerformed: "transaction committed", ...result }, null, 2)); }
  finally { await db.$disconnect(); }
}
