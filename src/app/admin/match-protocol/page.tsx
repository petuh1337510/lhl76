"use client";
import { Fragment, useEffect, useState } from "react";

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
const toSeconds = (v: string) => {
  const [m, s] = v.split(":").map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? Math.max(0, m * 60 + s) : 0;
};
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
    [goalieStints, setGoalieStints] = useState<any[]>([]),
    [timeouts, setTimeouts] = useState<any[]>([]),
    [playoff, setPlayoff] = useState({ winnerTeamEntryId: "" }),
    [shootouts, setShootouts] = useState<any[]>([]),
    [note, setNote] = useState(""),
    [goalOpen, setGoalOpen] = useState(false),
    [penaltyOpen, setPenaltyOpen] = useState(false),
    [goal, setGoal] = useState<any>(emptyGoal),
    [penalty, setPenalty] = useState<any>(emptyPenalty),
    [editGoal, setEditGoal] = useState<number | null>(null),
    [editPenalty, setEditPenalty] = useState<number | null>(null),
    [saving, setSaving] = useState(false),
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
      absolute = !!p.eventTimesAbsolute,
      eventSeconds = (x: any) =>
        absolute
          ? x.clockSeconds || 0
          : Math.max(0, ((x.period || 1) - 1) * 1200 + (x.clockSeconds || 0));
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
    const scored = v.goals.map((x: any) => ({
        id: x.id,
        teamEntryId: x.teamEntryId,
        scorerId: x.scorerId,
        assist1Id: x.assists[0]?.playerId || "",
        assist2Id: x.assists[1]?.playerId || "",
        situation: x.situation || "5X5",
        penaltyShotOutcome: x.situation === "PENALTY_SHOT" ? "goal" : "",
        time: toClock(eventSeconds(x)),
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
          time: toClock(eventSeconds(x)),
        }));
    setGoals(
      [...scored, ...missed].sort(
        (a, b) => toSeconds(a.time) - toSeconds(b.time),
      ),
    );
    setPenalties(
      v.penalties.map((x: any) => ({ ...x, time: toClock(eventSeconds(x)) })),
    );
  }
  useEffect(() => {
    load();
  }, []);
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
    rosterFor = (id: string) =>
      id === match.homeTeamEntryId ? homeRoster : awayRoster,
    selectedFor = (id: string) =>
      rosterFor(id).filter((x: any) => selected.includes(x.id)),
    teamName = (id: string) =>
      id === match.homeTeamEntryId
        ? match.homeTeamEntry.team.name
        : match.awayTeamEntry.team.name,
    playerName = (tid: string, pid: string) => {
      const x = rosterFor(tid).find((r: any) => r.playerId === pid);
      return x
        ? `${x.player.lastName} ${x.player.firstName}`
        : "Игрок не указан";
    };
  const openGoal = (tid: string, index: number | null = null) => {
    const r = selectedFor(tid);
    setGoal(
      index === null
        ? { ...emptyGoal, teamEntryId: tid, scorerId: r[0]?.playerId || "" }
        : { ...goals[index] },
    );
    setEditGoal(index);
    setPenaltyOpen(false);
    setGoalOpen(true);
  };
  const openPenalty = (tid: string, index: number | null = null) => {
    const r = selectedFor(tid);
    setPenalty(
      index === null
        ? { ...emptyPenalty, teamEntryId: tid, playerId: r[0]?.playerId || "" }
        : { ...penalties[index] },
    );
    setEditPenalty(index);
    setGoalOpen(false);
    setPenaltyOpen(true);
  };
  const syncScoreFromGoals = (nextGoals: any[]) => {
    const counted = nextGoals.filter(
      (x) =>
        !(
          x.situation === "PENALTY_SHOT" &&
          x.penaltyShotOutcome === "miss"
        ),
    );
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
    if (!goal.scorerId) return;
    const x = { ...goal, id: goal.id || `g-${Date.now()}` };
    const nextGoals =
      editGoal === null
        ? [...goals, x]
        : goals.map((v, i) => (i === editGoal ? x : v));
    setGoals(nextGoals);
    syncScoreFromGoals(nextGoals);
    setGoalOpen(false);
    setEditGoal(null);
  };
  const commitPenalty = () => {
    const x = { ...penalty, id: penalty.id || `p-${Date.now()}` };
    setPenalties((a) =>
      editPenalty === null
        ? [...a, x]
        : a.map((v, i) => (i === editPenalty ? x : v)),
    );
    setPenaltyOpen(false);
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
  async function save() {
    if (saving) return;
    setError("");
    setMessage("");
    if (resultType === "TECHNICAL" && !technicalWinnerTeamEntryId) {
      setError("Выберите команду, которой присуждена техническая победа.");
      return;
    }
    setSaving(true);
    const event = (x: any) => {
      const seconds = toSeconds(x.time);
      return { ...x, period: getPeriod(seconds), clockSeconds: seconds };
    };
    try {
      const r = await fetch("/api/admin/match-protocol", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        matchId: match.id,
        expectedUpdatedAt: match.updatedAt,
        rosterEntryIds: selected,
        numberOverrides: numbers,
        status,
        resultType,
        homeScore,
        awayScore,
        periodScores: periods.map((x) => ({
          home: Number(x.home) || 0,
          away: Number(x.away) || 0,
        })),
        protocolData: {
          eventTimesAbsolute: true,
          shots: shots.map((x) => ({
            home: Number(x.home) || 0,
            away: Number(x.away) || 0,
          })),
          goalieStints,
          timeouts,
          playoff,
          technicalWinnerTeamEntryId:
            resultType === "TECHNICAL" ? technicalWinnerTeamEntryId : null,
        },
        shootouts: resultType === "TECHNICAL" ? [] : shootouts,
        resultNote: note,
        goals: resultType === "TECHNICAL" ? [] : goals.map(event),
        penalties: resultType === "TECHNICAL" ? [] : penalties.map(event),
        }),
      });
      if (r.ok) {
        setMessage(
          status === "LIVE"
            ? "Протокол обновлён — счёт и события доступны в лайве"
            : status === "FINAL"
              ? "Матч завершён — таблица и статистика пересчитаны"
              : "Протокол сохранён",
        );
        await load();
      } else
        setError((await r.json()).error || "Не удалось сохранить протокол");
    } catch {
      setError("Нет связи с сервером. Проверьте запуск сайта и повторите сохранение.");
    } finally {
      setSaving(false);
    }
  }
  const teams = [match.homeTeamEntry, match.awayTeamEntry];
  const activeSuspension = (row: any) =>
    row.suspensions?.find((suspension: any) => {
      if (suspension.status !== "ACTIVE") return false;
      const matchTime = new Date(match.startsAt || Date.now()).getTime();
      return matchTime >= new Date(suspension.startsAt).getTime() &&
        (!suspension.endsAt || matchTime <= new Date(suspension.endsAt).getTime());
    });
  return (
    <main className="adminShell adminProtocol">
      <section className="adminContent divisionPage">
        <a className="backButton" href="/admin/matches">
          ← К матчам и календарю
        </a>
        {message && <p className="adminNotice">{message}</p>}
        {error && <p className="formError">{error}</p>}
        <div className="protocolScore">
          <div className="protocolScoreInner">
            <span>
              {match.division.competition.season.name} ·{" "}
              {match.division.competition.name} · {match.division.name}
            </span>
            <div className="protocolScoreBoard">
              <b>{match.homeTeamEntry.team.name}</b>
              <strong>
                {resultType === "TECHNICAL"
                  ? !technicalWinnerTeamEntryId ? "—" : technicalWinnerTeamEntryId === match.homeTeamEntryId ? "+" : "−"
                  : homeScore}
                <i>:</i>
                {resultType === "TECHNICAL"
                  ? !technicalWinnerTeamEntryId ? "—" : technicalWinnerTeamEntryId === match.awayTeamEntryId ? "+" : "−"
                  : awayScore}
              </strong>
              <b>{match.awayTeamEntry.team.name}</b>
            </div>
            <p>
              {match.startsAt
                ? new Date(match.startsAt).toLocaleString("ru-RU")
                : "Дата не указана"}{" "}
              · {match.venue?.name || "Арена не указана"}
            </p>
          </div>
          <em className={status === "LIVE" ? "live" : ""}>
            {status === "LIVE" ? "● ЛАЙВ" : "ПРОТОКОЛ"}
          </em>
        </div>
        <section className="protocolResult">
          <h3>Результат матча</h3>
          <div>
            <label>
              Статус
              <select
                value={status}
                disabled={resultType === "TECHNICAL"}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="SCHEDULED">Запланирован</option>
                <option value="LIVE">Идёт матч</option>
                <option value="FINAL">Завершён</option>
                <option value="POSTPONED">Перенесён</option>
                <option value="CANCELLED">Отменён</option>
              </select>
            </label>
            <label>
              Тип результата
              <select
                value={resultType}
                onChange={(e) => {
                  setResultType(e.target.value);
                  if (e.target.value === "TECHNICAL") {
                    setStatus("FINAL");
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
                onChange={(e) => setTechnicalWinnerTeamEntryId(e.target.value)}
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
            Матч попадёт в таблицу как победа и поражение, но шайбы и личная
            статистика игроков учитываться не будут.
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
        <details className="matchRosterSelect">
          <summary>
            <div>
              <span>СОСТАВ НА МАТЧ</span>
              <h2>Участники игры</h2>
              <p>{selected.length} игроков выбрано</p>
            </div>
            <b>
              ПОКАЗАТЬ / СКРЫТЬ <i>⌄</i>
            </b>
          </summary>
          <div className="matchRosterColumns">
            {teams.map((entry: any) => (
              <section key={entry.id}>
                <h3>{entry.team.name}</h3>
                {rosterFor(entry.id).map((row: any) => {
                  const suspension = activeSuspension(row);
                  return <label key={row.id} className={suspension ? "suspendedMatchPlayer" : ""}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      disabled={Boolean(suspension)}
                      onChange={() =>
                        setSelected((a) =>
                          a.includes(row.id)
                            ? a.filter((x) => x !== row.id)
                            : [...a, row.id],
                        )
                      }
                    />
                    <span>№</span>
                    <input
                      className="matchNumber"
                      disabled={!selected.includes(row.id)}
                      value={numbers[row.id] ?? row.number ?? ""}
                      onChange={(e) =>
                        setNumbers({ ...numbers, [row.id]: e.target.value })
                      }
                    />
                    <b>{row.player.lastName} {row.player.firstName}</b>
                    {suspension && <small>Дисквалификация: {suspension.reason}</small>}
                  </label>;
                })}
              </section>
            ))}
          </div>
        </details>
        <section className="protocolEvents">
          <header>
            <div>
              <span>СОБЫТИЯ</span>
              <h2>Голы и удаления</h2>
              <p>
                Время указывается от начала матча — период определяется
                автоматически.
              </p>
            </div>
          </header>
          {resultType === "TECHNICAL" && (
            <p className="technicalResultNotice">
              Для технического результата события матча не сохраняются. После
              сохранения голы, удаления и буллиты этого протокола будут очищены.
            </p>
          )}
          {goalOpen && (
            <div className="adminForm inlineProtocolForm">
              <h2>
                {editGoal === null ? "Добавить гол" : "Изменить гол"} ·{" "}
                {teamName(goal.teamEntryId)}
              </h2>
              <div>
                <label>
                  Автор
                  <select
                    value={goal.scorerId}
                    onChange={(e) =>
                      setGoal({ ...goal, scorerId: e.target.value })
                    }
                  >
                    <option value="">Выберите игрока</option>
                    {selectedFor(goal.teamEntryId).map((r: any) => (
                      <option key={r.playerId} value={r.playerId}>
                        {r.player.lastName} {r.player.firstName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Время матча
                  <input
                    value={goal.time}
                    onChange={(e) => setGoal({ ...goal, time: e.target.value })}
                    placeholder="34:25"
                  />
                </label>
                <label>
                  Период
                  <input disabled value={`${getPeriod(goal.time)} период`} />
                </label>
                <label>
                  Составы
                  <select
                    value={goal.situation}
                    onChange={(e) => {
                      const situation = e.target.value;
                      setGoal({
                        ...goal,
                        situation,
                        penaltyShotOutcome:
                          situation === "PENALTY_SHOT" ? "goal" : "",
                        assist1Id:
                          situation === "PENALTY_SHOT" ? "" : goal.assist1Id,
                        assist2Id:
                          situation === "PENALTY_SHOT" ? "" : goal.assist2Id,
                      });
                    }}
                  >
                    {situations.map((x) => (
                      <option key={x[0]} value={x[0]}>
                        {x[1]}
                      </option>
                    ))}
                  </select>
                </label>
                {goal.situation === "PENALTY_SHOT" && (
                  <label>
                    Результат броска
                    <select
                      value={goal.penaltyShotOutcome || "goal"}
                      onChange={(e) =>
                        setGoal({
                          ...goal,
                          penaltyShotOutcome: e.target.value,
                        })
                      }
                    >
                      <option value="goal">Реализован — засчитать гол</option>
                      <option value="miss">Не реализован — без гола</option>
                    </select>
                  </label>
                )}
              </div>
              {goal.situation !== "PENALTY_SHOT" && (
                <div>
                  {[1, 2].map((n) => (
                    <label key={n}>
                      Ассистент {n}
                      <select
                        value={goal[`assist${n}Id`]}
                        onChange={(e) =>
                          setGoal({ ...goal, [`assist${n}Id`]: e.target.value })
                        }
                      >
                        <option value="">Не указан</option>
                        {selectedFor(goal.teamEntryId)
                          .filter((r: any) => r.playerId !== goal.scorerId)
                          .map((r: any) => (
                            <option key={r.playerId} value={r.playerId}>
                              {r.player.lastName} {r.player.firstName}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <footer>
                <button onClick={() => setGoalOpen(false)}>Отмена</button>
                <button onClick={commitGoal}>
                  {editGoal === null ? "Добавить" : "Сохранить изменения"}
                </button>
              </footer>
            </div>
          )}
          {penaltyOpen && (
            <div className="adminForm inlineProtocolForm">
              <h2>
                {editPenalty === null
                  ? "Добавить удаление"
                  : "Изменить удаление"}{" "}
                · {teamName(penalty.teamEntryId)}
              </h2>
              <div>
                <label>
                  Игрок
                  <select
                    value={penalty.playerId}
                    onChange={(e) =>
                      setPenalty({ ...penalty, playerId: e.target.value })
                    }
                  >
                    <option value="">Командный штраф</option>
                    {selectedFor(penalty.teamEntryId).map((r: any) => (
                      <option key={r.playerId} value={r.playerId}>
                        {r.player.lastName} {r.player.firstName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Время матча
                  <input
                    value={penalty.time}
                    onChange={(e) =>
                      setPenalty({ ...penalty, time: e.target.value })
                    }
                    placeholder="27:10"
                  />
                </label>
                <label>
                  Период
                  <input disabled value={`${getPeriod(penalty.time)} период`} />
                </label>
                <label>
                  Минуты
                  <input
                    type="number"
                    min="0"
                    value={penalty.minutes}
                    onChange={(e) =>
                      setPenalty({ ...penalty, minutes: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Причина
                <select
                  value={penalty.reasonCode || ""}
                  onChange={(e) => {
                    const x = reasons.find((r) => r[0] === e.target.value);
                    setPenalty({
                      ...penalty,
                      reasonCode: e.target.value,
                      reason: x?.[1] || "",
                    });
                  }}
                >
                  <option value="">Выберите причину</option>
                  {reasons.map((x) => (
                    <option key={x[0]} value={x[0]}>
                      {x[1]} · {x[0]}
                    </option>
                  ))}
                </select>
              </label>
              {penalty.reasonCode === "OTHER" && (
                <label>
                  Уточнение
                  <input
                    value={penalty.reason}
                    onChange={(e) =>
                      setPenalty({ ...penalty, reason: e.target.value })
                    }
                  />
                </label>
              )}
              <footer>
                <button onClick={() => setPenaltyOpen(false)}>Отмена</button>
                <button onClick={commitPenalty}>
                  {editPenalty === null ? "Добавить" : "Сохранить изменения"}
                </button>
              </footer>
            </div>
          )}
          <div className="teamEventColumns">
            {teams.map((entry: any) => (
              <section className="teamEventPanel" key={entry.id}>
                <header>
                  <h3>{entry.team.name}</h3>
                  <div>
                    <button disabled={resultType === "TECHNICAL"} onClick={() => openGoal(entry.id)}>+ ГОЛ</button>
                    <button
                      className="secondary"
                      disabled={resultType === "TECHNICAL"}
                      onClick={() => openPenalty(entry.id)}
                    >
                      + УДАЛЕНИЕ
                    </button>
                  </div>
                </header>
                <div className="teamEventGroup">
                  <h4>Голы и штрафные броски</h4>
                  {goals
                    .filter((x) => x.teamEntryId === entry.id)
                    .map((x) => {
                      const i = goals.indexOf(x);
                      return (
                        <article key={x.id}>
                          <time>
                            {getPeriod(x.time)} ПЕР · {x.time}
                          </time>
                          <p>
                            <b>
                              {playerName(x.teamEntryId, x.scorerId)} ·{" "}
                              {x.situation === "PENALTY_SHOT"
                                ? `ШБ · ${x.penaltyShotOutcome === "miss" ? "не реализован" : "реализован"}`
                                : x.situation || "5X5"}
                            </b>
                            {(x.assist1Id || x.assist2Id) && (
                              <small>
                                Ассисты:{" "}
                                {[x.assist1Id, x.assist2Id]
                                  .filter(Boolean)
                                  .map((id: string) =>
                                    playerName(x.teamEntryId, id),
                                  )
                                  .join(", ")}
                              </small>
                            )}
                          </p>
                          <div>
                            <button onClick={() => openGoal(entry.id, i)}>
                              Изменить
                            </button>
                            <button
                              onClick={() => {
                                const nextGoals = goals.filter(
                                  (_, n) => n !== i,
                                );
                                setGoals(nextGoals);
                                syncScoreFromGoals(nextGoals);
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  {!goals.some((x) => x.teamEntryId === entry.id) && (
                    <p className="emptyEvents">Событий пока нет</p>
                  )}
                </div>
                <div className="teamEventGroup">
                  <h4>Удаления</h4>
                  {penalties
                    .filter((x) => x.teamEntryId === entry.id)
                    .map((x) => {
                      const i = penalties.indexOf(x);
                      return (
                        <article key={x.id}>
                          <time>
                            {getPeriod(x.time)} ПЕР · {x.time}
                          </time>
                          <p>
                            <b>
                              {x.playerId
                                ? playerName(x.teamEntryId, x.playerId)
                                : "Командный штраф"}
                            </b>
                            <small>
                              {x.minutes} мин ·{" "}
                              {x.reason || "Причина не указана"}
                            </small>
                          </p>
                          <div>
                            <button onClick={() => openPenalty(entry.id, i)}>
                              Изменить
                            </button>
                            <button
                              onClick={() =>
                                setPenalties(
                                  penalties.filter((_, n) => n !== i),
                                )
                              }
                            >
                              Удалить
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  {!penalties.some((x) => x.teamEntryId === entry.id) && (
                    <p className="emptyEvents">Удалений пока нет</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
        <div className="protocolExtraGrid">
          <section className="protocolExtra">
            <h3>Время игры вратарей</h3>
            {teams.map((entry: any) => (
              <div className="goalieTeam" key={entry.id}>
                <header>
                  <b>{entry.team.name}</b>
                  <button
                    className="textAdd"
                    onClick={() =>
                      setGoalieStints([
                        ...goalieStints,
                        {
                          id: `s-${Date.now()}`,
                          teamEntryId: entry.id,
                          playerId: selectedFor(entry.id)[0]?.playerId || "",
                          from: "00:00",
                          to: "60:00",
                          shotsAgainst: "",
                        },
                      ])
                    }
                  >
                    + Добавить отрезок
                  </button>
                </header>
                {goalieStints
                  .filter((x) => x.teamEntryId === entry.id)
                  .map((x) => {
                    const i = goalieStints.indexOf(x);
                    return (
                      <div className="goalieStint" key={x.id}>
                        <select
                          value={x.playerId}
                          onChange={(e) =>
                            setGoalieStints(
                              goalieStints.map((v, n) =>
                                n === i
                                  ? { ...v, playerId: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        >
                          <option value="">Выберите игрока</option>
                          {selectedFor(entry.id).map((r: any) => (
                            <option key={r.playerId} value={r.playerId}>
                              {r.player.lastName} {r.player.firstName}
                            </option>
                          ))}
                        </select>
                        <input
                          value={x.from}
                          onChange={(e) =>
                            setGoalieStints(
                              goalieStints.map((v, n) =>
                                n === i ? { ...v, from: e.target.value } : v,
                              ),
                            )
                          }
                          placeholder="С 00:00"
                        />
                        <input
                          value={x.to}
                          onChange={(e) =>
                            setGoalieStints(
                              goalieStints.map((v, n) =>
                                n === i ? { ...v, to: e.target.value } : v,
                              ),
                            )
                          }
                          placeholder="До 60:00"
                        />
                        <input
                          type="number"
                          min="0"
                          value={x.shotsAgainst ?? ""}
                          onChange={(e) =>
                            setGoalieStints(
                              goalieStints.map((v, n) =>
                                n === i
                                  ? { ...v, shotsAgainst: e.target.value }
                                  : v,
                              ),
                            )
                          }
                          placeholder="Броски"
                          title="Броски в створ по воротам за этот отрезок"
                        />
                        <button
                          onClick={() =>
                            setGoalieStints(
                              goalieStints.filter((_, n) => n !== i),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
              </div>
            ))}
            <h3 className="shotsTitle">Броски в створ</h3>
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
                    value={t?.time || "00:00"}
                    onChange={(e) =>
                      setTimeoutFor(entry.id, true, e.target.value)
                    }
                    placeholder="Время матча"
                  />
                </div>
              );
            })}
            <h3 className="shotsTitle">Примечание</h3>
            <label>
              Текстовый блок
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
        </div>
        {match.isPlayoff && Number(homeScore) === Number(awayScore) && (
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
        )}
        <aside className="situationHelp">
          <b>Памятка по игровым ситуациям</b>
          <p>
            <strong>5×5</strong> — равные составы; <strong>5×4 / 5×3</strong> —
            большинство; <strong>4×5 / 3×5</strong> — меньшинство;{" "}
            <strong>ПВ</strong> — пустые ворота; <strong>ШБ</strong> — штрафной
            бросок. Послематчевые буллиты заносятся отдельно.
          </p>
        </aside>
        <div className="protocolSave">
          <span>
            {status === "LIVE"
              ? "После сохранения изменения сразу появятся на публичных страницах."
              : "Все данные протокола сохраняются одной операцией."}
          </span>
          <button onClick={save} disabled={saving}>
            {saving
              ? "СОХРАНЯЕМ…"
              : status === "LIVE"
                ? "ОБНОВИТЬ ЛАЙВ"
                : "СОХРАНИТЬ ПРОТОКОЛ"}
          </button>
        </div>
      </section>
    </main>
  );
}
