/** Mean completed years on a calendar date; unknown or invalid birthdays are excluded. */
export function averageAge(birthdays: string[], today: string): number | null {
  const [year, month, day] = today.split("-").map(Number);
  const ages = birthdays.flatMap(value => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!match) return [];
    const [, d, m, y] = match.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return [];
    const age = year - y - (month < m || (month === m && day < d) ? 1 : 0);
    return age < 0 ? [] : [age];
  });
  return ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
}
