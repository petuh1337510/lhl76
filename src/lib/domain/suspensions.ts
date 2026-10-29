export type SuspensionWindow = {
  status: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
};

export function parseSuspensionStartDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;
  const localDate = new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return localDate === value ? date : null;
}

export function isSuspensionActiveAt(
  suspension: SuspensionWindow,
  moment: Date | string,
) {
  if (suspension.status !== "ACTIVE") return false;
  const time = new Date(moment).getTime();
  const startsAt = new Date(suspension.startsAt).getTime();
  const endsAt = suspension.endsAt
    ? new Date(suspension.endsAt).getTime()
    : Number.POSITIVE_INFINITY;
  return Number.isFinite(time) && time >= startsAt && time <= endsAt;
}

export function suspensionRemaining(matchesCount: number, completedSourceMatches: number) {
  return Math.max(0, matchesCount - completedSourceMatches);
}

export function isMatchSuspensionBlocking(
  suspension: SuspensionWindow & { matchesCount?: number | null },
  moment: Date | string,
  completedSourceMatches: number,
) {
  if (suspension.status !== "ACTIVE") return false;
  if (new Date(moment).getTime() < new Date(suspension.startsAt).getTime()) return false;
  if (suspension.matchesCount) return suspensionRemaining(suspension.matchesCount, completedSourceMatches) > 0;
  return isSuspensionActiveAt(suspension, moment);
}
