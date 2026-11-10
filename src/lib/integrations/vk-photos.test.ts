import { afterEach, describe, expect, it, vi } from "vitest";

import { loadVkCommunityAlbums, loadVkPhotoAlbum, parseVkAlbumSlug, parseVkAlbumUrl, vkAlbumSlug } from "./vk-photos";

describe("VK photo albums", () => {
  it("accepts only VK album links", () => {
    expect(parseVkAlbumUrl("https://vk.com/album-170455976_310217710"))
      .toEqual({ ownerId: -170455976, albumId: 310217710 });
    expect(parseVkAlbumUrl("https://vk.ru/album-170455976_313395065"))
      .toEqual({ ownerId: -170455976, albumId: 313395065 });
    expect(parseVkAlbumUrl("https://example.com/album-170455976_310217710")).toBeNull();
    expect(parseVkAlbumUrl("https://vk.com/id1")).toBeNull();
  });

  it("round-trips a community album slug", () => {
    expect(parseVkAlbumSlug(vkAlbumSlug(-170455976, 310217710)))
      .toEqual({ ownerId: -170455976, albumId: 310217710 });
    expect(parseVkAlbumSlug("match-photos")).toBeNull();
  });
});

const apiResponse = (response: unknown) => ({ ok: true, json: async () => ({ response }) });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("VK API snapshots", () => {
  it("resolves the configured community and retrieves all catalogue pages", async () => {
    vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only");
    const fetcher = vi.fn().mockResolvedValueOnce(apiResponse({ type: "group", object_id: 123 }))
      .mockResolvedValueOnce(apiResponse({ count: 101, items: Array.from({ length: 100 }, (_, id) => ({ id: id + 1, title: String(id), created: id })) }))
      .mockResolvedValueOnce(apiResponse({ count: 101, items: [{ id: 101, title: "Newest", created: 1000 }] }));
    vi.stubGlobal("fetch", fetcher);
    const result = await loadVkCommunityAlbums();
    expect(result.ownerId).toBe(-123); expect(result.albums).toHaveLength(101); expect(result.albums[0].id).toBe(101);
    expect(fetcher.mock.calls[2][1].body.get("offset")).toBe("100");
  });
  it("continues when VK count describes the returned page rather than the whole catalogue", async () => {
    vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only");
    const fetcher = vi.fn().mockResolvedValueOnce(apiResponse({ type: "group", object_id: 123 }))
      .mockResolvedValueOnce(apiResponse({ count: 100, items: Array.from({ length: 100 }, (_, id) => ({ id: id + 1, title: String(id) })) }))
      .mockResolvedValueOnce(apiResponse({ count: 1, items: [{ id: 101, title: "Older" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await loadVkCommunityAlbums()).albums).toHaveLength(101);
  });
  it("does not treat an incomplete catalogue as deletions", async () => {
    vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse({ type: "group", object_id: 123 })).mockResolvedValueOnce(apiResponse({ count: 10, items: [] })));
    await expect(loadVkCommunityAlbums()).rejects.toThrow("неполный");
  });
  it("distinguishes an unavailable album from a temporary error", async () => {
    vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only");
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ error: { error_code: 200 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: { error_code: 6 } }) });
    vi.stubGlobal("fetch", fetcher);
    expect(await loadVkPhotoAlbum(-123, 456)).toBeNull();
    await expect(loadVkPhotoAlbum(-123, 456)).rejects.toThrow("ошибка 6");
  });
});
