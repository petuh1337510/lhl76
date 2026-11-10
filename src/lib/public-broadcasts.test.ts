import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ findMany: vi.fn(), matches: vi.fn(), reset: () => {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { broadcast: { findMany: m.findMany }, match: { findMany: m.matches } } }));
// Next Data Cache serializes results as JSON; a warm hit does not preserve Date.
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => {
  let json: string | undefined;
  m.reset = () => { json = undefined; };
  return async (...args: unknown[]) => {
    if (json !== undefined) return JSON.parse(json);
    const result = await fn(...args); json = JSON.stringify(result); return result;
  };
} }));
import { getPublicBroadcasts } from "./public-broadcasts";
beforeEach(() => { m.reset(); m.matches.mockResolvedValue([]); m.findMany.mockReset().mockResolvedValue([]); vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only"); vi.stubEnv("VK_VIDEO_OWNER_ID", "-123"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("public broadcasts used by the homepage", () => {
  it("continues beyond a short VK page and does not repeat overlapping videos", async () => {
    const fetcher = vi.fn().mockImplementation(async (_url, options) => {
      const offset = Number(options.body.get("offset"));
      return { ok: true, json: async () => ({ response: { count: 250, items: [
        { id: 1, owner_id: -123, title: "Repeated", date: 1000 },
        { id: offset + 2, owner_id: -123, title: "Page " + offset, date: 2000 + offset },
      ] } }) };
    });
    vi.stubGlobal("fetch", fetcher);
    expect((await getPublicBroadcasts()).map(item => item.title)).toEqual(["Page 200", "Page 100", "Page 0", "Repeated"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("keeps an unpublished VK override hidden instead of reintroducing its automatic copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { items: [
      { id: 3, owner_id: -123, title: "Hidden", live: 1, date: 2000 },
    ] } }) }));
    m.findMany.mockResolvedValue([{ id: "saved", title: "Hidden", videoUrl: "https://vkvideo.ru/live-123_3", isPublished: false }]);
    expect(await getPublicBroadcasts()).toEqual([]);
  });
  it("uses the match schedule and completion, not stale VK live flags or upload dates", async () => {
    const start = new Date(Date.now() - 60000);
    const day = new Date(start.getTime() + 3 * 3600000).toISOString().slice(0, 10).split("-").reverse().join(".");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { items: [
      { id: 4, owner_id: -123, title: `ТАНКИ - БАРС | ${day}`, live: 1, date: 1000 },
    ] } }) }));
    const match = { id: "match", startsAt: start, status: "SCHEDULED", homeTeamEntry: { team: { name: "Танки" } }, awayTeamEntry: { team: { name: "Барс" } }, division: { name: "Старт", competition: { name: "Чемпионат", season: { name: "2026/27" } } } };
    m.matches.mockResolvedValue([match]);
    expect((await getPublicBroadcasts())[0]).toMatchObject({ isLive: true, startsAt: start });
    m.matches.mockResolvedValue([{ ...match, status: "FINAL" }]);
    expect((await getPublicBroadcasts())[0].status).toBe("archive");
    m.matches.mockResolvedValue([match, { ...match, id: "ambiguous-other-competition" }]);
    expect((await getPublicBroadcasts())[0].isLive).toBe(false);
  });
  it("renders both the first request and repeated requests with warm VK cache", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { items: [
      { id: 1, owner_id: -123, title: "Old match", date: 1000 },
      { id: 2, owner_id: -123, title: "New match", date: 2000 },
    ] } }) });
    vi.stubGlobal("fetch", fetcher);
    for (let request = 0; request < 3; request++) {
      const result = await getPublicBroadcasts(4);
      expect(result.map(item => item.title)).toEqual(["New match", "Old match"]);
      expect(result[0].publishedAt).toBeInstanceOf(Date);
      expect(result[0].isLive).toBe(false);
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps published manual broadcasts when VK is temporarily unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    m.findMany.mockResolvedValue([{ id: "local", slug: "local", title: "Manual", description: null, videoUrl: "https://vkvideo.ru/video-123_3", imageUrl: null, startsAt: new Date(3000), isLive: false, isPublished: true }]);
    expect((await getPublicBroadcasts())[0].title).toBe("Manual");
  });
});
