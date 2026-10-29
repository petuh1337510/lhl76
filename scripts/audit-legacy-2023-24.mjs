import fs from "node:fs";
import readline from "node:readline";

const sqlPath = process.argv.slice(2).find((argument) => argument !== "--" && !argument.startsWith("--"));
if (!sqlPath) {
  console.error("Usage: node scripts/audit-legacy-2023-24.mjs <dump.sql> [--dry-run]");
  process.exit(1);
}

const bindings = [
  { id: 2220, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Спорт" },
  { id: 2476, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Плюс" },
  { id: 2477, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель" },
  { id: 3029, competition: "Памяти Локомотива 2023", type: "TOURNAMENT", division: "Любитель Плюс" },
  { id: 3026, competition: "Памяти Локомотива 2023", type: "TOURNAMENT", division: "Любитель" },
  { id: 6780, competition: "Апрельский 2024", type: "TOURNAMENT", division: "Любитель Плюс" },
  { id: 6781, competition: "Апрельский 2024", type: "TOURNAMENT", division: "Любитель" },
];
const includeWholeSeason = process.argv.includes("--all") || process.argv.includes("--dry-run");
const activeBindings = includeWholeSeason ? bindings : bindings.slice(0, 3);
const seasonIds = new Set(activeBindings.map((binding) => binding.id));
const seasonLabels = Object.fromEntries(activeBindings.map((binding) => [binding.id, binding.division]));
const bindingById = new Map(activeBindings.map((binding) => [binding.id, binding]));

const wantedTables = new Set([
  "wp_joomsport_events",
  "wp_joomsport_matches",
  "wp_joomsport_match_events",
  "wp_joomsport_playerlist",
  "wp_joomsport_season_table",
  "wp_joomsport_squad",
  "wp_postmeta",
  "wp_posts",
  "wp_terms",
]);

const data = {
  events: new Map(),
  matches: [],
  matchEvents: [],
  playerlist: [],
  standings: [],
  squad: [],
  posts: new Map(),
  meta: new Map(),
  terms: new Map(),
};

const referencedIds = new Set([...seasonIds]);
const attachmentIds = new Set();

function unescapeSql(value) {
  return value
    .replace(/\\0/g, "\0")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\Z/g, "\x1a")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseTuples(line) {
  const tuples = [];
  let fields = null;
  let value = "";
  let quoted = false;
  let escaped = false;
  let depth = 0;

  const pushValue = () => {
    const raw = value.trim();
    if (raw === "NULL") fields.push(null);
    else if (/^-?\d+(?:\.\d+)?$/.test(raw)) fields.push(Number(raw));
    else fields.push(unescapeSql(raw));
    value = "";
  };

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (depth === 0) {
      if (ch === "(") {
        depth = 1;
        fields = [];
        value = "";
      }
      continue;
    }
    if (quoted) {
      if (escaped) {
        value += `\\${ch}`;
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "'") {
        quoted = false;
      } else {
        value += ch;
      }
      continue;
    }
    if (ch === "'") {
      quoted = true;
    } else if (ch === "," && depth === 1) {
      pushValue();
    } else if (ch === ")" && depth === 1) {
      pushValue();
      tuples.push(fields);
      fields = null;
      depth = 0;
    } else {
      value += ch;
    }
  }
  return tuples;
}

function rowObject(columns, values) {
  return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
}

function addMeta(postId, key, value) {
  if (!data.meta.has(postId)) data.meta.set(postId, new Map());
  const byKey = data.meta.get(postId);
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(value);
}

let currentTable = null;
let currentColumns = [];
const input = fs.createReadStream(sqlPath, { encoding: "utf8" });
const lines = readline.createInterface({ input, crlfDelay: Infinity });

for await (const line of lines) {
  const insert = line.match(/^INSERT INTO `([^`]+)` \((.+)\) VALUES$/);
  if (insert) {
    currentTable = wantedTables.has(insert[1]) ? insert[1] : null;
    currentColumns = currentTable
      ? [...insert[2].matchAll(/`([^`]+)`/g)].map((match) => match[1])
      : [];
    continue;
  }
  if (!currentTable || !line.startsWith("(")) continue;

  for (const values of parseTuples(line)) {
    const row = rowObject(currentColumns, values);
    if (currentTable === "wp_joomsport_events") {
      data.events.set(Number(row.id), row.e_name);
    } else if (currentTable === "wp_joomsport_matches" && seasonIds.has(Number(row.seasonID))) {
      data.matches.push(row);
      [row.postID, row.teamHomeID, row.teamAwayID].forEach((id) => referencedIds.add(Number(id)));
    } else if (currentTable === "wp_joomsport_match_events" && seasonIds.has(Number(row.season_id))) {
      data.matchEvents.push(row);
      [row.player_id, row.match_id, row.t_id].forEach((id) => referencedIds.add(Number(id)));
    } else if (currentTable === "wp_joomsport_playerlist" && seasonIds.has(Number(row.season_id))) {
      data.playerlist.push(row);
      [row.player_id, row.team_id].forEach((id) => referencedIds.add(Number(id)));
    } else if (currentTable === "wp_joomsport_season_table" && seasonIds.has(Number(row.season_id))) {
      data.standings.push(row);
      referencedIds.add(Number(row.participant_id));
    } else if (currentTable === "wp_joomsport_squad" && seasonIds.has(Number(row.season_id))) {
      data.squad.push(row);
      [row.player_id, row.team_id, row.match_id].forEach((id) => referencedIds.add(Number(id)));
    } else if (currentTable === "wp_postmeta" && referencedIds.has(Number(row.post_id))) {
      addMeta(Number(row.post_id), row.meta_key, row.meta_value);
      if (row.meta_key === "_thumbnail_id") attachmentIds.add(Number(row.meta_value));
      if (row.meta_key === "vdw_gallery_id" && typeof row.meta_value === "string") {
        for (const match of row.meta_value.matchAll(/i:\d+;i:(\d+)/g)) attachmentIds.add(Number(match[1]));
      }
    } else if (currentTable === "wp_posts") {
      const id = Number(row.ID);
      if (referencedIds.has(id) || attachmentIds.has(id)) {
        data.posts.set(id, {
          id,
          title: row.post_title,
          slug: row.post_name,
          status: row.post_status,
          type: row.post_type,
          guid: row.guid,
          mime: row.post_mime_type,
        });
      }
    } else if (currentTable === "wp_terms") {
      data.terms.set(Number(row.term_id), row.name);
    }
  }

  if (line.endsWith(";")) {
    currentTable = null;
    currentColumns = [];
  }
}

