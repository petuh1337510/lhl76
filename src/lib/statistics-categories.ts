import type { DivisionPlayerStatistic } from "./division-page";

export const statisticsCategories = [
  { id: "scorers", title: "Бомбардиры", metric: "points", unit: "Очки", group: "skaters" },
  { id: "snipers", title: "Снайперы", metric: "goals", unit: "Шайбы", group: "skaters" },
  { id: "assists", title: "Ассистенты", metric: "assists", unit: "Передачи", group: "skaters" },
  { id: "goalie-average", title: "Вратари · коэффициент надёжности", metric: "goalsAgainstAverage", unit: "КН", group: "goalkeepers" },
  { id: "goalie-saves", title: "Вратари · отражённые броски", metric: "savePercentage", unit: "%ОБ", group: "goalkeepers" },
  { id: "goalie-shutouts", title: "Вратари · сухие матчи", metric: "shutouts", unit: "Игры", group: "goalkeepers" },
  { id: "defender-points", title: "Защитники · бомбардиры", metric: "points", unit: "Очки", group: "defenders" },
  { id: "defender-goals", title: "Защитники · снайперы", metric: "goals", unit: "Шайбы", group: "defenders" },
  { id: "defender-assists", title: "Защитники · ассистенты", metric: "assists", unit: "Передачи", group: "defenders" },
] as const;
export type StatisticsCategory = typeof statisticsCategories[number];
export function isDefender(position: string) {
  return position.trim().toLocaleLowerCase("ru") === "защитник";
}
export function categoryPlayers(players: DivisionPlayerStatistic[], category: StatisticsCategory) {
  if (category.metric === "shutouts") return [];
  const metric = category.metric;
  return players.filter(player => {
    if (category.group === "goalkeepers") return player.isGoalkeeper && player[metric] !== null;
    return !player.isGoalkeeper && (category.group !== "defenders" || isDefender(player.position));
  }).sort((a, b) => (metric === "goalsAgainstAverage" ? Number(a[metric]) - Number(b[metric]) : Number(b[metric]) - Number(a[metric])) || a.name.localeCompare(b.name, "ru"));
}
