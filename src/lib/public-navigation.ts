export function choice<T extends string>(value: string | null, fallback: T, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
export function pageNumber(value: string | null, maximum: number): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, Math.max(1, maximum)) : 1;
}
/** Return links may only lead to known public routes on this site. */
export function safeReturn(value: string | null): string | null {
  if (!value || value.length > 2000 || /[\\\u0000-\u001f]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://local.invalid");
  if (!/^\/(?:team|competition|news|match|players|media)(?:\/|\?|$)/.test(url.pathname)) return null;
  return url.origin === "https://local.invalid" ? url.pathname + url.search + url.hash : null;
}
export function withReturn(target: string, from: string): string {
  const url = new URL(target, "https://local.invalid");
  const previous = new URL(from, "https://local.invalid");
  previous.searchParams.delete("from");
  url.searchParams.set("from", previous.pathname + previous.search);
  return url.pathname + url.search;
}
