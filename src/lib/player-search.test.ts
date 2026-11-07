import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schedulePlayerSearch, SEARCH_DEBOUNCE_MS } from "./player-search";

describe("player autocomplete", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const results = vi.fn();
  const error = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    results.mockReset();
    error.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("sends only the completed word after a pause", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [{ id: "player" }] }));
    let cancel = () => {};
    for (const query of ["И", "Ив", "Ива", "Иван", "Ивано", "Иванов"]) {
      cancel();
      cancel = schedulePlayerSearch(query, results, error);
      await vi.advanceTimersByTimeAsync(30);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 31);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/players?search=${encodeURIComponent("Иванов")}&page=1`);
    expect(results).toHaveBeenCalledWith([{ id: "player" }]);
    cancel();
  });

  it.each(["", "  ", " И "])("does not request a short query: %s", async (query) => {
    schedulePlayerSearch(query, results, error)();
    await vi.runAllTimersAsync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels a pending search when the modal closes", async () => {
    const cancel = schedulePlayerSearch("Иванов", results, error);
    cancel();
    await vi.runAllTimersAsync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts a running request without displaying an error", async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const cancel = schedulePlayerSearch("Иванов", results, error);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    cancel();
    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(results).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("ignores an obsolete response even if its body finishes after the new result", async () => {
    let resolveOld!: (value: unknown) => void;
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { resolveOld = resolve; }) } as Response);
    const cancelOld = schedulePlayerSearch("Иван", results, error);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    cancelOld();
    fetchMock.mockResolvedValueOnce(Response.json({ items: [{ id: "new" }] }));
    const cancelNew = schedulePlayerSearch("Иванов", results, error);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    resolveOld({ items: [{ id: "old" }] });
    await vi.runAllTimersAsync();
    expect(results.mock.calls).toEqual([[[{ id: "new" }]]]);
    expect(error).not.toHaveBeenCalled();
    cancelNew();
  });

  it.each(["http", "network"])("reports a %s failure", async (kind) => {
    if (kind === "http") fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    else fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const cancel = schedulePlayerSearch("Иванов", results, error);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(error).toHaveBeenCalledTimes(1);
    expect(results).not.toHaveBeenCalled();
    cancel();
  });
});
