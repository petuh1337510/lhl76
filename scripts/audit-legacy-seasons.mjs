import fs from "node:fs";
import readline from "node:readline";

const sqlPath = process.argv.slice(2).find((argument) => argument !== "--" && !argument.startsWith("--"));
if (!sqlPath) {
  console.error("Usage: node scripts/audit-legacy-seasons.mjs <dump.sql>");
  process.exit(1);
}

const wantedTables = new Set([
  "wp_joomsport_matches",
  "wp_joomsport_match_events",
  "wp_joomsport_playerlist",
  "wp_joomsport_season_table",
  "wp_joomsport_squad",
  "wp_posts",
]);

const seasons = new Map();
const posts = new Map();

function season(id) {
  const numericId = Number(id);
  if (!numericId) return null;
  if (!seasons.has(numericId)) {
    seasons.set(numericId, {
      id: numericId,
      matches: 0,
      completedMatches: 0,
      firstMatch: null,
      lastMatch: null,
      teamIds: new Set(),
      standingsTeams: new Set(),
      playerAssignments: 0,
      uniquePlayers: new Set(),
      squadRows: 0,
      eventRows: 0,
    });
  }
  return seasons.get(numericId);
}

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

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (depth === 0) {
      if (character === "(") {
        depth = 1;
        fields = [];
        value = "";
      }
      continue;
    }
    if (quoted) {
      if (escaped) {
        value += `\\${character}`;
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "'") {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === "'") quoted = true;
    else if (character === "," && depth === 1) pushValue();
    else if (character === ")" && depth === 1) {
      pushValue();
      tuples.push(fields);
      fields = null;
      depth = 0;
    } else value += character;
  }
  return tuples;
}

function rowObject(columns, values) {
  return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
}

function includeDate(summary, value) {
  if (!value || value === "0000-00-00") return;
  if (!summary.firstMatch || value < summary.firstMatch) summary.firstMatch = value;
  if (!summary.lastMatch || value > summary.lastMatch) summary.lastMatch = value;
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
    if (currentTable === "wp_joomsport_matches") {
      const summary = season(row.seasonID);
      if (!summary) continue;
      summary.matches += 1;
      if (Number(row.status) === 1 || row.scoreHome !== null || row.scoreAway !== null) summary.completedMatches += 1;
      summary.teamIds.add(Number(row.teamHomeID));
      summary.teamIds.add(Number(row.teamAwayID));
      includeDate(summary, row.date);
    } else if (currentTable === "wp_joomsport_match_events") {
      const summary = season(row.season_id);
      if (summary) summary.eventRows += 1;
    } else if (currentTable === "wp_joomsport_playerlist") {
      const summary = season(row.season_id);
      if (!summary) continue;
      summary.playerAssignments += 1;
      summary.uniquePlayers.add(Number(row.player_id));
      summary.teamIds.add(Number(row.team_id));
    } else if (currentTable === "wp_joomsport_season_table") {
      const summary = season(row.season_id);
      if (!summary) continue;
      summary.standingsTeams.add(Number(row.participant_id));
      summary.teamIds.add(Number(row.participant_id));
    } else if (currentTable === "wp_joomsport_squad") {
      const summary = season(row.season_id);
      if (summary) summary.squadRows += 1;
    } else if (currentTable === "wp_posts") {
      const type = String(row.post_type || "");
      if (type === "joomsport_season" || type === "joomsport_team") {
        posts.set(Number(row.ID), {
          title: row.post_title,
          slug: row.post_name,
          status: row.post_status,
          type,
          date: row.post_date,
        });
      }
    }
  }

  if (line.endsWith(";")) {
    currentTable = null;
    currentColumns = [];
  }
}

const output = [...seasons.values()]
  .map((summary) => ({
    id: summary.id,
    title: posts.get(summary.id)?.title || null,
    slug: posts.get(summary.id)?.slug || null,
    status: posts.get(summary.id)?.status || null,
    postDate: posts.get(summary.id)?.date || null,
    matches: summary.matches,
    completedMatches: summary.completedMatches,
    firstMatch: summary.firstMatch,
    lastMatch: summary.lastMatch,
    teams: [...summary.teamIds].filter(Boolean).length,
    standingsTeams: summary.standingsTeams.size,
    playerAssignments: summary.playerAssignments,
    uniquePlayers: summary.uniquePlayers.size,
    squadRows: summary.squadRows,
    eventRows: summary.eventRows,
  }))
  .filter((summary) => summary.title || summary.matches || summary.standingsTeams || summary.playerAssignments)
  .sort((left, right) => {
    const leftDate = left.firstMatch || left.postDate || "";
    const rightDate = right.firstMatch || right.postDate || "";
    return leftDate.localeCompare(rightDate) || left.id - right.id;
  });

console.log(JSON.stringify({ dump: sqlPath, seasonCount: output.length, seasons: output }, null, 2));
