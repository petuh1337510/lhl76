"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { AdminModal } from "../admin-modal";
import { MatchRosterCard, MatchRosterEditor, matchJerseyNumber, type RosterPlayer } from "./match-roster";
import { completeGoalieStint, formatMatchTime, MatchGoalieStints, toSeconds, validMatchTime, type GoalieStint } from "./match-goalie-stints";
import { PrintProtocol, readPrintDetails } from "./print-protocol";
import { useProtocolAutosave } from "./use-protocol-autosave";
import { EventFilters, EventTeamIdentity, isScoringGoal, MatchEventTables, type EventFilter } from "./match-events";
import styles from "./match-protocol.module.css";
import eventStyles from "./match-events.module.css";

const matchTabs = [
  ["info", "Информация о матче"],
  ["players", "Игроки матча"],
  ["events", "События матча"],
  ["staff", "Сотрудники матча"],
  ["referees", "Судьи матча"],
  ["remarks", "Замечания"],
  ["protocol", "Протокол"],
] as const;
type MatchTab = typeof matchTabs[number][0];
const matchStatusLabels: Record<string, string> = {
  SCHEDULED: "Запланирован", LIVE: "Матч идёт", FINAL: "Матч завершён", POSTPONED: "Матч перенесён", CANCELLED: "Матч отменён",
};
const jerseyOrder = new Intl.Collator("ru", { numeric: true });

function eventPlayerLabel(row: RosterPlayer, number: string) {
  return `${number ? `№${number} · ` : ""}${row.player.lastName} ${row.player.firstName}`;
}

function MatchPanel({ tab, active, children }: { tab: MatchTab; active: MatchTab; children: ReactNode }) {
  return <div className={styles.panel} id={`match-panel-${tab}`} role="tabpanel"
    aria-labelledby={`match-tab-${tab}`} tabIndex={0} hidden={active !== tab}>{children}</div>;
}

const situations = [
  ["5X5", "5×5 — равные составы"],
  ["5X4", "5×4 — большинство"],
  ["5X3", "5×3 — двойное большинство"],
  ["4X5", "4×5 — меньшинство"],
  ["3X5", "3×5 — двойное меньшинство"],
  ["4X4", "4×4"],
  ["3X3", "3×3"],
  ["EMPTY_NET", "Пустые ворота"],
  ["PENALTY_SHOT", "Штрафной бросок"],
];
const reasons = [
  ["АГРЕС", "Агрессор в драке"],
  ["АТ-В-ГОЛ", "Атака в голову или шею"],
  ["БЛОК", "Атака игрока, не владеющего шайбой"],
  ["АТ-СЗ", "Атака сзади"],
  ["БР-КЛ", "Бросок клюшки"],
  ["ГРУБ", "Грубость"],
  ["ВБ-ШБ", "Выброс шайбы"],
  ["ДИСЦ", "Дисциплинарный штраф"],
  ["ДИС-КН", "Дисциплинарный до конца матча"],
  ["ДРАКА", "Драка"],
  ["ЗАЧИН", "Зачинщик драки"],
  ["ЗД-ИГ", "Задержка игры"],
  ["ЗД-КЛ-СП", "Задержка клюшки соперника"],
  ["ЗД-КЛ", "Задержка клюшкой"],
  ["ЗД-СП", "Задержка соперника"],
  ["ЗД-ШБ", "Задержка шайбы руками"],
  ["СЛ-КЛ", "Игра со сломанной клюшкой"],
  ["КЛ-УД", "Колющий удар"],
  ["СК-ШТ", "Малый скамеечный штраф"],
  ["МШ", "Матч-штраф"],
  ["ЛД-ВР", "Направление осколков льда в лицо вратаря"],
  ["НАР-ЭК", "Опасное снаряжение"],
  ["НП-АТ", "Неправильная атака"],
  ["ЧС-СТ", "Нарушение численного состава"],
  ["ВП-КЛ", "Опасная игра высоко поднятой клюшкой"],
  ["НС-ПВ", "Оскорбление судей и неспортивное поведение"],
  ["ОТ-ИГ", "Отказ начать игру"],
  ["ОТСЧ", "Отсечение"],
  ["ПЛЕВОК", "Плевок"],
  ["ПОДН", "Подножка"],
  ["ПОДС", "Подсечка"],
  ["ПОЗ-СП", "Поздний силовой прием"],
  ["ПР-ИН", "Предупреждение инфекции"],
  ["ПК-СК", "Покидание скамейки"],
  ["СД-ВР", "Сдвиг ворот"],
  ["СИМ", "Симуляция"],
  ["ТЛ-БР", "Толчок на борт"],
  ["ТЛ-КЛ", "Толчок клюшкой"],
  ["УД-ГОЛ", "Удар головой"],
  ["УД-КЛ", "Удар клюшкой"],
  ["УД-К-КЛ", "Удар концом клюшки"],
  ["УД-КОЛ", "Удар коленом"],
  ["УД-ЛОК", "Удар локтем"],
  ["УД-НГ", "Удар ногой"],
  ["УКУС", "Укус"],
  ["КН-ЗР", "Физический контакт со зрителем"],
  ["ШТ-ВР", "Штрафы вратаря"],
  ["OTHER", "Другая причина"],
];
const toClock = (v: number | null) =>
  `${String(Math.floor((v || 0) / 60)).padStart(2, "0")}:${String((v || 0) % 60).padStart(2, "0")}`;
const getPeriod = (v: string | number) => {
  const s = typeof v === "number" ? v : toSeconds(v);
  return s < 1200 ? 1 : s < 2400 ? 2 : 3;
};
const emptyGoal = {
  teamEntryId: "",
  scorerId: "",
  assist1Id: "",
  assist2Id: "",
  time: "00:00",
  situation: "5X5",
  penaltyShotOutcome: "",
};
const emptyPenalty = {
  teamEntryId: "",
  playerId: "",
  time: "00:00",
  minutes: "2",
  reasonCode: "",
  reason: "",
};

