/** Presentation only: retain stored order and scores, never calculate results. */
export function formatPeriodScores(value: unknown): string | null {
  if (value == null) return null;
  const format = (item: unknown): string => {
    if (item && typeof item === "object" && "home" in item && "away" in item)
      return `${item.home ?? "—"}:${item.away ?? "—"}`;
    return typeof item === "string" || typeof item === "number" ? String(item) : "";
  };
  const items = Array.isArray(value) ? value : typeof value === "object" ? Object.values(value) : [value];
  return items.map(format).filter(Boolean).join(" · ") || null;
}
