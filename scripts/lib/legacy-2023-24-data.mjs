import fs from "node:fs";
import readline from "node:readline";

export const legacyBindings = [
  { id: 2220, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Спорт" },
  { id: 2476, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель Плюс" },
  { id: 2477, competition: "Чемпионат ЛХЛ-76", type: "CHAMPIONSHIP", division: "Любитель" },
  { id: 3029, competition: "Памяти Локомотива 2023", type: "TOURNAMENT", division: "Любитель Плюс" },
  { id: 3026, competition: "Памяти Локомотива 2023", type: "TOURNAMENT", division: "Любитель" },
  { id: 6780, competition: "Апрельский 2024", type: "TOURNAMENT", division: "Любитель Плюс" },
  { id: 6781, competition: "Апрельский 2024", type: "TOURNAMENT", division: "Любитель" },
];

const wantedTables = new Set([
  "wp_joomsport_events", "wp_joomsport_matches", "wp_joomsport_match_events",
  "wp_joomsport_playerlist", "wp_joomsport_season_table", "wp_joomsport_squad",
  "wp_postmeta", "wp_posts", "wp_terms",
]);

function unescapeSql(value) {
  return value.replace(/\\0/g, "\0").replace(/\\n/g, "\n").replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t").replace(/\\Z/g, "\x1a").replace(/\\'/g, "'")
    .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
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
      if (character === "(") { depth = 1; fields = []; value = ""; }
      continue;
    }
    if (quoted) {
      if (escaped) { value += `\\${character}`; escaped = false; }
      else if (character === "\\") escaped = true;
      else if (character === "'") quoted = false;
      else value += character;
      continue;
    }
    if (character === "'") quoted = true;
    else if (character === "," && depth === 1) pushValue();
    else if (character === ")" && depth === 1) { pushValue(); tuples.push(fields); fields = null; depth = 0; }
    else value += character;
  }
  return tuples;
}

const rowObject = (columns, values) => Object.fromEntries(columns.map((column, index) => [column, values[index]]));

export async function readLegacySeason(sqlPath, bindings = legacyBindings) {
  const seasonIds = new Set(bindings.map((binding) => binding.id));
  const data = {
    events: new Map(), matches: [], matchEvents: [], playerlist: [], standings: [], squad: [],
    posts: new Map(), meta: new Map(), terms: new Map(),
  };
  const referencedIds = new Set([...seasonIds]);
  const attachmentIds = new Set();
  const addMeta = (postId, key, value) => {
    if (!data.meta.has(postId)) data.meta.set(postId, new Map());
    const byKey = data.meta.get(postId);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(value);
  };
  let currentTable = null;
  let currentColumns = [];
  const lines = readline.createInterface({ input: fs.createReadStream(sqlPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    const insert = line.match(/^INSERT INTO `([^`]+)` \((.+)\) VALUES$/);
    if (insert) {
      currentTable = wantedTables.has(insert[1]) ? insert[1] : null;
      currentColumns = currentTable ? [...insert[2].matchAll(/`([^`]+)`/g)].map((match) => match[1]) : [];
      continue;
    }
    if (!currentTable || !line.startsWith("(")) continue;
    for (const values of parseTuples(line)) {
      const row = rowObject(currentColumns, values);
      if (currentTable === "wp_joomsport_events") data.events.set(Number(row.id), row.e_name);
      else if (currentTable === "wp_joomsport_matches" && seasonIds.has(Number(row.seasonID))) {
        data.matches.push(row);
        [row.postID, row.teamHomeID, row.teamAwayID].forEach((id) => referencedIds.add(Number(id)));
      } else if (currentTable === "wp_joomsport_match_events" && seasonIds.has(Number(row.season_id))) {
        data.matchEvents.push(row);
        [row.player_id, row.match_id, row.t_id].forEach((id) => referencedIds.add(Number(id)));
      } else if (currentTable === "wp_joomsport_playerlist" && seasonIds.has(Number(row.season_id))) {
        data.playerlist.push(row);
        [row.player_id, row.team_id].forEach((id) => referencedIds.add(Number(id)));
      } else if (currentTable === "wp_joomsport_season_table" && seasonIds.has(Number(row.season_id))) {
        data.standings.push(row); referencedIds.add(Number(row.participant_id));
      } else if (currentTable === "wp_joomsport_squad" && seasonIds.has(Number(row.season_id))) {
        data.squad.push(row);
        [row.player_id, row.team_id, row.match_id].forEach((id) => referencedIds.add(Number(id)));
      } else if (currentTable === "wp_postmeta" && (referencedIds.has(Number(row.post_id)) || String(row.meta_key).startsWith("_joomsport_venue_"))) {
        addMeta(Number(row.post_id), row.meta_key, row.meta_value);
        if (row.meta_key === "_joomsport_match_venue" && Number(row.meta_value)) referencedIds.add(Number(row.meta_value));
        if (row.meta_key === "_thumbnail_id") attachmentIds.add(Number(row.meta_value));
        if (row.meta_key === "vdw_gallery_id" && typeof row.meta_value === "string") {
          for (const match of row.meta_value.matchAll(/i:\d+;i:(\d+)/g)) attachmentIds.add(Number(match[1]));
        }
      } else if (currentTable === "wp_posts") {
        const id = Number(row.ID);
        if (referencedIds.has(id) || attachmentIds.has(id) || row.post_type === "joomsport_venue") data.posts.set(id, {
          id, title: row.post_title, slug: row.post_name, content: row.post_content,
          status: row.post_status, type: row.post_type, guid: row.guid, mime: row.post_mime_type,
        });
      } else if (currentTable === "wp_terms") data.terms.set(Number(row.term_id), row.name);
    }
    if (line.endsWith(";")) { currentTable = null; currentColumns = []; }
  }
  return data;
}

export function serializedString(raw, token) {
  if (typeof raw !== "string") return "";
  const prefix = typeof token === "number" ? `i:${token};` : `s:${String(token).length}:\\"${token}\\";`;
  return raw.match(new RegExp(`${prefix}s:\\d+:\\"([^\\"]*)\\"`))?.[1] || "";
}

export function galleryIds(raw) {
  return typeof raw === "string" ? [...raw.matchAll(/i:\d+;i:(\d+)/g)].map((match) => Number(match[1])) : [];
}

export const metaValue = (data, id, key) => data.meta.get(Number(id))?.get(key)?.[0];
export const postTitle = (data, id) => data.posts.get(Number(id))?.title || `[ID ${id}]`;
export const postSlug = (data, id, fallback) => data.posts.get(Number(id))?.slug || fallback;
export const attachmentUrl = (data, id) => data.posts.get(Number(id))?.guid || null;
