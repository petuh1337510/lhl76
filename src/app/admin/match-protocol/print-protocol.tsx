"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PublicImage } from "@/components/public-image";
import { isScoringGoal } from "./match-events";
import "./print-protocol.css";
import styles from "./print-protocol.module.css";

const detailFields = [
  ["gameNumber", "Номер игры", "text"],
  ["spectators", "Зрители", "number"],
  ["gameStart", "Фактическое начало", "time"],
  ["gameEnd", "Фактическое окончание", "time"],
  ["homeCoach", "Тренер команды А", "text"],
  ["awayCoach", "Тренер команды Б", "text"],
  ["referee1", "Главный судья 1", "text"],
  ["referee2", "Главный судья 2", "text"],
  ["timekeeper", "Судья времени игры", "text"],
  ["secretary", "Секретарь игры", "text"],
] as const;

export type PrintDetails = Record<typeof detailFields[number][0], string>;

export function readPrintDetails(value: unknown): PrintDetails {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(detailFields.map(([key]) => [key, typeof input[key] === "string" ? input[key] : ""])) as PrintDetails;
}

type Player = { lastName: string; firstName: string; baseNumber?: string | null; position?: string | null };
type RosterEntry = { id: string; teamEntryId: string; playerId: string; number?: string | null; leadership?: string; player: Player };
type TeamEntry = { id: string; team: { name: string; city?: string | null }; roster: RosterEntry[] };
type Goal = Parameters<typeof isScoringGoal>[0];
type Penalty = { id: string; teamEntryId: string; playerId?: string | null; minutes: number | string; time: string; reasonCode?: string; reason?: string };
type GoalieStint = { teamEntryId: string; playerId?: string; from?: string; to?: string };
type Shootout = { teamEntryId: string; playerId: string; goalieId?: string; scored: boolean };
type Sides = { home: string; away: string };
type Props = {
  match: {
    startsAt?: string | null;
    venue?: { name: string; city?: string | null } | null;
    division: { name: string; competition: { name: string; season: { name: string } } };
    homeTeamEntry: TeamEntry;
    awayTeamEntry: TeamEntry;
    rosters: { rosterEntry?: RosterEntry }[];
    goals: { teamEntryId: string; scorerId: string; scorer?: Player; assists: { playerId: string; player?: Player }[] }[];
    penalties: { teamEntryId: string; playerId?: string | null; player?: Player | null }[];
    penaltyShots: { teamEntryId: string; playerId: string; player?: Player; goalieId?: string | null; goalie?: Player | null }[];
  };
  selected: string[];
  numbers: Record<string, string>;
  score: Sides;
  statusLabel: string;
  technicalResult: boolean;
  periods: Sides[];
  shots: Sides[];
  goals: Goal[];
  penalties: Penalty[];
  goalieStints: GoalieStint[];
  timeouts: { teamEntryId: string; time?: string }[];
  shootouts: Shootout[];
  note: string;
  staff: string;
  referees: string;
  details: PrintDetails;
  onDetailsChange: (details: PrintDetails) => void;
};

