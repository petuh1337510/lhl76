export const BROADCAST_WINDOW_MS = 90 * 60 * 1000;
export type BroadcastStatus = "upcoming" | "live" | "archive";
export const broadcastStatusLabel = { upcoming: "Скоро", live: "● LIVE", archive: "Запись" };
type DateValue = Date | string | null | undefined;
function date(value: DateValue) {
  const result = value ? new Date(value) : null;
  return result && Number.isFinite(result.getTime()) ? result : null;
}

export function broadcastTiming(input: {
  startsAt?: DateValue; endsAt?: DateValue;
  match?: { startsAt: DateValue; status: string } | null;
}, now = Date.now()) {
  const startsAt = date(input.match ? input.match.startsAt : input.startsAt);
  const overrideEnd = date(input.endsAt);
  const endsAt = startsAt ? new Date(Math.min(startsAt.getTime() + BROADCAST_WINDOW_MS,
    overrideEnd && overrideEnd > startsAt ? overrideEnd.getTime() : Infinity)) : null;
  let status: BroadcastStatus = "archive";
  if (input.match?.status === "POSTPONED") status = "upcoming";
  else if (!["FINAL", "CANCELLED"].includes(input.match?.status ?? "") && startsAt && endsAt) {
    if (now < startsAt.getTime()) status = "upcoming";
    else if (now < endsAt.getTime()) status = "live";
  }
  return { startsAt, endsAt, status, isLive: status === "live" };
}

export function vkVideoKey(url: string) {
  try {
    const parsed = new URL(url);
    if (!["vk.com", "www.vk.com", "vk.ru", "www.vk.ru", "vkvideo.ru", "www.vkvideo.ru"].includes(parsed.hostname)) return null;
    return parsed.pathname.match(/^\/(?:live|video)(-?\d+_\d+)$/)?.[1] ?? null;
  } catch { return null; }
}

export function moscowDateInput(value: DateValue) {
  const parsed = date(value);
  return parsed ? new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 16) : "";
}

export function parseMoscowInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+03:00`);
  return Number.isFinite(parsed.getTime()) && moscowDateInput(parsed) === value ? parsed : null;
}
