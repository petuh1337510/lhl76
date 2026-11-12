import type { ReactNode } from "react";
import { formatPenaltyMinutes } from "@/lib/domain/penalty-minutes";
import { PublicImage } from "@/components/public-image";
import { UiIcon } from "@/components/ui-icon";
import styles from "./match-events.module.css";

export const eventFilters = [
  ["all", "Все события"],
  ["goals", "Взятия ворот"],
  ["penalties", "Штрафы"],
  ["goalies", "Вратари и тайм-ауты"],
  ["shootouts", "Послематчевые броски"],
] as const;
export type EventFilter = typeof eventFilters[number][0];
type EventTeam = { id: string; team: { name: string; logoUrl?: string | null } };
type Goal = { id: string; teamEntryId: string; time: string; scorerId: string; assist1Id?: string; assist2Id?: string; situation: string; penaltyShotOutcome?: string };
type Penalty = { id: string; teamEntryId: string; time: string; playerId?: string; minutes: number | string; reason?: string; reasonCode?: string };

const iconPaths: Record<EventFilter | "player" | "delete", ReactNode> = {
  all: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
  goals: <><ellipse cx="12" cy="8" rx="8" ry="4" /><path d="M4 8v7c0 2.2 3.6 4 8 4s8-1.8 8-4V8" /></>,
  penalties: <><rect x="4" y="5" width="6" height="14" rx="1.5" /><rect x="14" y="5" width="6" height="14" rx="1.5" /></>,
  goalies: <><path d="M4 19v-6l3-6h10l3 6v6H4Z" /><path d="M9 12h6m-7 4h8m-6-4v4m4-4v4" /></>,
  shootouts: <><path d="m19 3-5 12a4 4 0 0 1-4 3H6a2 2 0 1 1 0-4h3l4-9" /><path d="M5 21h6" /></>,
  player: <><circle cx="12" cy="8" r="3" /><path d="M5 20v-1a7 7 0 0 1 14 0v1" /></>,
  delete: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></>,
};

function EventIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

export function EventTeamIdentity({ team }: { team: EventTeam["team"] }) {
  return <span className={styles.identity}>
    {team.logoUrl && <PublicImage src={team.logoUrl} alt="" width={44} height={44} sizes="44px" />}
    <strong>{team.name}</strong>
  </span>;
}

export function EventFilters({ current, counts, onChange }: {
  current: EventFilter;
  counts: Record<EventFilter, number>;
  onChange: (filter: EventFilter) => void;
}) {
  return <div className={styles.filters} role="group" aria-label="Тип события">
    {eventFilters.map(([id, label]) => <button key={id} type="button" aria-pressed={id === current} onClick={() => onChange(id)}>
      <EventIcon name={id} /><span>{label}</span><span className={styles.count}>{counts[id]}</span>
    </button>)}
  </div>;
}

export function isScoringGoal(goal: Goal) {
  return goal.situation !== "PENALTY_SHOT" || goal.penaltyShotOutcome !== "miss";
}

function goalLabel(goal: Goal) {
  if (goal.situation === "PENALTY_SHOT") return isScoringGoal(goal) ? "ШБ · гол" : "ШБ · нереализованный";
  if (goal.situation === "EMPTY_NET") return "Пустые ворота";
  return (goal.situation || "5X5").replace(/X/g, "×");
}

