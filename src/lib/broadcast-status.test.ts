import { describe, expect, it } from "vitest";
import { broadcastTiming, BROADCAST_WINDOW_MS, parseMoscowInput, moscowDateInput, vkVideoKey } from "./broadcast-status";
const start = new Date("2026-11-10T17:00:00Z");
describe("broadcast schedule", () => {
  it("changes exactly at kickoff and at the 90-minute boundary", () => {
    expect(broadcastTiming({ startsAt: start }, +start - 1).status).toBe("upcoming");
    expect(broadcastTiming({ startsAt: start }, +start).status).toBe("live");
    expect(broadcastTiming({ startsAt: start }, +start + BROADCAST_WINDOW_MS - 1).status).toBe("live");
    expect(broadcastTiming({ startsAt: start }, +start + BROADCAST_WINDOW_MS).status).toBe("archive");
  });
  it("uses the linked match schedule, final status and earlier end", () => {
    expect(broadcastTiming({ startsAt: new Date(0), match: { startsAt: start, status: "SCHEDULED" } }, +start).status).toBe("live");
    expect(broadcastTiming({ match: { startsAt: start, status: "FINAL" } }, +start).status).toBe("archive");
    expect(broadcastTiming({ startsAt: start, endsAt: new Date(+start + 60000) }, +start + 60000).status).toBe("archive");
    expect(broadcastTiming({ startsAt: start, endsAt: new Date(+start + 86400000) }, +start + BROADCAST_WINDOW_MS).status).toBe("archive");
  });
  it("never invents LIVE for missing time, cancelled or postponed games", () => {
    expect(broadcastTiming({}).isLive).toBe(false);
    expect(broadcastTiming({ startsAt: "invalid" }).isLive).toBe(false);
    for (const status of ["CANCELLED", "POSTPONED"]) expect(broadcastTiming({ match: { startsAt: start, status } }, +start).isLive).toBe(false);
  });
  it("interprets editor values as Moscow time independently of the host timezone", () => {
    expect(parseMoscowInput("2026-11-10T20:00")).toEqual(start);
    expect(moscowDateInput(start)).toBe("2026-11-10T20:00");
    expect(parseMoscowInput("2026-02-30T20:00")).toBeNull();
  });
  it("preserves signed VK owners and rejects lookalike hosts", () => {
    expect(vkVideoKey("https://vkvideo.ru/live-123_42")).toBe("-123_42");
    expect(vkVideoKey("https://vk.com/video123_42")).toBe("123_42");
    expect(vkVideoKey("https://example.com/video-123_42")).toBeNull();
  });
});
