import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), catalogue: vi.fn(), album: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { mediaAlbum: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));
vi.mock("@/lib/integrations/vk-photos", () => ({ getCachedVkCommunityAlbums: mocks.catalogue, getCachedVkPhotoAlbum: mocks.album, parseVkAlbumSlug: (slug: string) => slug.startsWith("vk-photo-") ? { ownerId: -123, albumId: 456 } : null }));
import { getPublicMediaAlbum, getPublicMediaAlbums } from "./public-media";
const saved = { id: "a", slug: "vk-photo-123-456", title: "Старое", photos: ["https://old.example/a.jpg"], description: "Старое описание", coverUrl: "old", eventDate: new Date(), isPublished: true };
const fresh = { title: "Новое", description: null, photos: [], coverUrl: null, eventDate: new Date() };
beforeEach(() => { vi.resetAllMocks(); mocks.findMany.mockResolvedValue([saved]); mocks.findUnique.mockResolvedValue(saved); mocks.catalogue.mockResolvedValue({ ownerId: -123, albums: [{ id: 456 }] }); mocks.album.mockResolvedValue(fresh); });
describe("public VK gallery", () => {
  it("restores dates serialized by the Next cache", async () => { mocks.album.mockResolvedValue({ ...fresh, eventDate: "2026-11-10T00:00:00.000Z" }); const result = await getPublicMediaAlbums(); expect(result[0].eventDate).toBeInstanceOf(Date); });
  it("accepts empty albums and cleared metadata without reviving deleted photos", async () => { expect(await getPublicMediaAlbum(saved.slug)).toMatchObject({ photos: [], description: null, coverUrl: null, title: "Новое" }); });
  it("hides missing albums but preserves their publication choice for recovery", async () => { mocks.catalogue.mockResolvedValueOnce({ ownerId: -123, albums: [] }); expect(await getPublicMediaAlbums()).toEqual([]); expect(saved.isPublished).toBe(true); expect(await getPublicMediaAlbums()).toHaveLength(1); });
  it("keeps last known information during temporary API failures", async () => { mocks.catalogue.mockRejectedValue(new Error("timeout")); mocks.album.mockRejectedValue(new Error("rate limit")); expect(await getPublicMediaAlbum(saved.slug)).toMatchObject({ title: saved.title, photos: saved.photos, vkError: true }); });
  it("hides explicitly inaccessible albums", async () => { mocks.album.mockResolvedValue(null); expect(await getPublicMediaAlbum(saved.slug)).toBeNull(); });
  it("does not load all albums to view one", async () => { await getPublicMediaAlbum(saved.slug); expect(mocks.findMany).not.toHaveBeenCalled(); expect(mocks.album).toHaveBeenCalledTimes(1); });
  it("does not expose unpublished albums", async () => { mocks.findUnique.mockResolvedValue({ ...saved, isPublished: false }); expect(await getPublicMediaAlbum(saved.slug)).toBeNull(); expect(mocks.album).not.toHaveBeenCalled(); });
});