export default function MatchProtocolPage() {
  const [match, setMatch] = useState<any>(null),
    [selected, setSelected] = useState<string[]>([]),
    [numbers, setNumbers] = useState<Record<string, string>>({}),
    [goals, setGoals] = useState<any[]>([]),
    [penalties, setPenalties] = useState<any[]>([]),
    [status, setStatus] = useState("SCHEDULED"),
    [resultType, setResultType] = useState("NORMAL"),
    [technicalWinnerTeamEntryId, setTechnicalWinnerTeamEntryId] = useState(""),
    [homeScore, setHomeScore] = useState("0"),
    [awayScore, setAwayScore] = useState("0"),
    [periods, setPeriods] = useState([
      { home: "", away: "" },
      { home: "", away: "" },
      { home: "", away: "" },
    ]),
    [shots, setShots] = useState([
      { home: "", away: "" },
      { home: "", away: "" },
      { home: "", away: "" },
    ]),
    [goalieStints, setGoalieStints] = useState<GoalieStint[]>([]),
    [timeouts, setTimeouts] = useState<any[]>([]),
    [playoff, setPlayoff] = useState({ winnerTeamEntryId: "" }),
    [shootouts, setShootouts] = useState<any[]>([]),
    [note, setNote] = useState(""),
    [staff, setStaff] = useState(""),
    [referees, setReferees] = useState(""),
    [printDetails, setPrintDetails] = useState(() => readPrintDetails(null)),
    [activeTab, setActiveTab] = useState<MatchTab>("info"),
    [eventFilter, setEventFilter] = useState<EventFilter>("all"),
    [goalOpen, setGoalOpen] = useState(false),
    [goalMode, setGoalMode] = useState<"names" | "numbers">("names"),
    [goalFormError, setGoalFormError] = useState(""),
    [penaltyOpen, setPenaltyOpen] = useState(false),
    [penaltyMode, setPenaltyMode] = useState<"names" | "numbers">("names"),
    [penaltyTarget, setPenaltyTarget] = useState<"player" | "team">("player"),
    [penaltyFormError, setPenaltyFormError] = useState(""),
    [goal, setGoal] = useState<any>(emptyGoal),
    [penalty, setPenalty] = useState<any>(emptyPenalty),
    [editGoal, setEditGoal] = useState<number | null>(null),
    [editPenalty, setEditPenalty] = useState<number | null>(null),
    [editingRosterTeamId, setEditingRosterTeamId] = useState<string | null>(null),
    [rosterError, setRosterError] = useState(""),
    [hasSavedShootouts, setHasSavedShootouts] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function load() {
    const slug = new URLSearchParams(location.search).get("match");
    if (!slug) {
      setError("Откройте протокол из списка матчей");
      return;
    }
    const r = await fetch(
      `/api/admin/match-protocol?slug=${encodeURIComponent(slug)}`,
    );
    if (!r.ok) {
      setError("Матч не найден");
      return;
    }
    const v = await r.json(),
      p = v.protocolData || {},
      eventTime = (x: { clockSeconds?: number | null }) => x.clockSeconds == null ? "" : toClock(x.clockSeconds);
    setMatch(v);
    setSelected(v.rosters.map((x: any) => x.rosterEntryId));
    setNumbers(
      Object.fromEntries(
        v.rosters
          .filter((x: any) => x.numberOverride)
          .map((x: any) => [x.rosterEntryId, x.numberOverride]),
      ),
    );
    setStatus(v.status);
    setResultType(v.resultType || "NORMAL");
    setTechnicalWinnerTeamEntryId(p.technicalWinnerTeamEntryId || "");
    setHomeScore(String(v.homeScore));
    setAwayScore(String(v.awayScore));
    if (Array.isArray(v.periodScores))
      setPeriods(
        [0, 1, 2].map((i) => ({
          home: String(v.periodScores[i]?.home ?? ""),
          away: String(v.periodScores[i]?.away ?? ""),
        })),
      );
    if (Array.isArray(p.shots))
      setShots(
        [0, 1, 2].map((i) => ({
          home: String(p.shots[i]?.home ?? ""),
          away: String(p.shots[i]?.away ?? ""),
        })),
      );
    setGoalieStints(p.goalieStints || []);
    setTimeouts(p.timeouts || []);
    setPlayoff({ winnerTeamEntryId: p.playoff?.winnerTeamEntryId || "" });
    setHasSavedShootouts(v.penaltyShots.some((shot: { phase: string }) => shot.phase === "SHOOTOUT"));
    setShootouts(
      v.penaltyShots
        .filter((x: any) => x.phase === "SHOOTOUT")
        .map((x: any) => ({
          id: x.id,
          teamEntryId: x.teamEntryId,
          playerId: x.playerId,
          goalieId: x.goalieId || "",
          scored: x.scored,
        })),
    );
    setNote(v.resultNote || "");
    setStaff(typeof p.staffNote === "string" ? p.staffNote : "");
    setReferees(typeof p.refereeNote === "string" ? p.refereeNote : "");
    setPrintDetails(readPrintDetails(p.printDetails));
    const scored = v.goals.map((x: any) => ({
        id: x.id,
        teamEntryId: x.teamEntryId,
        scorerId: x.scorerId,
        assist1Id: x.assists[0]?.playerId || "",
        assist2Id: x.assists[1]?.playerId || "",
        situation: x.situation || "5X5",
        penaltyShotOutcome: x.situation === "PENALTY_SHOT" ? "goal" : "",
        period: x.period,
        time: eventTime(x),
      })),
      missed = v.penaltyShots
        .filter((x: any) => x.phase === "IN_GAME")
        .map((x: any) => ({
          id: x.id,
          teamEntryId: x.teamEntryId,
          scorerId: x.playerId,
          assist1Id: "",
          assist2Id: "",
          situation: "PENALTY_SHOT",
          penaltyShotOutcome: "miss",
          period: x.period,
          time: eventTime(x),
        }));
    setGoals(
      [...scored, ...missed].sort(
        (a, b) => toSeconds(a.time) - toSeconds(b.time),
      ),
    );
    setPenalties(
      v.penalties.map((x: any) => ({ ...x, time: eventTime(x) })),
    );
  }
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (matchTabs.some(([id]) => id === tab)) setActiveTab(tab as MatchTab);
    load();
  }, []);
  const technicalResult = resultType === "TECHNICAL";
  const eventPayload = (event: { time: string; period?: number | null }) => {
    const seconds = validMatchTime(event.time) ? toSeconds(event.time) : null;
    return { ...event, period: seconds === null ? event.period ?? null : getPeriod(seconds), clockSeconds: seconds };
  };
  const draft = match ? JSON.stringify({
    matchId: match.id,
    rosterEntryIds: selected,
    numberOverrides: numbers,
    status,
    resultType,
    protocolData: {
      eventTimesAbsolute: true,
      shots: shots.map(({ home, away }) => ({ home: home === "" ? null : Number(home), away: away === "" ? null : Number(away) })),
      goalieStints,
      timeouts,
      playoff,
      staffNote: staff.trim(),
      refereeNote: referees.trim(),
      printDetails,
      technicalWinnerTeamEntryId: technicalResult ? technicalWinnerTeamEntryId : null,
    },
    shootouts: technicalResult ? [] : shootouts,
    resultNote: note,
    goals: technicalResult ? [] : goals.map(eventPayload),
    penalties: technicalResult ? [] : penalties.map(eventPayload),
  }) : null;
  const getBlockedReason = (stints = goalieStints) => {
    if (technicalResult) return technicalWinnerTeamEntryId ? "" : "Выберите победителя для технического результата.";
    if (stints.some(stint => !completeGoalieStint(stint))) return "Заполните вратаря и время каждого отрезка.";
    if (timeouts.some(timeout => !validMatchTime(timeout.time || ""))) return "Заполните время тайм-аута.";
    if (shootouts.some(shot => !shot.playerId)) return "Выберите исполнителя буллита.";
    return "";
  };
  const blockedReason = getBlockedReason();

  const { saveNow, saving, dirty, saveError, conflict } = useProtocolAutosave(match, draft, getBlockedReason, ({ response, latest, hasShootouts }) => {
    setHasSavedShootouts(hasShootouts);
    if (!latest) return;
    setHomeScore(String(response.score.home));
    setAwayScore(String(response.score.away));
    if (technicalResult) {
      setGoals([]);
      setPenalties([]);
      setShootouts([]);
    }
  });

  if (error && !match)
    return (
      <main className="adminShell">
        <section className="adminContent divisionPage">
          <a href="/admin/matches">← К матчам</a>
          <h2>{error}</h2>
        </section>
      </main>
    );
  if (!match)
    return (
      <main className="adminShell">
        <section className="adminContent divisionPage">
          Загрузка протокола…
        </section>
      </main>
    );
  const homeRoster = match.homeTeamEntry.roster,
    awayRoster = match.awayTeamEntry.roster,
    rosterFor = (id: string): RosterPlayer[] =>
      id === match.homeTeamEntryId ? homeRoster : awayRoster,
    selectedFor = (id: string) =>
      rosterFor(id).filter((x) => selected.includes(x.id)),
    teamName = (id: string) =>
      id === match.homeTeamEntryId
        ? match.homeTeamEntry.team.name
        : match.awayTeamEntry.team.name,
    eventPlayer = (tid: string, pid: string) => {
      const x = rosterFor(tid).find((r) => r.playerId === pid);
      return x ? {
        name: `${x.player.lastName} ${x.player.firstName}`,
        number: matchJerseyNumber(x, numbers),
      } : { name: "Игрок не указан", number: "" };
    };
  const numberedPlayersFor = (teamEntryId: string) => selectedFor(teamEntryId)
    .map((row) => ({ row, number: matchJerseyNumber(row, numbers) }))
    .sort((a, b) => Number(!a.number) - Number(!b.number) || jerseyOrder.compare(a.number, b.number)
      || eventPlayerLabel(a.row, "").localeCompare(eventPlayerLabel(b.row, ""), "ru"));
  const goalNumberPlayers = numberedPlayersFor(goal.teamEntryId);
  const penaltyNumberPlayers = numberedPlayersFor(penalty.teamEntryId);
  const goalRoleLabel = (playerId: string) => {
    const row = selectedFor(goal.teamEntryId).find((item) => item.playerId === playerId);
    return row ? eventPlayerLabel(row, matchJerseyNumber(row, numbers)) : "—";
  };
  const chooseGoalNumber = (playerId: string) => {
    setGoal((current: any) => {
      if (current.scorerId === playerId) return { ...current, scorerId: "" };
      if (current.assist1Id === playerId) return { ...current, assist1Id: "" };
      if (current.assist2Id === playerId) return { ...current, assist2Id: "" };
      if (!current.scorerId) return { ...current, scorerId: playerId };
      if (current.situation === "PENALTY_SHOT") return current;
      if (!current.assist1Id) return { ...current, assist1Id: playerId };
      if (!current.assist2Id) return { ...current, assist2Id: playerId };
      return current;
    });
    setGoalFormError("");
  };
  const openGoal = (tid: string, index: number | null = null) => {
    setGoal(
      index === null
        ? { ...emptyGoal, teamEntryId: tid }
        : { ...goals[index] },
    );
    setEditGoal(index);
    setGoalMode("names");
    setGoalFormError("");
    setPenaltyOpen(false);
    setGoalOpen(true);
  };
  const openPenalty = (tid: string, index: number | null = null) => {
    const current = index === null ? { ...emptyPenalty, teamEntryId: tid } : { ...penalties[index] };
    setPenalty(
      current,
    );
    setEditPenalty(index);
    setPenaltyMode("names");
    setPenaltyTarget(index !== null && !current.playerId ? "team" : "player");
    setPenaltyFormError("");
    setGoalOpen(false);
    setPenaltyOpen(true);
  };
  const syncScoreFromGoals = (nextGoals: any[]) => {
    const counted = nextGoals.filter(isScoringGoal);
    const nextPeriods = [1, 2, 3].map((period) => ({
      home: String(
        counted.filter(
          (x) =>
            x.teamEntryId === match.homeTeamEntryId &&
            getPeriod(x.time) === period,
        ).length,
      ),
      away: String(
        counted.filter(
          (x) =>
            x.teamEntryId === match.awayTeamEntryId &&
            getPeriod(x.time) === period,
        ).length,
      ),
    }));
    setPeriods(nextPeriods);
    setHomeScore(
      String(
        nextPeriods.reduce((total, period) => total + Number(period.home), 0),
      ),
    );
    setAwayScore(
      String(
        nextPeriods.reduce((total, period) => total + Number(period.away), 0),
      ),
    );
  };
  const commitGoal = () => {
    if (!goal.scorerId) { setGoalFormError("Выберите автора гола."); return; }
    if (!validMatchTime(goal.time)) { setGoalFormError("Укажите время матча в формате ММ:СС."); return; }
    const participants = [goal.scorerId, goal.assist1Id, goal.assist2Id].filter(Boolean);
    if (new Set(participants).size !== participants.length) { setGoalFormError("Автор и ассистенты должны быть разными игроками."); return; }
    const x = { ...goal, id: goal.id || `g-${Date.now()}` };
    const nextGoals =
      editGoal === null
        ? [...goals, x]
        : goals.map((v, i) => (i === editGoal ? x : v));
    setGoals(nextGoals);
    syncScoreFromGoals(nextGoals);
    setGoalOpen(false);
    setGoalFormError("");
    setEditGoal(null);
  };
  const commitPenalty = () => {
    if (penaltyTarget === "player" && !penalty.playerId) { setPenaltyFormError("Выберите игрока или командный штраф."); return; }
    if (!validMatchTime(penalty.time)) { setPenaltyFormError("Укажите время матча в формате ММ:СС."); return; }
    if (!Number.isFinite(Number(penalty.minutes)) || Number(penalty.minutes) <= 0) { setPenaltyFormError("Укажите количество штрафных минут больше нуля."); return; }
    const x = { ...penalty, playerId: penaltyTarget === "team" ? "" : penalty.playerId, id: penalty.id || `p-${Date.now()}` };
    setPenalties((a) =>
      editPenalty === null
        ? [...a, x]
        : a.map((v, i) => (i === editPenalty ? x : v)),
    );
    setPenaltyOpen(false);
    setPenaltyFormError("");
    setEditPenalty(null);
  };
  const timeoutFor = (tid: string) =>
      timeouts.find((x) => x.teamEntryId === tid),
    setTimeoutFor = (tid: string, on: boolean, time = "00:00") =>
      setTimeouts((a) =>
        on
          ? [
              ...a.filter((x) => x.teamEntryId !== tid),
              { teamEntryId: tid, time },
            ]
          : a.filter((x) => x.teamEntryId !== tid),
      );
  const teams = [match.homeTeamEntry, match.awayTeamEntry];
  const teamIds = [match.homeTeamEntryId, match.awayTeamEntryId] as const;
  const stintsFor = (teamId: string) => goalieStints.filter(stint => stint.teamEntryId === teamId);
  const withTeamStints = (teamId: string, stints: GoalieStint[]) => {
    const otherStints = goalieStints.filter(stint => stint.teamEntryId !== teamId);
    const first = goalieStints.findIndex(stint => stint.teamEntryId === teamId);
    otherStints.splice(first < 0 ? otherStints.length : first, 0, ...stints);
    return otherStints;
  };
  const scoringGoals = goals.filter(isScoringGoal);
  const eventCounts = {
    all: goals.length + penalties.length + goalieStints.length + timeouts.length + shootouts.length,
    goals: scoringGoals.length,
    penalties: penalties.length,
    goalies: goalieStints.length + timeouts.length,
    shootouts: shootouts.length,
  };
  const regulationTie = scoringGoals.filter(goal => goal.teamEntryId === match.homeTeamEntryId).length ===
    scoringGoals.filter(goal => goal.teamEntryId === match.awayTeamEntryId).length;
  const canEditShootouts = match.isPlayoff && (Number(homeScore) === Number(awayScore) || (regulationTie && hasSavedShootouts));
  const scoreFor = (teamId: string, score: string) => technicalResult
    ? !technicalWinnerTeamEntryId ? "—" : technicalWinnerTeamEntryId === teamId ? "+" : "−"
    : score;
  const lockedPlayersFor = (teamEntryId: string) => new Set<string>(resultType === "TECHNICAL" ? [] : [
    ...goals.filter(goal => goal.teamEntryId === teamEntryId).flatMap(goal => [goal.scorerId, goal.assist1Id, goal.assist2Id]),
    ...penalties.filter(penalty => penalty.teamEntryId === teamEntryId).map(penalty => penalty.playerId),
    ...shootouts.map(shot => shot.teamEntryId === teamEntryId ? shot.playerId : shot.goalieId),
  ].filter(Boolean));
  const activeSuspension = (row: any) =>
    row.suspensions?.find((suspension: any) => {
      if (suspension.status !== "ACTIVE") return false;
      const matchTime = new Date(match.startsAt || Date.now()).getTime();
      return matchTime >= new Date(suspension.startsAt).getTime() &&
        (!suspension.endsAt || matchTime <= new Date(suspension.endsAt).getTime());
    });
  async function saveTeamRoster(entry: any, teamSelected: string[], teamNumbers: Record<string, string>, teamStints: GoalieStint[]) {
    const nextStints = technicalResult ? goalieStints : withTeamStints(entry.id, teamStints);
    const incomplete = !technicalResult && nextStints.find(stint => !completeGoalieStint(stint));
    const validation = incomplete
      ? `Заполните отрезки команды «${teamName(incomplete.teamEntryId)}» во вкладке «События матча».`
      : getBlockedReason(nextStints);
    setRosterError(validation);
    if (validation) return;
    const teamIds = new Set<string>(entry.roster.map((row: any) => row.id));
    const rosterEntryIds = [...selected.filter((id) => !teamIds.has(id)), ...teamSelected];
    const numberOverrides = { ...numbers };
    for (const id of teamIds) delete numberOverrides[id];
    Object.assign(numberOverrides, teamNumbers);
    await saveNow({ rosterEntryIds, numberOverrides, goalieStints: nextStints }, () => {
      setSelected(rosterEntryIds);
      setNumbers(numberOverrides);
      setGoalieStints(nextStints);
      setEditingRosterTeamId(null);
      setMessage(`Состав команды «${entry.team.name}» сохранён`);
    });
  }
  return (
    <main className="adminShell adminProtocol">
      <section className="adminContent divisionPage">
        <nav className="protocolPageLinks" aria-label="Переходы по матчу">
          <a className="backButton" href="/admin/matches">← К матчам и календарю</a>
          <a className="protocolPublicLink" href={`/match/${encodeURIComponent(match.slug)}`} target="_blank" rel="noopener noreferrer">Публичная страница матча <span aria-hidden="true">↗</span></a>
        </nav>
        {message && <p className="adminNotice">{message}</p>}
        {error && <p className="formError">{error}</p>}
        <header className={eventStyles.summary} aria-label="Табло матча">
          <div className={eventStyles.summaryLayout}>
            <select className={eventStyles.status} aria-label="Статус матча" value={status} data-live={status === "LIVE"}
              disabled={technicalResult} onChange={event => setStatus(event.target.value)}>
              {Object.entries(matchStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div className={eventStyles.matchCenter}>
              <h1 className={eventStyles.scoreboard}>
                <span className={eventStyles.home}><EventTeamIdentity team={match.homeTeamEntry.team} /></span>
                <strong className={eventStyles.result}>{scoreFor(match.homeTeamEntryId, homeScore)} <span>:</span> {scoreFor(match.awayTeamEntryId, awayScore)}</strong>
                <EventTeamIdentity team={match.awayTeamEntry.team} />
              </h1>
              <p className={eventStyles.matchDetails}>
                <span>{match.division.competition.season.name} · {match.division.competition.name} · {match.division.name}</span>
                <span>{match.startsAt ? new Date(match.startsAt).toLocaleString("ru-RU") : "Дата не указана"} · {match.venue?.name || "Арена не указана"}</span>
              </p>
            </div>
            {status === "LIVE" && !technicalResult && <button type="button" className={eventStyles.finish} disabled={saving || conflict || Boolean(blockedReason)}
              onClick={() => void saveNow({ status: "FINAL" }, () => setStatus("FINAL"))}>Завершить матч</button>}
          </div>
        </header>
        <div className={styles.tabs} role="tablist" aria-label="Разделы матча" onKeyDown={event => {
          const current = matchTabs.findIndex(([id]) => id === activeTab);
          const last = matchTabs.length - 1;
          const next = event.key === "Home" ? 0 : event.key === "End" ? last
            : event.key === "ArrowLeft" ? (current + last) % matchTabs.length
            : event.key === "ArrowRight" ? (current + 1) % matchTabs.length : -1;
          if (next < 0) return;
          event.preventDefault();
          setActiveTab(matchTabs[next][0]);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>
          {matchTabs.map(([id, label]) => <button key={id} type="button" id={`match-tab-${id}`} role="tab"
            aria-controls={`match-panel-${id}`} aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}>{label}</button>)}
        </div>
        <MatchPanel tab="info" active={activeTab}>
        <section className="protocolResult">
          <h3>Результат матча</h3>
          <div>
            <label>
              Тип результата
              <select
                value={resultType}
                onChange={(e) => {
                  setResultType(e.target.value);
                  if (e.target.value === "TECHNICAL") {
                    setTechnicalWinnerTeamEntryId("");
                  }
                }}
              >
                <option value="NORMAL">Обычный результат</option>
                <option value="TECHNICAL">Технический результат</option>
              </select>
            </label>
            {resultType === "TECHNICAL" && <label>
              Техническая победа
              <select
                value={technicalWinnerTeamEntryId}
                onChange={(e) => {
                  setTechnicalWinnerTeamEntryId(e.target.value);
                  if (e.target.value) setStatus("FINAL");
                }}
              >
                <option value="">Выберите победителя</option>
                <option value={match.homeTeamEntryId}>{teamName(match.homeTeamEntryId)}</option>
                <option value={match.awayTeamEntryId}>{teamName(match.awayTeamEntryId)}</option>
              </select>
            </label>}
            <label>
              {teamName(match.homeTeamEntryId)}
              {resultType === "TECHNICAL" ? <strong className="technicalScoreInput">
                {!technicalWinnerTeamEntryId ? "—" : technicalWinnerTeamEntryId === match.homeTeamEntryId ? "+" : "−"}
              </strong> : <input
                type="number"
                min="0"
                value={homeScore}
                readOnly
              />}
            </label>
            <label>
              {teamName(match.awayTeamEntryId)}
              {resultType === "TECHNICAL" ? <strong className="technicalScoreInput">
                {!technicalWinnerTeamEntryId ? "—" : technicalWinnerTeamEntryId === match.awayTeamEntryId ? "+" : "−"}
              </strong> : <input
                type="number"
                min="0"
                value={awayScore}
                readOnly
              />}
            </label>
          </div>
          {resultType === "TECHNICAL" ? <p className="technicalResultNotice">
            После выбора победителя технический результат сохранится автоматически.
            Голы, штрафы и буллиты будут удалены из протокола.
          </p> : <div className="periodScoreInputs">
            {periods.map((p, i) => (
              <div key={i}>
                <b>{i + 1} период</b>
                <input
                  type="number"
                  min="0"
                  value={p.home}
                  readOnly
                />
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  value={p.away}
                  readOnly
                />
              </div>
            ))}
          </div>}
        </section>
        </MatchPanel>
        <MatchPanel tab="players" active={activeTab}>
          <div className={styles.rosters}>
            {teams.map((entry: any) => <MatchRosterCard key={entry.id} entry={entry} selected={selected} numbers={numbers}
              onEdit={() => { setRosterError(""); setEditingRosterTeamId(entry.id); }} />)}
          </div>
        </MatchPanel>
        {teams.map((entry: any) => activeTab === "players" && editingRosterTeamId === entry.id && <MatchRosterEditor
          key={entry.id}
          entry={entry}
          selected={selected.filter((id) => entry.roster.some((row: any) => row.id === id))}
          numbers={numbers}
          activeSuspension={activeSuspension}
          lockedPlayers={lockedPlayersFor(entry.id)}
          goalieEditor={technicalResult ? undefined : { stints: stintsFor(entry.id), shots, teamIds }}
          saving={saving}
          error={rosterError || saveError}
          onClose={() => setEditingRosterTeamId(null)}
          onSave={(teamSelected, teamNumbers, teamStints) => saveTeamRoster(entry, teamSelected, teamNumbers, teamStints)}
        />)}
        <MatchPanel tab="staff" active={activeTab}>
          <section className={styles.noteCard}>
            <h2>Сотрудники матча</h2>
            <label>Имя и обязанности<textarea value={staff} onChange={event => setStaff(event.target.value)} rows={5}
              maxLength={2000} placeholder="Например: Иванов Иван — секретарь матча" /></label>
          </section>
        </MatchPanel>
        <MatchPanel tab="referees" active={activeTab}>
          <section className={styles.noteCard}>
            <h2>Судьи матча</h2>
            <label>Имя и роль<textarea value={referees} onChange={event => setReferees(event.target.value)} rows={5}
              maxLength={2000} placeholder="Например: Иванов Иван — главный судья" /></label>
          </section>
        </MatchPanel>
        <MatchPanel tab="events" active={activeTab}>
          <div className={eventStyles.layout}>
            <h2 className={eventStyles.title}>События матча</h2>
            <EventFilters current={eventFilter} counts={eventCounts} onChange={setEventFilter} />
            {technicalResult && <p className="technicalResultNotice">
              Для технического результата голы, штрафы и буллиты не сохраняются.
            </p>}
          {goalOpen && (
            <AdminModal title={`${editGoal === null ? "Добавить гол" : "Изменить гол"} · ${teamName(goal.teamEntryId)}`} onClose={() => setGoalOpen(false)} wide>
              <section className="adminForm goalProtocolForm">
                <h2>{editGoal === null ? "Добавить гол" : "Изменить гол"} · {teamName(goal.teamEntryId)}</h2>
                {!selectedFor(goal.teamEntryId).length && <p className="goalRosterHint">Сначала выберите и сохраните участников этой команды в разделе «Игроки матча».</p>}
                <div className="goalEntryTabs" role="tablist" aria-label="Способ выбора игроков">
                  <button type="button" role="tab" aria-selected={goalMode === "names"} onClick={() => setGoalMode("names")}>По фамилиям</button>
                  <button type="button" role="tab" aria-selected={goalMode === "numbers"} onClick={() => setGoalMode("numbers")}>По номерам</button>
                </div>
                {goalMode === "names" ? <div className="goalNameFields" role="tabpanel">
                  <label>Автор гола<select value={goal.scorerId} onChange={(e) => {
                    const scorerId = e.target.value;
                    setGoal({ ...goal, scorerId, assist1Id: goal.assist1Id === scorerId ? "" : goal.assist1Id, assist2Id: goal.assist2Id === scorerId ? "" : goal.assist2Id });
                    setGoalFormError("");
                  }}><option value="">Выберите игрока</option>{selectedFor(goal.teamEntryId).map((row: any) => <option key={row.playerId} value={row.playerId}>{row.player.lastName} {row.player.firstName}</option>)}</select></label>
                  {goal.situation !== "PENALTY_SHOT" && [1, 2].map((n) => <label key={n}>Ассистент {n}<select value={goal[`assist${n}Id`]} onChange={(e) => { setGoal({ ...goal, [`assist${n}Id`]: e.target.value }); setGoalFormError(""); }}><option value="">Не указан</option>{selectedFor(goal.teamEntryId).filter((row: any) => row.playerId !== goal.scorerId && row.playerId !== goal[`assist${n === 1 ? 2 : 1}Id`]).map((row: any) => <option key={row.playerId} value={row.playerId}>{row.player.lastName} {row.player.firstName}</option>)}</select></label>)}
                </div> : <div className="goalNumberMode" role="tabpanel">
                  <p>Выберите автора гола, затем ассистентов. Игроки без номера показаны в конце. Повторное нажатие снимает выбор.</p>
                  <div className="goalNumberRoles">
                    <div><span>Автор гола</span><strong>{goalRoleLabel(goal.scorerId)}</strong></div>
                    {goal.situation !== "PENALTY_SHOT" && <><div><span>Ассистент 1</span><strong>{goalRoleLabel(goal.assist1Id)}</strong></div><div><span>Ассистент 2</span><strong>{goalRoleLabel(goal.assist2Id)}</strong></div></>}
                  </div>
                  {goalNumberPlayers.length > 0 && <div className="goalNumberGrid">{goalNumberPlayers.map(({ row, number }) => {
                    const role = goal.scorerId === row.playerId ? "scorer" : goal.assist1Id === row.playerId || goal.assist2Id === row.playerId ? "assist" : "";
                    const full = Boolean(goal.scorerId && (goal.situation === "PENALTY_SHOT" || (goal.assist1Id && goal.assist2Id)));
                    const playerLabel = eventPlayerLabel(row, number);
                    return <button type="button" key={row.id} className={`goalNumberTile${role ? ` is-${role}` : ""}`} aria-pressed={Boolean(role)} aria-label={`${playerLabel}${role === "scorer" ? ", автор гола" : role === "assist" ? ", ассистент" : ""}`} title={playerLabel} disabled={!role && full} onClick={() => chooseGoalNumber(row.playerId)}><b>{number || "—"}</b><small>{number ? row.player.lastName : playerLabel}</small></button>;
                  })}</div>}
                </div>}
                <div className="goalCommonFields">
                  <label>Время матча<input inputMode="numeric" value={goal.time} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setGoal({ ...goal, time: formatMatchTime(event.target.value) })} placeholder="34:25" /></label>
                  <label>Период<input disabled value={`${getPeriod(goal.time)} период`} /></label>
                  <label>Составы<select value={goal.situation} onChange={(event) => {
                    const situation = event.target.value;
                    setGoal({ ...goal, situation, penaltyShotOutcome: situation === "PENALTY_SHOT" ? "goal" : "", assist1Id: situation === "PENALTY_SHOT" ? "" : goal.assist1Id, assist2Id: situation === "PENALTY_SHOT" ? "" : goal.assist2Id });
                  }}>{situations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  {goal.situation === "PENALTY_SHOT" && <label>Результат броска<select value={goal.penaltyShotOutcome || "goal"} onChange={(event) => setGoal({ ...goal, penaltyShotOutcome: event.target.value })}><option value="goal">Реализован — засчитать гол</option><option value="miss">Не реализован — без гола</option></select></label>}
                </div>
                {goalFormError && <p role="alert" className="formError">{goalFormError}</p>}
                <footer><button type="button" onClick={() => setGoalOpen(false)}>Отмена</button><button type="button" onClick={commitGoal}>{editGoal === null ? "Добавить гол" : "Сохранить изменения"}</button></footer>
              </section>
            </AdminModal>
          )}
          {penaltyOpen && (
            <AdminModal title={`${editPenalty === null ? "Добавить удаление" : "Изменить удаление"} · ${teamName(penalty.teamEntryId)}`} onClose={() => setPenaltyOpen(false)} wide>
              <section className="adminForm goalProtocolForm penaltyProtocolForm">
                <h2>{editPenalty === null ? "Добавить удаление" : "Изменить удаление"} · {teamName(penalty.teamEntryId)}</h2>
                <div className="penaltyTargetChoice" aria-label="Кому назначен штраф">
                  <button type="button" className={penaltyTarget === "player" ? "active" : ""} aria-pressed={penaltyTarget === "player"} onClick={() => { setPenaltyTarget("player"); setPenaltyFormError(""); }}>Штраф игроку</button>
                  <button type="button" className={penaltyTarget === "team" ? "active" : ""} aria-pressed={penaltyTarget === "team"} onClick={() => { setPenaltyTarget("team"); setPenalty({ ...penalty, playerId: "" }); setPenaltyFormError(""); }}>Командный штраф</button>
                </div>
                {penaltyTarget === "team" ? (
                  <p className="penaltyTeamHint">Штраф появится в хронологии матча у команды. Штрафные минуты не будут начислены ни одному игроку.</p>
                ) : <>
                  {!selectedFor(penalty.teamEntryId).length && <p className="goalRosterHint">Сначала выберите и сохраните участников этой команды в разделе «Игроки матча».</p>}
                  <div className="goalEntryTabs" role="tablist" aria-label="Способ выбора игрока для удаления">
                    <button type="button" role="tab" aria-selected={penaltyMode === "names"} onClick={() => setPenaltyMode("names")}>По фамилиям</button>
                    <button type="button" role="tab" aria-selected={penaltyMode === "numbers"} onClick={() => setPenaltyMode("numbers")}>По номерам</button>
                  </div>
                  {penaltyMode === "names" ? <div className="penaltyNameFields" role="tabpanel">
                    <label>Игрок<select value={penalty.playerId || ""} onChange={(event) => { setPenalty({ ...penalty, playerId: event.target.value }); setPenaltyFormError(""); }}><option value="">Выберите игрока</option>{selectedFor(penalty.teamEntryId).map((row: any) => <option key={row.playerId} value={row.playerId}>{row.player.lastName} {row.player.firstName}</option>)}</select></label>
                  </div> : <div className="goalNumberMode penaltyNumberMode" role="tabpanel">
                    <p>Выберите удалённого игрока. Игроки без номера показаны в конце. Повторное нажатие снимает выбор.</p>
                    {penaltyNumberPlayers.length > 0 && <div className="goalNumberGrid">{penaltyNumberPlayers.map(({ row, number }) => {
                      const playerLabel = eventPlayerLabel(row, number);
                      return <button type="button" key={row.id} className={`goalNumberTile${penalty.playerId === row.playerId ? " is-penalty" : ""}`} aria-pressed={penalty.playerId === row.playerId} aria-label={playerLabel} title={playerLabel} onClick={() => { setPenalty({ ...penalty, playerId: penalty.playerId === row.playerId ? "" : row.playerId }); setPenaltyFormError(""); }}><b>{number || "—"}</b><small>{number ? row.player.lastName : playerLabel}</small></button>;
                    })}</div>}
                  </div>}
                </>}
                <div className="penaltyCommonFields">
                  <label>Время матча<input inputMode="numeric" value={penalty.time} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { setPenalty({ ...penalty, time: formatMatchTime(event.target.value) }); setPenaltyFormError(""); }} placeholder="27:10" /></label>
                  <label>Период<input disabled value={`${getPeriod(penalty.time)} период`} /></label>
                  <label>Минуты<input type="number" min="1" value={penalty.minutes} onChange={(event) => { setPenalty({ ...penalty, minutes: event.target.value }); setPenaltyFormError(""); }} /></label>
                  <label className="penaltyReasonField">Причина<select value={penalty.reasonCode || ""} onChange={(event) => { const selectedReason = reasons.find((row) => row[0] === event.target.value); setPenalty({ ...penalty, reasonCode: event.target.value, reason: selectedReason?.[1] || "" }); }}><option value="">Выберите причину</option>{reasons.map(([code, label]) => <option key={code} value={code}>{label} · {code}</option>)}</select></label>
                  {penalty.reasonCode === "OTHER" && <label className="penaltyReasonField">Уточнение<input value={penalty.reason} onChange={(event) => setPenalty({ ...penalty, reason: event.target.value })} /></label>}
                </div>
                {penaltyFormError && <p role="alert" className="formError">{penaltyFormError}</p>}
                <footer><button type="button" onClick={() => setPenaltyOpen(false)}>Отмена</button><button type="button" onClick={commitPenalty}>{editPenalty === null ? "Добавить удаление" : "Сохранить изменения"}</button></footer>
              </section>
            </AdminModal>
          )}
            {(eventFilter === "all" || eventFilter === "goals" || eventFilter === "penalties") && (
              <MatchEventTables teams={teams} filter={eventFilter} goals={goals} penalties={penalties}
                disabled={technicalResult} player={eventPlayer} onGoal={openGoal} onPenalty={openPenalty}
                onDeleteGoal={index => {
                  const next = goals.filter((_, position) => position !== index);
                  setGoals(next);
                  syncScoreFromGoals(next);
                }}
                onDeletePenalty={index => setPenalties(current => current.filter((_, position) => position !== index))}
              />
            )}
            {(eventFilter === "goalies" || (eventFilter === "all" && eventCounts.goalies > 0)) && (
              <div className={eventStyles.supportGrid}>
          <section className={`protocolExtra ${eventStyles.goalieCard}`}>
            <h3>Время игры вратарей</h3>
            {teams.map((entry: any) => (
              <MatchGoalieStints key={entry.id} teamId={entry.id} teamName={entry.team.name}
                players={selectedFor(entry.id)} stints={stintsFor(entry.id)} shots={shots} teamIds={teamIds}
                onChange={stints => setGoalieStints(withTeamStints(entry.id, stints))} />
            ))}
          </section>
          <section className="protocolExtra">
            <h3>Тайм-ауты</h3>
            {teams.map((entry: any) => {
              const t = timeoutFor(entry.id);
              return (
                <div className="timeoutRow" key={entry.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!t}
                      onChange={(e) =>
                        setTimeoutFor(entry.id, e.target.checked)
                      }
                    />{" "}
                    {entry.team.name}
                  </label>
                  <input
                    disabled={!t}
                    inputMode="numeric"
                    value={t?.time ?? "00:00"}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(e) =>
                      setTimeoutFor(entry.id, true, formatMatchTime(e.target.value))
                    }
                    placeholder="Время матча"
                  />
                </div>
              );
            })}
          </section>
                {eventFilter === "goalies" && (
                <section className={`protocolExtra ${eventStyles.matchShots}`}>
                  <h3>Броски в створ</h3>
                  <div className="shotsGrid">
                    <span>Период</span>
                    <b>{teamName(match.homeTeamEntryId)}</b>
                    <b>{teamName(match.awayTeamEntryId)}</b>
                    {shots.map((x, i) => (
                      <Fragment key={i}>
                        <span>{i + 1} период</span>
                        <input
                          type="number"
                          min="0"
                          value={x.home}
                          onChange={(e) =>
                            setShots(
                              shots.map((v, n) =>
                                n === i ? { ...v, home: e.target.value } : v,
                              ),
                            )
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          value={x.away}
                          onChange={(e) =>
                            setShots(
                              shots.map((v, n) =>
                                n === i ? { ...v, away: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </Fragment>
                    ))}
                  </div>
                </section>
                )}
              </div>
            )}
            {(eventFilter === "shootouts" || (eventFilter === "all" && shootouts.length > 0)) &&
              (canEditShootouts && !technicalResult ? (
          <section className="shootoutProtocol">
            <header>
              <div>
                <span>ПОСЛЕ МАТЧА</span>
                <h2>Серия буллитов</h2>
              </div>
              <button
                onClick={() =>
                  setShootouts([
                    ...shootouts,
                    {
                      id: `b-${Date.now()}`,
                      teamEntryId: match.homeTeamEntryId,
                      playerId:
                        selectedFor(match.homeTeamEntryId)[0]?.playerId || "",
                      goalieId:
                        selectedFor(match.awayTeamEntryId)[0]?.playerId || "",
                      scored: false,
                    },
                  ])
                }
              >
                + БУЛЛИТ
              </button>
            </header>
            {shootouts.map((x: any, i: number) => (
              <div className="shootoutRow" key={x.id}>
                <select
                  value={x.teamEntryId}
                  onChange={(e) =>
                    setShootouts(
                      shootouts.map((v, n) =>
                        n === i
                          ? {
                              ...v,
                              teamEntryId: e.target.value,
                              playerId:
                                selectedFor(e.target.value)[0]?.playerId || "",
                              goalieId:
                                selectedFor(
                                  e.target.value === match.homeTeamEntryId
                                    ? match.awayTeamEntryId
                                    : match.homeTeamEntryId,
                                )[0]?.playerId || "",
                            }
                          : v,
                      ),
                    )
                  }
                >
                  <option value={match.homeTeamEntryId}>
                    {teamName(match.homeTeamEntryId)}
                  </option>
                  <option value={match.awayTeamEntryId}>
                    {teamName(match.awayTeamEntryId)}
                  </option>
                </select>
                <select
                  aria-label="Вратарь соперника"
                  value={x.goalieId || ""}
                  onChange={(e) =>
                    setShootouts(
                      shootouts.map((v, n) =>
                        n === i ? { ...v, goalieId: e.target.value } : v,
                      ),
                    )
                  }
                >
                  <option value="">Вратарь не указан</option>
                  {selectedFor(
                    x.teamEntryId === match.homeTeamEntryId
                      ? match.awayTeamEntryId
                      : match.homeTeamEntryId,
                  ).map((r: any) => (
                    <option key={r.playerId} value={r.playerId}>
                      Вр. {r.player.lastName} {r.player.firstName}
                    </option>
                  ))}
                </select>
                <select
                  value={x.playerId}
                  onChange={(e) =>
                    setShootouts(
                      shootouts.map((v, n) =>
                        n === i ? { ...v, playerId: e.target.value } : v,
                      ),
                    )
                  }
                >
                  {selectedFor(x.teamEntryId).map((r: any) => (
                    <option key={r.playerId} value={r.playerId}>
                      {r.player.lastName} {r.player.firstName}
                    </option>
                  ))}
                </select>
                <select
                  value={x.scored ? "goal" : "miss"}
                  onChange={(e) =>
                    setShootouts(
                      shootouts.map((v, n) =>
                        n === i
                          ? { ...v, scored: e.target.value === "goal" }
                          : v,
                      ),
                    )
                  }
                >
                  <option value="miss">Не забит</option>
                  <option value="goal">Гол</option>
                </select>
                <button
                  onClick={() =>
                    setShootouts(shootouts.filter((_, n) => n !== i))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <label>
              Победитель серии
              <select
                value={playoff.winnerTeamEntryId}
                onChange={(e) =>
                  setPlayoff({ ...playoff, winnerTeamEntryId: e.target.value })
                }
              >
                <option value="">Не указан</option>
                <option value={match.homeTeamEntryId}>
                  {teamName(match.homeTeamEntryId)}
                </option>
                <option value={match.awayTeamEntryId}>
                  {teamName(match.awayTeamEntryId)}
                </option>
              </select>
            </label>
          </section>
              ) : <p className={eventStyles.unavailable}>Послематчевые броски доступны при ничейном счёте в плей-офф.</p>)}
          </div>
        </MatchPanel>
        <MatchPanel tab="remarks" active={activeTab}>
          <section className={styles.noteCard}>
            <h2>Замечания</h2>
            <label>
              Примечание к матчу
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Технический результат, перенос, особые обстоятельства…"
              />
            </label>
            {match.isPlayoff && (
              <p className="playoffProtocolMark">Матч плей-офф</p>
            )}
          </section>
        </MatchPanel>
        <MatchPanel tab="protocol" active={activeTab}>
          {activeTab === "protocol" && <PrintProtocol match={match} selected={selected} numbers={numbers}
            score={{ home: scoreFor(match.homeTeamEntryId, homeScore), away: scoreFor(match.awayTeamEntryId, awayScore) }}
            statusLabel={matchStatusLabels[status] || status} technicalResult={technicalResult}
            periods={periods} shots={shots} goals={goals} penalties={penalties} goalieStints={goalieStints}
            timeouts={timeouts} shootouts={shootouts} note={note} staff={staff} referees={referees}
            details={printDetails} onDetailsChange={setPrintDetails} />}
        </MatchPanel>
        <div className={`protocolSave ${styles.saveBar}`}>
          <span role={saveError ? "alert" : "status"}>
            {saveError || (saving ? "Сохраняем протокол…" : dirty && blockedReason ? blockedReason
              : dirty ? "Сохраняем изменения…" : "Автосохранение включено · все изменения сохранены")}
          </span>
          {saveError && !conflict && <button type="button" disabled={saving || Boolean(blockedReason)}
            onClick={() => void saveNow()}>Повторить сохранение</button>}
        </div>
      </section>
    </main>
  );
}