const displayName = (player: Player) => [player.lastName, player.firstName].filter(Boolean).join(" ");
const timeValue = (value?: string) => {
  const match = typeof value === "string" && value.match(/^(\d+):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const byTime = (a: { time: string }, b: { time: string }) => (timeValue(a.time) ?? Infinity) - (timeValue(b.time) ?? Infinity);

function position(player: Player) {
  const value = player.position?.toLocaleLowerCase("ru") ?? "";
  if (value.includes("вратар")) return { label: "Вр", rank: 0 };
  if (value.includes("защит")) return { label: "З", rank: 1 };
  if (value.includes("напада")) return { label: "Н", rank: 2 };
  return { label: player.position || "", rank: 3 };
}

function Cells({ values }: { values: ReactNode[] }) {
  return <>{values.map((value, index) => <td key={index}>{value}</td>)}</>;
}

function formRows(minimum: number, ...lengths: number[]) {
  return Array.from({ length: Math.max(minimum, ...lengths) }, (_, index) => index);
}

function goalSituation(goal: Goal) {
  if (goal.situation === "PENALTY_SHOT") return isScoringGoal(goal) ? "ШБ" : "ШБ (мимо)";
  if (goal.situation === "EMPTY_NET") return "ПВ";
  return goal.situation?.replace(/X/g, "×");
}

function ProtocolSheet({ data, printCopy = false }: { data: Props; printCopy?: boolean }) {
  const { match, details, technicalResult, score } = data;
  const teams = [match.homeTeamEntry, match.awayTeamEntry];
  const selected = new Set(data.selected);
  const matchRoster = match.rosters.flatMap(row => row.rosterEntry ? [row.rosterEntry] : []);
  const rosters = teams.map(team => [...new Map(
    [...matchRoster.filter(row => row.teamEntryId === team.id), ...team.roster].map(row => [row.id, row]),
  ).values()]);
  const participants = rosters.map(rows => rows.filter(row => selected.has(row.id)).sort((a, b) =>
    position(a.player).rank - position(b.player).rank || displayName(a.player).localeCompare(displayName(b.player), "ru"),
  ));
  const jersey = (row: RosterEntry) => data.numbers[row.id] || row.number || row.player.baseNumber || "";
  const historicalPlayers = new Map<string, Player>();
  const remember = (id?: string | null, player?: Player | null) => { if (id && player) historicalPlayers.set(id, player); };
  for (const goal of match.goals) {
    remember(goal.scorerId, goal.scorer);
    for (const assist of goal.assists) remember(assist.playerId, assist.player);
  }
  for (const penalty of match.penalties) remember(penalty.playerId, penalty.player);
  for (const shot of match.penaltyShots) {
    remember(shot.playerId, shot.player);
    remember(shot.goalieId, shot.goalie);
  }
  const playerLabel = (side: number, playerId?: string | null) => {
    if (!playerId) return "";
    const row = rosters[side].find(player => player.playerId === playerId);
    if (row) return jersey(row) || displayName(row.player);
    const player = historicalPlayers.get(playerId);
    return player?.baseNumber || (player ? displayName(player) : "");
  };

  const goals = teams.map(team => technicalResult ? [] : data.goals.filter(goal => goal.teamEntryId === team.id).sort(byTime));
  const penalties = teams.map(team => technicalResult ? [] : data.penalties.filter(penalty => penalty.teamEntryId === team.id).sort(byTime));
  const shootouts = technicalResult ? [] : data.shootouts;
  const successful = teams.map(team => shootouts.filter(shot => shot.teamEntryId === team.id && shot.scored).length);
  const goalieStints = technicalResult ? [] : data.goalieStints.filter(stint => stint.playerId);
  const goalieTimes = [...new Set(goalieStints.flatMap(stint => [stint.from, stint.to]).filter((value): value is string => timeValue(value) !== null))]
    .sort((a, b) => (timeValue(a) ?? 0) - (timeValue(b) ?? 0));
  const started = match.startsAt ? new Date(match.startsAt) : null;
  const date = started?.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const scheduledTime = started?.toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
  const venue = [match.venue?.city, match.venue?.name].filter(Boolean).join(", ");
  const sides = ["А", "Б"];
  const teamName = (team: TeamEntry) => [team.team.name, team.team.city].filter(Boolean).join(" · ");
  const penaltyMinutes = (side: number, period?: number) => penalties[side].reduce((sum, penalty) => {
    const time = timeValue(penalty.time);
    if (period !== undefined && (time === null || Math.min(2, Math.floor(time / 1200)) !== period)) return sum;
    return sum + (Number(penalty.minutes) || 0);
  }, 0);
  const totals = (values: string[]) => values.length === 3 && values.every(value => value !== "") ? values.reduce((sum, value) => sum + Number(value), 0) : "";
  const resultRows = ["Взятия ворот", "Штрафное время", "Броски в створ"].flatMap(metric => teams.map((_, side) => {
    const key = side === 0 ? "home" : "away";
    const periodValues = [0, 1, 2].map(index => {
      if (technicalResult) return "";
      if (metric === "Взятия ворот") return data.periods[index]?.[key] ?? "";
      if (metric === "Штрафное время") return String(penaltyMinutes(side, index));
      return data.shots[index]?.[key] ?? "";
    });
    const decidingShot = metric === "Взятия ворот" && shootouts.length ? Number(successful[side] > successful[1 - side]) : "";
    let total: string | number = totals(periodValues);
    if (metric === "Взятия ворот") total = score[key];
    if (metric === "Штрафное время") total = technicalResult ? "" : penaltyMinutes(side);
    return { metric, side, values: [...periodValues, "", decidingShot, total] };
  }));

  return <article className={styles.sheet} data-match-protocol-print={printCopy ? "" : undefined} aria-label="Печатный протокол матча">
    <header className={styles.heading}>
      <div className={styles.brand}><PublicImage src="/images/lhl76-logo.jpg" alt="" width={76} height={76} sizes="58px" loading="eager" /><span>Любительская<br />хоккейная лига<br />Ярославль</span></div>
      <div className={styles.title}><h2>Официальный протокол матча</h2><strong>Сезон {match.division.competition.season.name}</strong></div>
      <div className={styles.division}><strong>Дивизион «{match.division.name}»</strong><span>{data.statusLabel}</span></div>
    </header>

    <table className={styles.metadata}><tbody>
      <tr><th scope="row">Вид соревнований</th><td>{match.division.competition.name}</td><th scope="row">Дата</th><td>{date}</td><th scope="row">Игра №</th><td>{details.gameNumber}</td></tr>
      <tr><th scope="row">Место проведения</th><td>{venue}</td><th scope="row">Время</th><td>{scheduledTime}</td><th scope="row">Зрители</th><td>{details.spectators}</td></tr>
    </tbody></table>

    <table className={styles.rosters}>
      <colgroup>{teams.flatMap((_, side) => [8, 69, 9, 7, 7].map((width, index) => <col key={side * 5 + index} style={{ width: `${width / 2}%` }} />))}</colgroup>
      <thead>
        <tr>{teams.map((team, side) => <th key={team.id} colSpan={5} scope="colgroup">«{sides[side]}» {teamName(team)}</th>)}</tr>
        <tr>{teams.flatMap((team) => ["№", "Фамилия, имя", "К/А", "Пз", "Иг"].map(label => <th key={team.id + label} scope="col">{label}</th>))}</tr>
      </thead>
      <tbody>{formRows(25, ...participants.map(rows => rows.length)).map(index => <tr key={index}>
        {participants.map((rows, side) => {
          const row = rows[index];
          return <Cells key={side} values={row ? [jersey(row), displayName(row.player), row.leadership === "CAPTAIN" ? "К" : row.leadership === "ASSISTANT" ? "А" : "", position(row.player).label, "Да"] : ["", "", "", "", ""]} />;
        })}
      </tr>)}
      <tr>{[details.homeCoach, details.awayCoach].map((coach, side) => <td colSpan={5} key={side}><span className={styles.coach}><span><strong>Тренер</strong> {coach}</span><span>Подпись __________________</span></span></td>)}</tr>
      </tbody>
    </table>

    <table className={styles.events}>
      <colgroup>{sides.flatMap(side => [5, 14, 9, 8, 8, 9, 9, 8, 10, 10, 10].map((width, index) =>
        <col key={side + index} style={{ width: `${width / 2}%` }} />))}</colgroup>
      <thead>
        <tr>{sides.flatMap(side => [<th key={side + "g"} colSpan={6} scope="colgroup">Взятие ворот «{side}»</th>, <th key={side + "p"} colSpan={5} scope="colgroup">Удаления «{side}»</th>])}</tr>
        <tr>{sides.flatMap(side => ["№", "Время", "Г", "П", "П", "ИС", "№", "Мин", "Пр.", "Нач.", "Окон."].map((label, index) => <th key={side + index} scope="col">{label}</th>))}</tr>
      </thead>
      <tbody>{formRows(17, ...goals.map(rows => rows.length), ...penalties.map(rows => rows.length)).map(index => <tr key={index}>
        {sides.map((_, side) => {
          const goal = goals[side][index];
          const penalty = penalties[side][index];
          return <Cells key={side} values={[
            ...(goal ? [index + 1, goal.time, playerLabel(side, goal.scorerId), playerLabel(side, goal.assist1Id), playerLabel(side, goal.assist2Id), goalSituation(goal)] : ["", "", "", "", "", ""]),
            ...(penalty ? [penalty.playerId ? playerLabel(side, penalty.playerId) : "Ком.", penalty.minutes, penalty.reasonCode || penalty.reason, penalty.time, ""] : ["", "", "", "", ""]),
          ]} />;
        })}
      </tr>)}</tbody>
    </table>

    <div className={styles.summary}>
      <div>
        <table><colgroup>{[35, 11, 9, 9, 9, 9, 9, 9].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
          <thead><tr><th colSpan={2}>Результат по периодам</th>{["1", "2", "3", "ОТ", "БП", "Общ."].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{resultRows.map(row => <tr key={row.metric + row.side}><th scope="row">{row.metric}</th><th>«{sides[row.side]}»</th><Cells values={row.values} /></tr>)}</tbody>
        </table>
        <table className={styles.signatures}><tbody>
          <tr><th>Главный судья</th><td>{details.referee1}</td><th>Судья времени игры</th><td>{details.timekeeper}</td></tr>
          <tr><th>Главный судья</th><td>{details.referee2}</td><th>Секретарь игры</th><td>{details.secretary}</td></tr>
          <tr><th>Подписи</th><td></td><th>Подпись</th><td></td></tr>
        </tbody></table>
      </div>
      <div>
        <table><thead><tr><th colSpan={2}>Время игры</th></tr></thead><tbody>
          <tr><th scope="row">Начало</th><td>{details.gameStart}</td></tr>
          <tr><th scope="row">Окончание</th><td>{details.gameEnd}</td></tr>
          {teams.map((team, side) => <tr key={team.id}><th scope="row">Тайм-аут «{sides[side]}»</th><td>{technicalResult ? "" : data.timeouts.find(timeout => timeout.teamEntryId === team.id)?.time}</td></tr>)}
          <tr><th scope="row">Замечания</th><td>{data.note.trim() ? "Да" : "Нет"}</td></tr>
        </tbody></table>
        <table><thead><tr><th colSpan={3}>Время игры вратарей</th></tr><tr><th>Время</th><th>«А»</th><th>«Б»</th></tr></thead>
          <tbody>{formRows(3, goalieTimes.length).map(index => {
            const time = goalieTimes[index];
            return <tr key={index}><td>{time}</td>{teams.map((team, side) => {
              const teamStints = goalieStints.filter(stint => stint.teamEntryId === team.id);
              const stint = time === undefined ? undefined : teamStints.find(row => row.from === time) ??
                teamStints.find(row => (timeValue(row.from) ?? Infinity) <= (timeValue(time) ?? 0) && (timeValue(row.to) ?? -1) >= (timeValue(time) ?? 0));
              return <td key={team.id}>{playerLabel(side, stint?.playerId)}</td>;
            })}</tr>;
          })}</tbody>
        </table>
      </div>
      <table><thead><tr><th colSpan={4}>Броски, определяющие победителя</th></tr><tr><th>№</th><th>Ком.</th><th>Игрок / вратарь</th><th>Результат</th></tr></thead>
        <tbody>{formRows(8, shootouts.length).map(index => {
          const shot = shootouts[index];
          const side = shot?.teamEntryId === teams[0].id ? 0 : 1;
          return <tr key={index}><Cells values={shot ? [
            index + 1, sides[side], [playerLabel(side, shot.playerId), playerLabel(1 - side, shot.goalieId)].filter(Boolean).join(" / "), shot.scored ? "Гол" : "Мимо",
          ] : ["", "", "", ""]} /></tr>;
        })}</tbody>
      </table>
    </div>
    {(data.note.trim() || data.referees.trim() || data.staff.trim()) && <div className={styles.notes}>
      {data.note.trim() && <p><strong>Замечания:</strong> {data.note}</p>}
      {data.referees.trim() && <p><strong>Судьи:</strong> {data.referees}</p>}
      {data.staff.trim() && <p><strong>Сотрудники:</strong> {data.staff}</p>}
    </div>}
  </article>;
}

export function PrintProtocol(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return <section className={styles.preview}>
    <div className={styles.toolbar}>
      <h2>Печатный протокол</h2>
      <button type="button" onClick={() => window.print()}>Печать протокола</button>
    </div>
    <details className={styles.details}>
      <summary>Реквизиты для печати</summary>
      <div>{detailFields.map(([key, label, type]) => <label key={key}>{label}
        <input type={type} min={type === "number" ? 0 : undefined} maxLength={type === "text" ? 120 : undefined}
          value={props.details[key]} onChange={event => props.onDetailsChange({ ...props.details, [key]: event.target.value })} />
      </label>)}</div>
    </details>
    <div className={styles.previewScroll} tabIndex={0}><ProtocolSheet data={props} /></div>
    {mounted && createPortal(<ProtocolSheet data={props} printCopy />, document.body)}
  </section>;
}