const post = (id) => data.posts.get(Number(id));
const title = (id) => post(id)?.title || `[ID ${id}]`;
const uniq = (items) => [...new Set(items)];
const countBy = (items, selector) => {
  const result = new Map();
  for (const item of items) {
    const key = selector(item);
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
};

const report = {
  dump: sqlPath,
  generatedAt: new Date().toISOString(),
  eventDictionary: Object.fromEntries(data.events),
  competitions: {},
  divisions: {},
  crossDivision: {},
  integrity: {},
  media: {},
};

for (const seasonId of seasonIds) {
  const matches = data.matches.filter((row) => Number(row.seasonID) === seasonId);
  const matchIds = new Set(matches.map((row) => Number(row.postID)));
  const playerlist = data.playerlist.filter((row) => Number(row.season_id) === seasonId);
  const standings = data.standings.filter((row) => Number(row.season_id) === seasonId);
  const squad = data.squad.filter((row) => Number(row.season_id) === seasonId);
  const matchEvents = data.matchEvents.filter((row) => Number(row.season_id) === seasonId);
  const teamIds = uniq([
    ...standings.map((row) => Number(row.participant_id)),
    ...playerlist.map((row) => Number(row.team_id)),
    ...matches.flatMap((row) => [Number(row.teamHomeID), Number(row.teamAwayID)]),
  ]).filter(Boolean);
  const officialTeamIds = new Set([
    ...standings.map((row) => Number(row.participant_id)),
    ...matches.flatMap((row) => [Number(row.teamHomeID), Number(row.teamAwayID)]),
  ].filter(Boolean));
  const dates = matches.map((row) => row.date).filter((date) => date && date !== "0000-00-00").sort();
  const eventCounts = countBy(matchEvents, (row) => Number(row.e_id));
  const assignmentCounts = countBy(playerlist, (row) => `${row.player_id}:${row.team_id}`);
  const duplicateAssignments = [...assignmentCounts.entries()].filter(([, count]) => count > 1);
  const squadMatches = new Set(squad.map((row) => Number(row.match_id)));
  const eventMatches = new Set(matchEvents.map((row) => Number(row.match_id)));
  const teams = teamIds
    .map((id) => ({
      id,
      name: title(id),
      rosterRows: playerlist.filter((row) => Number(row.team_id) === id).length,
      uniquePlayers: new Set(playerlist.filter((row) => Number(row.team_id) === id).map((row) => Number(row.player_id))).size,
      matches: matches.filter((row) => Number(row.teamHomeID) === id || Number(row.teamAwayID) === id).length,
      inStandings: standings.some((row) => Number(row.participant_id) === id),
      inMatches: matches.some((row) => Number(row.teamHomeID) === id || Number(row.teamAwayID) === id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const groupMatches = matches.filter((row) => /Групповой/i.test(data.terms.get(Number(row.mdID)) || ""));
  const computedTable = new Map([...officialTeamIds].map((id) => [id, {
    played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  }]));
  for (const match of groupMatches) {
    const home = computedTable.get(Number(match.teamHomeID));
    const away = computedTable.get(Number(match.teamAwayID));
    if (!home || !away) continue;
    const homeScore = Number(match.scoreHome);
    const awayScore = Number(match.scoreAway);
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    if (homeScore > awayScore) {
      home.wins += 1; home.points += 2; away.losses += 1;
    } else if (awayScore > homeScore) {
      away.wins += 1; away.points += 2; home.losses += 1;
    } else {
      home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
    }
  }
  const tableComparison = standings.map((row) => {
    let stored = {};
    try { stored = JSON.parse(row.options); } catch { stored = {}; }
    const computed = computedTable.get(Number(row.participant_id));
    const expected = {
      played: Number(stored.played_chk),
      wins: Number(stored.win_chk),
      draws: Number(stored.draw_chk),
      losses: Number(stored.lost_chk),
      goalsFor: Number(stored.goalscore_chk),
      goalsAgainst: Number(stored.goalconc_chk),
      points: Number(stored.point_chk),
    };
    const differences = Object.fromEntries(Object.keys(expected)
      .filter((key) => expected[key] !== computed?.[key])
      .map((key) => [key, { stored: expected[key], computed: computed?.[key] }]));
    return { teamId: Number(row.participant_id), team: title(row.participant_id), differences };
  }).filter((row) => Object.keys(row.differences).length);

  report.divisions[seasonId] = {
    competition: bindingById.get(seasonId)?.competition,
    competitionType: bindingById.get(seasonId)?.type,
    name: seasonLabels[seasonId],
    legacyPost: post(seasonId),
    teams,
    totals: {
      teams: teamIds.length,
      officialTeams: officialTeamIds.size,
      rosterRows: playerlist.length,
      uniquePlayers: new Set(playerlist.map((row) => Number(row.player_id))).size,
      matches: matches.length,
      publishedMatches: matches.filter((row) => row.post_status === "publish").length,
      matchesWithScore: matches.filter((row) => row.scoreHome !== null && row.scoreAway !== null).length,
      dateFrom: dates.at(0) || null,
      dateTo: dates.at(-1) || null,
      matchEvents: matchEvents.length,
      squadRows: squad.length,
      matchesWithSquad: [...squadMatches].filter((id) => matchIds.has(id)).length,
      matchesWithEvents: [...eventMatches].filter((id) => matchIds.has(id)).length,
      standingsRows: standings.length,
    },
    eventCounts: Object.fromEntries(
      [...eventCounts.entries()].map(([id, count]) => [data.events.get(id) || `ID ${id}`, count]),
    ),
    matchBreakdown: {
      status: Object.fromEntries(countBy(matches, (row) => String(row.status ?? "")).entries()),
      groupId: Object.fromEntries(countBy(matches, (row) => String(row.groupID ?? "")).entries()),
      matchday: Object.fromEntries([...countBy(matches, (row) => Number(row.mdID)).entries()].map(([id, count]) => [
        `${id}: ${data.terms.get(id) || "без названия"}`,
        count,
      ])),
    },
    duplicateAssignments: duplicateAssignments.map(([key, count]) => ({ key, count })),
    rosterOnlyTeams: teams.filter((team) => !officialTeamIds.has(team.id)),
    standingsValidation: {
      groupStageMatches: groupMatches.length,
      teamsWithDifferences: tableComparison.length,
      differences: tableComparison,
    },
  };
}

for (const binding of activeBindings) {
  const key = `${binding.type}:${binding.competition}`;
  if (!report.competitions[key]) {
    report.competitions[key] = { name: binding.competition, type: binding.type, legacySeasonIds: [], divisions: [] };
  }
  report.competitions[key].legacySeasonIds.push(binding.id);
  report.competitions[key].divisions.push(binding.division);
}

const playerSeasons = new Map();
for (const row of data.playerlist) {
  const playerId = Number(row.player_id);
  if (!playerSeasons.has(playerId)) playerSeasons.set(playerId, []);
  playerSeasons.get(playerId).push({ seasonId: Number(row.season_id), teamId: Number(row.team_id) });
}
const multiDivisionPlayers = [...playerSeasons.entries()]
  .filter(([, entries]) => new Set(entries.map((entry) => entry.seasonId)).size > 1)
  .map(([playerId, entries]) => ({
    playerId,
    player: title(playerId),
    assignments: entries.map((entry) => ({
      division: seasonLabels[entry.seasonId],
      teamId: entry.teamId,
      team: title(entry.teamId),
    })),
  }));
report.crossDivision = {
  uniquePlayersAcrossSelection: playerSeasons.size,
  playersInMultipleDivisions: multiDivisionPlayers.length,
  examples: multiDivisionPlayers.slice(0, 20),
};

const missingPosts = [...referencedIds].filter((id) => id && !data.posts.has(id));
const knownMatchIds = new Set(data.matches.map((row) => Number(row.postID)));
const rosterPlayersByLegacySeason = new Map([...seasonIds].map((seasonId) => [
  seasonId,
  new Set(data.playerlist.filter((row) => Number(row.season_id) === seasonId).map((row) => Number(row.player_id))),
]));
const eventPlayerIsOutsideRoster = (row) => !rosterPlayersByLegacySeason
  .get(Number(row.season_id))
  ?.has(Number(row.player_id));
report.integrity = {
  referencedObjectsMissingInWpPosts: missingPosts.length,
  missingPostIds: missingPosts.slice(0, 100),
  eventRowsWithUnknownMatch: data.matchEvents.filter((row) => !knownMatchIds.has(Number(row.match_id))).length,
  eventRowsWithPlayerOutsideDivisionRoster: data.matchEvents.filter(eventPlayerIsOutsideRoster).length,
  eventRowsWithPlayerOutsideDivisionRosterDetails: data.matchEvents
    .filter(eventPlayerIsOutsideRoster)
    .map((row) => ({
      division: seasonLabels[Number(row.season_id)],
      matchId: Number(row.match_id),
      match: title(row.match_id),
      playerId: Number(row.player_id),
      player: title(row.player_id),
      teamId: Number(row.t_id),
      team: title(row.t_id),
      event: data.events.get(Number(row.e_id)) || `ID ${row.e_id}`,
    })),
  squadRowsWithUnknownMatch: data.squad.filter((row) => !knownMatchIds.has(Number(row.match_id))).length,
};

const teamIds = new Set([
  ...data.playerlist.map((row) => Number(row.team_id)),
  ...data.standings.map((row) => Number(row.participant_id)),
  ...data.matches.flatMap((row) => [Number(row.teamHomeID), Number(row.teamAwayID)]),
]);
const playerIds = new Set([
  ...data.playerlist.map((row) => Number(row.player_id)),
  ...data.squad.map((row) => Number(row.player_id)),
  ...data.matchEvents.map((row) => Number(row.player_id)),
].filter(Boolean));
const thumbnailInfo = (ids) => {
  let withThumbnail = 0;
  let resolvedAttachment = 0;
  const missing = [];
  for (const id of ids) {
    const thumb = data.meta.get(id)?.get("_thumbnail_id")?.[0];
    if (thumb) {
      withThumbnail += 1;
      if (data.posts.has(Number(thumb))) resolvedAttachment += 1;
    } else {
      missing.push({ id, name: title(id) });
    }
  }
  return { total: ids.size, withThumbnail, resolvedAttachment, missing: missing.slice(0, 100) };
};
const galleryInfo = (ids) => {
  let withGallery = 0;
  let referencedImages = 0;
  let resolvedImages = 0;
  for (const id of ids) {
    const raw = data.meta.get(id)?.get("vdw_gallery_id")?.[0];
    const imageIds = typeof raw === "string"
      ? [...raw.matchAll(/i:\d+;i:(\d+)/g)].map((match) => Number(match[1]))
      : [];
    if (imageIds.length) withGallery += 1;
    referencedImages += imageIds.length;
    resolvedImages += imageIds.filter((imageId) => data.posts.has(imageId)).length;
  }
  return { withGallery, referencedImages, resolvedImages };
};
const serializedString = (raw, token) => {
  if (typeof raw !== "string") return "";
  const prefix = typeof token === "number" ? `i:${token};` : `s:${String(token).length}:\\"${token}\\";`;
  const match = raw.match(new RegExp(`${prefix}s:\\d+:\\"([^\\"]*)\\"`));
  return match?.[1] || "";
};
const playerFieldCompleteness = (ids) => {
  const counts = {
    firstName: 0,
    lastName: 0,
    patronymic: 0,
    birthDate: 0,
    city: 0,
    position: 0,
    jerseyNumber: 0,
    qualification: 0,
    legacyGalleryPhoto: 0,
    directPhotoUrl: 0,
  };
  for (const id of ids) {
    const personal = data.meta.get(id)?.get("_joomsport_player_personal")?.[0];
    const extra = data.meta.get(id)?.get("_joomsport_player_ef")?.[0];
    if (serializedString(personal, "first_name")) counts.firstName += 1;
    if (serializedString(personal, "last_name")) counts.lastName += 1;
    if (serializedString(personal, "short_name")) counts.patronymic += 1;
    if (serializedString(extra, 1)) counts.birthDate += 1;
    if (serializedString(extra, 3)) counts.city += 1;
    if (serializedString(extra, 4)) counts.position += 1;
    if (serializedString(extra, 8)) counts.jerseyNumber += 1;
    if (serializedString(extra, 10)) counts.qualification += 1;
    if (data.meta.get(id)?.get("vdw_gallery_id")?.[0]) counts.legacyGalleryPhoto += 1;
    if (/^https?:\/\//.test(serializedString(extra, 15))) counts.directPhotoUrl += 1;
  }
  return counts;
};
const metaKeyStats = (ids) => {
  const counts = new Map();
  const imageCandidates = [];
  for (const id of ids) {
    const byKey = data.meta.get(id);
    if (!byKey) continue;
    for (const [key, values] of byKey) {
      counts.set(key, (counts.get(key) || 0) + 1);
      for (const value of values) {
        if (typeof value === "string" && /(?:https?:\/\/|\.png|\.jpe?g|\.webp|image|photo|avatar)/i.test(value)) {
          imageCandidates.push({ id, name: title(id), key, value: value.slice(0, 500) });
        }
      }
    }
  }
  return {
    keys: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
    imageCandidates: imageCandidates.slice(0, 20),
  };
};
report.media = {
  teams: { ...thumbnailInfo(teamIds), ...galleryInfo(teamIds), ...metaKeyStats(teamIds) },
  players: { ...thumbnailInfo(playerIds), ...galleryInfo(playerIds), fields: playerFieldCompleteness(playerIds), ...metaKeyStats(playerIds) },
  matches: metaKeyStats(new Set(data.matches.map((row) => Number(row.postID)))),
};

const officialTeamIdsByLegacySeason = new Map([...seasonIds].map((seasonId) => [
  seasonId,
  new Set(report.divisions[seasonId].teams.filter((team) => team.inStandings || team.inMatches).map((team) => team.id)),
]));
const validRosterRows = data.playerlist.filter((row) => officialTeamIdsByLegacySeason
  .get(Number(row.season_id))
  ?.has(Number(row.team_id)));
const primaryRosterKeys = new Set(validRosterRows.map((row) => `${row.season_id}:${row.team_id}:${row.player_id}`));
const historicalRosterKeys = new Set([
  ...data.squad
    .filter((row) => officialTeamIdsByLegacySeason.get(Number(row.season_id))?.has(Number(row.team_id)))
    .map((row) => `${row.season_id}:${row.team_id}:${row.player_id}`),
  ...data.matchEvents
    .filter((row) => officialTeamIdsByLegacySeason.get(Number(row.season_id))?.has(Number(row.t_id)))
    .map((row) => `${row.season_id}:${row.t_id}:${row.player_id}`),
]);
const supplementalRosterKeys = [...historicalRosterKeys].filter((key) => !primaryRosterKeys.has(key));
const stageKeys = new Set(data.matches.map((row) => `${row.seasonID}:${row.mdID}`));
const classifyStage = (name) => {
  if (/за\s*3|треть/i.test(name)) return { type: "THIRD_PLACE", countsForStandings: false };
  if (/1\/4/i.test(name)) return { type: "QUARTERFINAL", countsForStandings: false };
  if (/1\/2/i.test(name)) return { type: "SEMIFINAL", countsForStandings: false };
  if (/финал/i.test(name) && !/плей-?офф/i.test(name)) return { type: "FINAL", countsForStandings: false };
  if (/плей-?офф/i.test(name)) return { type: "OTHER", countsForStandings: false };
  return { type: "GROUP_STAGE", countsForStandings: true };
};
const stagePlan = [...stageKeys].map((key) => {
  const [legacySeasonId, legacyMatchdayId] = key.split(":").map(Number);
  const name = data.terms.get(legacyMatchdayId) || `Стадия ${legacyMatchdayId}`;
  return {
    legacySeasonId,
    competition: bindingById.get(legacySeasonId)?.competition,
    division: bindingById.get(legacySeasonId)?.division,
    legacyMatchdayId,
    name,
    ...classifyStage(name),
  };
});
const venueValues = data.matches
  .map((row) => data.meta.get(Number(row.postID))?.get("_joomsport_match_venue")?.[0])
  .filter((value) => value !== null && value !== undefined && value !== "" && String(value) !== "0");
const officialTeamIds = new Set([...officialTeamIdsByLegacySeason.values()].flatMap((ids) => [...ids]));
const plannedPlayerIds = new Set([
  ...validRosterRows.map((row) => Number(row.player_id)),
  ...data.squad.map((row) => Number(row.player_id)),
  ...data.matchEvents.map((row) => Number(row.player_id)),
].filter(Boolean));
const rosterOnlyTeams = Object.values(report.divisions).flatMap((division) => division.rosterOnlyTeams.map((team) => ({
  legacySeasonId: Number(Object.entries(report.divisions).find(([, item]) => item === division)?.[0]),
  competition: division.competition,
  division: division.name,
  ...team,
})));
const duplicateRosterAssignments = Object.values(report.divisions).flatMap((division) => division.duplicateAssignments);
const matchesWithoutRosterIds = new Set(data.matches.map((row) => Number(row.postID)));
for (const row of data.squad) matchesWithoutRosterIds.delete(Number(row.match_id));
const matchesWithoutEventIds = new Set(data.matches.map((row) => Number(row.postID)));
for (const row of data.matchEvents) matchesWithoutEventIds.delete(Number(row.match_id));
const matchReview = (row) => ({
  legacySeasonId: Number(row.seasonID),
  competition: bindingById.get(Number(row.seasonID))?.competition,
  division: bindingById.get(Number(row.seasonID))?.division,
  matchId: Number(row.postID),
  match: title(row.postID),
  date: row.date,
  time: row.time,
  score: `${row.scoreHome}:${row.scoreAway}`,
  legacyStatus: Number(row.status),
});
const nonFinalMatches = data.matches.filter((row) => Number(row.status) !== 1).map(matchReview);
const matchesWithoutKnownDate = data.matches.filter((row) => !row.date || row.date === "0000-00-00").map(matchReview);
const possibleTechnicalResults = data.matches.filter((row) => {
  const matchId = Number(row.postID);
  const score = `${row.scoreHome}:${row.scoreAway}`;
  return Number(row.status) === 1 && !data.matchEvents.some((event) => Number(event.match_id) === matchId) && (score === "5:0" || score === "0:5");
}).map(matchReview);
const duplicateSlugs = (ids) => [...countBy([...ids].map((id) => post(id)?.slug).filter(Boolean), (slug) => slug).entries()]
  .filter(([, count]) => count > 1)
  .map(([slug, count]) => ({ slug, count }));
const fatalErrors = [];
if (report.integrity.referencedObjectsMissingInWpPosts) fatalErrors.push("Есть ссылки на отсутствующие записи WordPress.");
if (report.integrity.eventRowsWithUnknownMatch) fatalErrors.push("Есть игровые события без существующего матча.");
if (report.integrity.squadRowsWithUnknownMatch) fatalErrors.push("Есть составы на игру без существующего матча.");
if (duplicateRosterAssignments.length) fatalErrors.push("Есть дубли заявок игрока в одной команде и дивизионе.");
if (report.media.players.fields.firstName !== plannedPlayerIds.size || report.media.players.fields.lastName !== plannedPlayerIds.size) fatalErrors.push("Есть игроки без имени или фамилии.");
if (duplicateSlugs(officialTeamIds).length) fatalErrors.push("Есть повторяющиеся адреса карточек команд.");
if (duplicateSlugs(plannedPlayerIds).length) fatalErrors.push("Есть повторяющиеся адреса карточек игроков.");

report.dryRun = {
  writesPerformed: 0,
  readyForTransactionalImport: fatalErrors.length === 0,
  plannedEntities: {
    seasons: 1,
    competitions: Object.keys(report.competitions).length,
    divisions: seasonIds.size,
    teamCards: officialTeamIds.size,
    teamEntries: [...officialTeamIdsByLegacySeason.values()].reduce((sum, ids) => sum + ids.size, 0),
    playerCards: plannedPlayerIds.size,
    primaryRosterEntries: primaryRosterKeys.size,
    supplementalHistoricalRosterEntries: supplementalRosterKeys.length,
    matchStages: stageKeys.size,
    venues: new Set(venueValues.map(String)).size,
    matches: data.matches.length,
    matchRosterRows: data.squad.length,
    matchEvents: data.matchEvents.length,
    legacyMappings: 1 + Object.keys(report.competitions).length + seasonIds.size + officialTeamIds.size + plannedPlayerIds.size + data.matches.length,
  },
  skipped: {
    rosterRowsForNonParticipantTeams: data.playerlist.length - validRosterRows.length,
    rosterOnlyTeams,
  },
  warnings: {
    eventsOutsideFinalRoster: report.integrity.eventRowsWithPlayerOutsideDivisionRoster,
    supplementalHistoricalRosterEntries: supplementalRosterKeys.length,
    playersWithoutLegacyGalleryPhoto: plannedPlayerIds.size - report.media.players.withGallery,
    unresolvedPlayerGalleryAttachments: report.media.players.referencedImages - report.media.players.resolvedImages,
    matchesWithoutSavedRoster: data.matches.length - new Set(data.squad.map((row) => Number(row.match_id))).size,
    matchesWithoutEvents: data.matches.length - new Set(data.matchEvents.map((row) => Number(row.match_id))).size,
    matchesWithoutKnownDate: matchesWithoutKnownDate.length,
    possibleTechnicalResults: possibleTechnicalResults.length,
  },
  stagePlan,
  reviewItems: {
    nonFinalMatches,
    matchesWithoutKnownDate,
    possibleTechnicalResults,
    matchesWithoutRoster: data.matches.filter((row) => matchesWithoutRosterIds.has(Number(row.postID))).map(matchReview),
    matchesWithoutEvents: data.matches.filter((row) => matchesWithoutEventIds.has(Number(row.postID))).map(matchReview),
    duplicateTeamSlugs: duplicateSlugs(officialTeamIds),
    duplicatePlayerSlugs: duplicateSlugs(plannedPlayerIds),
  },
  fatalErrors,
};

const mode = process.argv.find((argument, index) => index > 1 && argument.startsWith("--") && argument !== "--all");
if (mode === "--focused") {
  console.log(JSON.stringify({
    divisions: Object.fromEntries(Object.entries(report.divisions).map(([id, division]) => [id, {
      totals: division.totals,
      rosterOnlyTeams: division.rosterOnlyTeams,
      matchBreakdown: division.matchBreakdown,
      standingsValidation: division.standingsValidation,
    }])),
    integrity: report.integrity,
    media: report.media,
  }, null, 2));
} else if (mode === "--media-summary") {
  console.log(JSON.stringify({
    teams: Object.fromEntries(Object.entries(report.media.teams).filter(([key]) => !["missing", "keys", "imageCandidates"].includes(key))),
    players: Object.fromEntries(Object.entries(report.media.players).filter(([key]) => !["missing", "keys", "imageCandidates"].includes(key))),
    playerImageUrls: report.media.players.imageCandidates.length,
    playerFields: report.media.players.fields,
    matchMetaKeys: report.media.matches.keys,
  }, null, 2));
} else if (mode === "--structure") {
  console.log(JSON.stringify({
    divisions: Object.fromEntries(Object.entries(report.divisions).map(([id, division]) => [id, {
      name: division.name,
      totals: division.totals,
      rosterOnlyTeams: division.rosterOnlyTeams,
      matchBreakdown: division.matchBreakdown,
      standingsValidation: division.standingsValidation,
    }])),
    integrity: report.integrity,
  }, null, 2));
} else if (mode === "--dry-run") {
  console.log(JSON.stringify({
    season: "2023/24",
    competitions: report.competitions,
    divisions: Object.fromEntries(Object.entries(report.divisions).map(([id, division]) => [id, {
      competition: division.competition,
      competitionType: division.competitionType,
      name: division.name,
      totals: division.totals,
      matchBreakdown: division.matchBreakdown,
      rosterOnlyTeams: division.rosterOnlyTeams,
    }])),
    dryRun: report.dryRun,
  }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}
