import { afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ broadcasts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/public-site-context", () => ({ getPublicSiteContext: async () => ({ divisions: [{ id: "division", name: "Старт" }] }) }));
vi.mock("@/lib/home-division-summary", () => ({ getHomeDivisionSummary: async () => ({ teams: [], leaders: [] }) }));
vi.mock("@/lib/home-editorial", () => ({ getHomeEditorial: async () => ({ news: [], homepageContent: [], laureates: [] }) }));
vi.mock("@/lib/public-broadcasts", () => ({ getPublicBroadcasts: m.broadcasts }));
import { getHomeSummary } from "./public-home-summary";
afterEach(() => vi.useRealTimers());
describe("initial homepage latency", () => {
  it("returns page content without waiting for a slow VK catalogue", async () => {
    vi.useFakeTimers();
    m.broadcasts.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 10000)));
    let result: unknown;
    const pending = getHomeSummary(false, { includeBroadcasts: false }).then(value => { result = value; });
    await vi.advanceTimersByTimeAsync(100);
    expect(result).toMatchObject({ broadcasts: [], broadcastsDeferred: true, news: [], divisions: [{ name: "Старт" }] });
    await pending;
    expect(m.broadcasts).not.toHaveBeenCalled();
  });
});
