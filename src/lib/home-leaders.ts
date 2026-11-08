import type { DivisionPlayerStatistic } from "./division-page";

export const homeLeaderCategories = [
  { title: "Бомбардиры", label: "Очки", metric: "points", goalie: false },
  { title: "Снайперы", label: "Шайбы", metric: "goals", goalie: false },
  { title: "Ассистенты", label: "Голевые передачи", metric: "assists", goalie: false },
  { title: "Вратари (КН)", label: "Коэффициент надёжности", metric: "goalsAgainstAverage", goalie: true },
  { title: "Вратари (%ОБ)", label: "Отражённые броски", metric: "savePercentage", goalie: true },
] as const;

export function homeLeaderRows(players: DivisionPlayerStatistic[], category: typeof homeLeaderCategories[number]) {
  return players.filter(player => !category.goalie || (player.isGoalkeeper && player[category.metric] !== null))
    .sort((a, b) => category.metric === "goalsAgainstAverage" ? Number(a[category.metric]) - Number(b[category.metric]) : Number(b[category.metric]) - Number(a[category.metric])).slice(0, 5);
}

/** Preserve original tie ordering; retain everyone displayed by any category. */
export function compactHomeLeaders(players: DivisionPlayerStatistic[]) {
  const keys = new Set(homeLeaderCategories.flatMap(category => homeLeaderRows(players, category).map(player => player.key)));
  return players.filter(player => keys.has(player.key));
}
