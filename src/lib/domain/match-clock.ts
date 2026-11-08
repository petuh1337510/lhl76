export const matchClockVersion = 2;

export function parseMatchClock(value: unknown) {
  const match = typeof value === "string" && /^(\d{1,3}):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

type LegacyClock = { teamEntryId: string | null; playerId: string | null; eventType: string; minute: string | null };

export function matchClockResolver(protocol: unknown, legacyEvents: LegacyClock[]) {
  const current = protocol && typeof protocol === "object" && "eventClockVersion" in protocol && protocol.eventClockVersion === matchClockVersion;
  return (seconds: number | null, teamEntryId: string, playerId: string | null, eventType: "Гол" | "Штраф") => {
    if (current || seconds === null) return seconds;
    const originalTimes = legacyEvents
      .filter(event => event.eventType === eventType && event.teamEntryId === teamEntryId && event.playerId === playerId)
      .map(event => parseMatchClock(event.minute)).filter(time => time !== null);
    if (originalTimes.includes(seconds)) return seconds;
    // The old editor added the period offset to an already absolute import time.
    const matches = new Set(originalTimes.filter(time => time + Math.floor(time / 1200) * 1200 === seconds));
    return matches.size === 1 ? [...matches][0] : seconds;
  };
}
