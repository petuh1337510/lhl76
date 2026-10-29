import { describe, expect, it } from "vitest";
import { isMatchSuspensionBlocking, isSuspensionActiveAt, parseSuspensionStartDate, suspensionRemaining } from "./suspensions";

describe("isSuspensionActiveAt", () => {
  const suspension = {
    status: "ACTIVE",
    startsAt: "2026-10-20T00:00:00+03:00",
    endsAt: "2026-10-30T23:59:59+03:00",
  };

  it("blocks a player during the suspension window", () => {
    expect(isSuspensionActiveAt(suspension, "2026-10-25T19:00:00+03:00")).toBe(true);
  });

  it("does not block before, after, or when cancelled", () => {
    expect(isSuspensionActiveAt(suspension, "2026-10-19T19:00:00+03:00")).toBe(false);
    expect(isSuspensionActiveAt(suspension, "2026-10-31T19:00:00+03:00")).toBe(false);
    expect(isSuspensionActiveAt({ ...suspension, status: "CANCELLED" }, "2026-10-25T19:00:00+03:00")).toBe(false);
  });
});

describe("match-count suspension", () => {
  const suspension = { status: "ACTIVE", startsAt: "2026-10-20T18:00:00+03:00", matchesCount: 5, endsAt: null };
  it("blocks globally until five source-team matches are final", () => {
    expect(isMatchSuspensionBlocking(suspension, "2026-10-22T19:00:00+03:00", 0)).toBe(true);
    expect(suspensionRemaining(5, 4)).toBe(1);
    expect(isMatchSuspensionBlocking(suspension, "2026-11-22T19:00:00+03:00", 4)).toBe(true);
    expect(isMatchSuspensionBlocking(suspension, "2026-11-22T19:00:00+03:00", 5)).toBe(false);
  });
  it("does not block before issue or after cancellation", () => {
    expect(isMatchSuspensionBlocking(suspension, "2026-10-19T19:00:00+03:00", 0)).toBe(false);
    expect(isMatchSuspensionBlocking({ ...suspension, status: "CANCELLED" }, "2026-10-22T19:00:00+03:00", 0)).toBe(false);
  });
});

describe("chosen suspension start date", () => {
  it("keeps a selected past date at midnight in Moscow", () => {
    expect(parseSuspensionStartDate("2026-10-15")?.toISOString()).toBe("2026-10-14T21:00:00.000Z");
  });
  it("rejects an impossible date", () => {
    expect(parseSuspensionStartDate("2026-02-30")).toBeNull();
  });
});