function goalCountLabel(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} гол`;
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return `${count} гола`;
  return `${count} голов`;
}

function RowActions({ label, onEdit, onDelete, disabled }: { label: string; onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return <span className={styles.actions}>
    <button type="button" disabled={disabled} aria-label={`Изменить ${label}`} title={`Изменить ${label}`} onClick={onEdit}><UiIcon name="edit" /></button>
    <button type="button" disabled={disabled} className={styles.delete} aria-label={`Удалить ${label}`} title={`Удалить ${label}`} onClick={onDelete}><EventIcon name="delete" /></button>
  </span>;
}

export function MatchEventTables({ teams, filter, goals, penalties, disabled, player, onGoal, onPenalty, onDeleteGoal, onDeletePenalty }: {
  teams: EventTeam[];
  filter: "all" | "goals" | "penalties";
  goals: Goal[];
  penalties: Penalty[];
  disabled: boolean;
  player: (teamId: string, playerId: string) => { name: string; number: string };
  onGoal: (teamId: string, index?: number) => void;
  onPenalty: (teamId: string, index?: number) => void;
  onDeleteGoal: (index: number) => void;
  onDeletePenalty: (index: number) => void;
}) {
  const showGoals = filter !== "penalties";
  const showPenalties = filter !== "goals";
  const byTime = (a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time, "ru", { numeric: true });
  const playerBadge = (teamId: string, playerId?: string) => {
    if (!playerId) return <span className={styles.emptyValue}>—</span>;
    const { name, number } = player(teamId, playerId);
    return <span className={styles.player} title={number ? `№ ${number} · ${name}` : name} aria-label={number ? `№ ${number}, ${name}` : name}>
      <EventIcon name="player" />{number || name}
    </span>;
  };
  return <div className={styles.columns}>
    {teams.map(({ id, team }) => {
      const teamGoals = goals.filter(goal => goal.teamEntryId === id).sort(byTime);
      const teamPenalties = penalties.filter(penalty => penalty.teamEntryId === id).sort(byTime);
      const scored = teamGoals.filter(isScoringGoal).length;
      return <section className={styles.team} key={id} aria-label={`События: ${team.name}`}>
        <header>
          <div><EventTeamIdentity team={team} /><p>
            {showGoals && goalCountLabel(scored)}{showGoals && showPenalties && " · "}
            {showPenalties && `Штрафы: ${teamPenalties.length}`}
          </p></div>
          <div className={styles.addButtons}>
            {showGoals && <button type="button" disabled={disabled} title="Добавить гол или штрафной бросок" aria-label={`Добавить гол: ${team.name}`} onClick={() => onGoal(id)}>
              <UiIcon name="plus" />{showPenalties && "Гол"}
            </button>}
            {showPenalties && <button type="button" disabled={disabled} title="Добавить штраф" aria-label={`Добавить штраф: ${team.name}`} onClick={() => onPenalty(id)}>
              <UiIcon name="plus" />{showGoals && "Штраф"}
            </button>}
          </div>
        </header>
        {showGoals && <div className={styles.tableWrap} role="region" aria-label={`Взятия ворот: ${team.name}`} tabIndex={0}>
          {showPenalties && <h3>Взятия ворот</h3>}
          <table className={styles.table}>
            <thead><tr><th scope="col">Время</th><th scope="col"><abbr title="Автор гола">Г</abbr></th><th scope="col"><abbr title="Первый ассистент">А</abbr></th><th scope="col"><abbr title="Второй ассистент">А</abbr></th><th scope="col">Ситуация</th><th scope="col" aria-label="Действия" /></tr></thead>
            <tbody>{teamGoals.length ? teamGoals.map(goal => <tr key={goal.id}>
              <td><time>{goal.time}</time></td>
              <td>{playerBadge(id, goal.scorerId)}</td><td>{playerBadge(id, goal.assist1Id)}</td><td>{playerBadge(id, goal.assist2Id)}</td>
              <td>{goalLabel(goal)}</td>
              <td><RowActions label={`${goal.situation === "PENALTY_SHOT" ? "штрафной бросок" : "гол"} на ${goal.time}`} disabled={disabled} onEdit={() => onGoal(id, goals.indexOf(goal))} onDelete={() => onDeleteGoal(goals.indexOf(goal))} /></td>
            </tr>) : <tr><td colSpan={6} className={styles.empty}>Голов и штрафных бросков пока нет.</td></tr>}</tbody>
          </table>
        </div>}
        {showPenalties && <div className={styles.tableWrap} role="region" aria-label={`Штрафы: ${team.name}`} tabIndex={0}>
          {showGoals && <h3>Штрафы</h3>}
          <table className={styles.table}>
            <thead><tr><th scope="col">Время</th><th scope="col">Игрок</th><th scope="col">Мин</th><th scope="col">Причина</th><th scope="col" aria-label="Действия" /></tr></thead>
            <tbody>{teamPenalties.length ? teamPenalties.map(penalty => <tr key={penalty.id}>
              <td><time>{penalty.time}</time></td><td>{penalty.playerId ? playerBadge(id, penalty.playerId) : "Командный"}</td>
              <td>{formatPenaltyMinutes(penalty.minutes)}</td><td>{penalty.reason || penalty.reasonCode || "—"}</td>
              <td><RowActions label={`штраф на ${penalty.time}`} disabled={disabled} onEdit={() => onPenalty(id, penalties.indexOf(penalty))} onDelete={() => onDeletePenalty(penalties.indexOf(penalty))} /></td>
            </tr>) : <tr><td colSpan={5} className={styles.empty}>Штрафов пока нет.</td></tr>}</tbody>
          </table>
        </div>}
      </section>;
    })}
  </div>;
}
