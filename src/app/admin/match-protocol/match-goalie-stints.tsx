import { automaticGoalieShots } from "@/lib/domain/match-goalies";
import type { RosterPlayer } from "./match-roster";
import styles from "./match-events.module.css";

export type GoalieStint = {
  id?: string;
  teamEntryId: string;
  playerId: string;
  from: string;
  to: string;
  shotsAgainst?: string | number | null;
};

export function toSeconds(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? Math.max(0, minutes * 60 + seconds) : 0;
}

export function formatMatchTime(value: string) {
  const withColon = value.match(/^(\d{0,3}):(\d{0,2})$/);
  if (withColon) return `${withColon[1]}:${withColon[2]}`;
  const digits = value.replace(/\D/g, "").slice(0, 5);
  if (digits.length <= 2) return digits;
  const minuteLength = digits.length === 5 ? 3 : 2;
  return `${digits.slice(0, minuteLength)}:${digits.slice(minuteLength)}`;
}

export function validMatchTime(value: string) {
  const match = typeof value === "string" && value.match(/^\d{1,3}:(\d{2})$/);
  return Boolean(match && Number(match[1]) < 60);
}

export function completeGoalieStint(stint: GoalieStint) {
  return Boolean(stint.playerId) && validMatchTime(stint.from) && validMatchTime(stint.to) &&
    toSeconds(stint.to) > toSeconds(stint.from);
}

type Props = {
  teamId: string;
  teamName: string;
  players: RosterPlayer[];
  stints: GoalieStint[];
  shots: unknown;
  teamIds: readonly [string, string];
  disabled?: boolean;
  onChange: (stints: GoalieStint[]) => void;
};

export function MatchGoalieStints({ teamId, teamName, players, stints, shots, teamIds, disabled, onChange }: Props) {
  const automaticShots = automaticGoalieShots(stints, shots, ...teamIds);
  const update = (index: number, change: Partial<GoalieStint>) =>
    onChange(stints.map((stint, position) => position === index ? { ...stint, ...change } : stint));
  const preferredGoalie = players.find(row => row.player.position?.trim().toLocaleLowerCase("ru") === "вратарь");
  return <div className="goalieTeam">
    <header>
      <b>{teamName}</b>
      <button type="button" className="textAdd" disabled={disabled} onClick={() => onChange([...stints, {
        id: `s-${crypto.randomUUID()}`, teamEntryId: teamId, playerId: preferredGoalie?.playerId || "",
        from: "00:00", to: "60:00", shotsAgainst: "",
      }])}>+ Добавить отрезок</button>
    </header>
    {stints.map((stint, index) => {
      const playerId = players.some(row => row.playerId === stint.playerId) ? stint.playerId : "";
      const calculatedShots = automaticShots.get(stint);
      return <div className={`goalieStint ${styles.goalieStint}`} key={stint.id || index}>
        <select aria-label={`Вратарь команды ${teamName}`} value={playerId} disabled={disabled}
          onChange={event => update(index, { playerId: event.target.value })}>
          <option value="">Выберите игрока</option>
          {players.map(row => <option key={row.playerId} value={row.playerId}>{row.player.lastName} {row.player.firstName}</option>)}
        </select>
        <input aria-label="Начало отрезка" inputMode="numeric" value={stint.from ?? ""} disabled={disabled}
          onFocus={event => event.currentTarget.select()}
          onChange={event => update(index, { from: formatMatchTime(event.target.value) })} placeholder="С 00:00" />
        <input aria-label="Конец отрезка" inputMode="numeric" value={stint.to ?? ""} disabled={disabled}
          onFocus={event => event.currentTarget.select()}
          onChange={event => update(index, { to: formatMatchTime(event.target.value) })} placeholder="До 60:00" />
        <input aria-label={calculatedShots === undefined ? "Броски по воротам" : "Броски по воротам, автоматически"}
          type="number" min="0" value={calculatedShots ?? stint.shotsAgainst ?? ""} disabled={disabled}
          readOnly={calculatedShots !== undefined} data-automatic={calculatedShots !== undefined}
          onChange={event => update(index, { shotsAgainst: event.target.value })} placeholder="Броски"
          title={calculatedShots === undefined ? "Броски в створ по воротам за этот отрезок" : "Сумма бросков соперника за три периода"} />
        <button type="button" aria-label="Удалить отрезок вратаря" disabled={disabled}
          onClick={() => onChange(stints.filter((_, position) => position !== index))}>×</button>
      </div>;
    })}
  </div>;
}
