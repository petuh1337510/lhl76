const DAY_MS = 24 * 60 * 60 * 1000;

export function homeMatchDateRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const midnight = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+03:00`).getTime();

  return {
    from: new Date(midnight - 7 * DAY_MS),
    until: new Date(midnight + 8 * DAY_MS),
  };
}

export function nearestHomeMatchIndex(matches: Array<{ startsAt: string | null }>, now: number) {
  let nearest = 0;
  let distance = Infinity;
  for (let index = 0; index < matches.length; index++) {
    const startsAt = Date.parse(matches[index].startsAt ?? "");
    if (!Number.isFinite(startsAt)) continue;
    const nextDistance = Math.abs(startsAt - now);
    if (nextDistance < distance || (nextDistance === distance && startsAt >= now)) {
      nearest = index;
      distance = nextDistance;
    }
  }
  return nearest;
}

export function visibleHomeMatches<T>(matches: T[], start: number, count = 4): T[] {
  if (!matches.length) return [];
  return Array.from({ length: Math.min(count, matches.length) }, (_, index) =>
    matches[((start + index) % matches.length + matches.length) % matches.length],
  );
}
