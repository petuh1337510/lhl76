"use client";

import { useMemo, useState } from "react";
import { PublicImage } from "@/components/public-image";
import { UiIcon } from "@/components/ui-icon";
import { AdminModal } from "../admin-modal";
import styles from "./match-protocol.module.css";

type RosterPlayer = {
  id: string;
  playerId: string;
  number: string | null;
  leadership: string;
  player: { firstName: string; lastName: string; patronymic: string | null; position: string | null; baseNumber: string | null; photoUrl: string | null };
};
type RosterTeam = { id: string; team: { name: string }; roster: RosterPlayer[] };
type RosterProps = { entry: RosterTeam; selected: string[]; numbers: Record<string, string> };

function nameOf(row: RosterPlayer) {
  return [row.player.lastName, row.player.firstName, row.player.patronymic].filter(Boolean).join(" ");
}

function numberOf(row: RosterPlayer, numbers: Record<string, string>) {
  return numbers[row.id] || row.number || row.player.baseNumber || "";
}

function positionOf(row: RosterPlayer) {
  const position = row.player.position?.trim().toLocaleLowerCase("ru");
  if (position === "вратарь") return { rank: 0, short: "В" };
  if (position === "защитник") return { rank: 1, short: "З" };
  if (position === "нападающий") return { rank: 2, short: "Н" };
  return { rank: 3, short: "—" };
}

function useRosterRows(entry: RosterTeam, numbers: Record<string, string>, query: string) {
  const sorted = useMemo(() => [...entry.roster].sort((a, b) =>
    positionOf(a).rank - positionOf(b).rank || nameOf(a).localeCompare(nameOf(b), "ru")), [entry.roster]);
  const normalize = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const search = normalize(query).trim().replace(/^№\s*/, "").split(/\s+/).filter(Boolean);
  return sorted.filter(row => {
    const name = normalize(nameOf(row));
    return search.every(word => /^\d+$/.test(word) ? numberOf(row, numbers) === word : name.includes(word));
  });
}

function RosterSearch({ team, query, onChange }: { team: string; query: string; onChange: (value: string) => void }) {
  return <label className={styles.rosterSearch}>
    <UiIcon name="search" />
    <input type="search" value={query} onChange={event => onChange(event.target.value)}
      placeholder="ФИО или номер" aria-label={`Поиск по составу: ${team}`} />
  </label>;
}

function PlayerIdentity({ row }: { row: RosterPlayer }) {
  return <span className={styles.rosterPerson}>
    <PublicImage src={row.player.photoUrl || "/images/player-placeholder.svg"} alt="" width={40} height={40} sizes="40px" />
    <span><strong>{nameOf(row)}</strong><small>{row.player.position || "Амплуа не указано"}</small></span>
  </span>;
}

function PlayerPosition({ row }: { row: RosterPlayer }) {
  const { short } = positionOf(row);
  return <span className={short === "—" ? undefined : styles.positionBadge} title={row.player.position || undefined}>{short}</span>;
}

function PlayerLeadership({ row }: { row: RosterPlayer }) {
  return row.leadership === "CAPTAIN" ? <abbr title="Капитан">К</abbr>
    : row.leadership === "ASSISTANT" ? <abbr title="Ассистент капитана">А</abbr> : "—";
}

function EmptyRoster({ hasPlayers }: { hasPlayers: boolean }) {
  return <p className={styles.rosterEmpty}>{hasPlayers ? "По запросу игроки не найдены." : "В заявке команды пока нет игроков."}</p>;
}

export function MatchRosterCard({ entry, selected, numbers, onEdit }: RosterProps & { onEdit: () => void }) {
  const [query, setQuery] = useState("");
  const rows = useRosterRows(entry, numbers, query);
  const chosen = new Set(selected);
  return <section className={styles.rosterCard} aria-label={`Состав команды «${entry.team.name}»`}>
    <header className={styles.rosterHead}>
      <div><h2>{entry.team.name}</h2><p>В составе: {entry.roster.filter(row => chosen.has(row.id)).length}</p></div>
      <button type="button" onClick={onEdit} aria-label={`Редактировать состав: ${entry.team.name}`}><UiIcon name="edit" /> Редактировать</button>
    </header>
    <RosterSearch team={entry.team.name} query={query} onChange={setQuery} />
    {rows.length ? <div className={styles.rosterTableWrap} tabIndex={0} role="region" aria-label={`Игроки: ${entry.team.name}`}>
      <table className={styles.rosterTable}>
        <thead><tr><th scope="col">№</th><th scope="col">Фото и ФИО</th><th scope="col">Амплуа</th><th scope="col">К/А</th><th scope="col">Фактически<br />играл</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{numberOf(row, numbers) || "—"}</td>
          <td><PlayerIdentity row={row} /></td>
          <td><PlayerPosition row={row} /></td>
          <td><PlayerLeadership row={row} /></td>
          <td><span className={styles.participation} data-checked={chosen.has(row.id)} role="img" aria-label={chosen.has(row.id) ? "Участвовал" : "Не участвовал"}>{chosen.has(row.id) ? "✓" : ""}</span></td>
        </tr>)}</tbody>
      </table>
    </div> : <EmptyRoster hasPlayers={Boolean(entry.roster.length)} />}
  </section>;
}

