// Verified against joomsport_season titles in lhlnew (3).sql (2023/24–2026/27).
// User-approved aliases: «Плюс», «Любитель+» and «Любитель +» → «Любитель Плюс».
// Selecting a name never moves existing teams.
export const historicalDivisionNames = [
  'Дебют', 'Старт', 'Любитель', 'Любитель Плюс', 'Любитель Спорт',
];
export function canonicalDivisionName(name: string) {
  const value = name.trim().replace(/\s+/g, ' ');
  return /^(плюс|любитель\s*\+|любитель плюс)$/i.test(value) ? 'Любитель Плюс' : value;
}
