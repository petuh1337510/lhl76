// Zero minutes is reserved for a penalty-shot award, not a timed penalty.
// This keeps the event in the protocol without adding penalty statistics.
export function parsePenaltyMinutes(value: unknown): number | null {
  if (typeof value === "string" && value.trim().toLocaleUpperCase("ru") === "ШБ") return 0;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 2147483647 ? minutes : null;
}

export function formatPenaltyMinutes(value: number | string): string {
  return parsePenaltyMinutes(value) === 0 ? "ШБ" : String(value);
}
