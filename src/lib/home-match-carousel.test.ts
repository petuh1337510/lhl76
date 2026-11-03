import { describe, expect, it } from "vitest";
import { homeMatchDateRange, nearestHomeMatchIndex, visibleHomeMatches } from "./home-match-carousel";

describe("home match carousel", () => {
  it("includes the seven Moscow calendar days on either side of today", () => {
    const range = homeMatchDateRange(new Date("2026-11-03T20:30:00Z"));
    expect(range.from.toISOString()).toBe("2026-10-26T21:00:00.000Z");
    expect(range.until.toISOString()).toBe("2026-11-10T21:00:00.000Z");
  });

  it("starts at the closest match and rotates in both directions", () => {
    const matches = [
      { startsAt: "2026-11-01T12:00:00Z" },
      { startsAt: "2026-11-03T12:00:00Z" },
      { startsAt: "2026-11-05T12:00:00Z" },
      { startsAt: "2026-11-07T12:00:00Z" },
      { startsAt: "2026-11-09T12:00:00Z" },
    ];
    const nearest = nearestHomeMatchIndex(matches, Date.parse("2026-11-03T13:00:00Z"));
    expect(nearest).toBe(1);
    expect(visibleHomeMatches(matches, nearest).map((match) => match.startsAt)).toEqual(
      matches.slice(1).map((match) => match.startsAt),
    );
    expect(visibleHomeMatches(matches, nearest - 1)[0]).toBe(matches[0]);
    expect(visibleHomeMatches(matches, matches.length)[0]).toBe(matches[0]);
    expect(visibleHomeMatches(matches, -1)[0]).toBe(matches.at(-1));
  });
});