export function MatchRosterEditor({ entry, selected, numbers, activeSuspension, lockedPlayers, saving, error, onClose, onSave }: RosterProps & {
  activeSuspension: (row: RosterPlayer) => { reason?: string } | undefined;
  lockedPlayers: ReadonlySet<string>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (selected: string[], numbers: Record<string, string>) => void;
}) {
  const [chosen, setChosen] = useState(() => new Set(selected));
  const [draftNumbers, setDraftNumbers] = useState<Record<string, string>>(() =>
    Object.fromEntries(entry.roster.filter(row => numbers[row.id] !== undefined).map(row => [row.id, numbers[row.id]])));
  const [query, setQuery] = useState("");
  const rows = useRosterRows(entry, draftNumbers, query);
  function submit() {
    onSave([...chosen], Object.fromEntries([...chosen].filter(id => draftNumbers[id] !== undefined).map(id => [id, draftNumbers[id]])));
  }
  return <AdminModal title={`Состав на матч — ${entry.team.name}`} onClose={() => { if (!saving) onClose(); }} wide>
    <section className={styles.rosterEditor}>
      <header><h2>{entry.team.name}</h2><p>Редактирование состава · выбрано {chosen.size} из {entry.roster.length}</p></header>
      <RosterSearch team={entry.team.name} query={query} onChange={setQuery} />
      {error && <p className="formError" role="alert">{error}</p>}
      {rows.length ? <div className={`${styles.rosterTableWrap} ${styles.editorList}`}>
        <table className={`${styles.rosterTable} ${styles.editorTable}`}>
          <thead><tr><th scope="col">№</th><th scope="col">Фото и ФИО</th><th scope="col">Амплуа</th><th scope="col">К/А</th></tr></thead>
          <tbody>{rows.map(row => {
            const checked = chosen.has(row.id);
            const suspension = activeSuspension(row);
            const locked = checked && lockedPlayers.has(row.playerId);
            const playerName = nameOf(row);
            return <tr key={row.id} data-selected={checked}>
              <td>{checked ? <input className={styles.jerseyInput} type="text" inputMode="numeric" maxLength={3}
                aria-label={`Номер на матч: ${playerName}`} disabled={saving}
                value={draftNumbers[row.id] ?? numberOf(row, numbers)}
                onChange={event => { const number = event.currentTarget.value.replace(/\D/g, "").slice(0, 3); setDraftNumbers(current => ({ ...current, [row.id]: number })); }} />
                : numberOf(row, draftNumbers) || "—"}</td>
              <td>
                <label className={styles.editorPlayer}>
                  <input type="checkbox" checked={checked} aria-label={`Участвует: ${playerName}`} disabled={saving || locked || (Boolean(suspension) && !checked)}
                    onChange={() => setChosen(current => { const next = new Set(current); if (checked) next.delete(row.id); else next.add(row.id); return next; })} />
                  <PlayerIdentity row={row} />
                </label>
                {locked && <small className={styles.rowNote}>Игрок указан в событиях. Удалите связанные записи, чтобы снять отметку.</small>}
                {suspension && <small className={styles.rowNote}>Дисквалификация{suspension.reason ? `: ${suspension.reason}` : ""}</small>}
              </td>
              <td><PlayerPosition row={row} /></td>
              <td><PlayerLeadership row={row} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyRoster hasPlayers={Boolean(entry.roster.length)} />}
      <footer className={styles.editorActions}>
        <button type="button" onClick={onClose} disabled={saving}>Отмена</button>
        <button type="button" onClick={submit} disabled={saving}>{saving ? "Сохраняем…" : "Сохранить состав"}</button>
      </footer>
    </section>
  </AdminModal>;
}
