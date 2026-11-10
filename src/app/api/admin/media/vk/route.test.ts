import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ list: vi.fn(), album: vi.fn(), saved: vi.fn(), upsert: vi.fn(), update: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
vi.mock("next/cache", () => ({ revalidateTag: m.invalidate }));
vi.mock("@/lib/prisma", () => ({ prisma: { mediaAlbum: { findMany: m.saved, upsert: m.upsert, updateMany: m.update } } }));
vi.mock("@/lib/integrations/vk-photos", () => ({ getCachedVkCommunityAlbums: m.list, loadVkPhotoAlbum: m.album, vkAlbumSlug: (owner: number, id: number) => `vk-photo-${Math.abs(owner)}-${id}`, parseVkAlbumSlug: (slug: string) => /^vk-photo-123-456$/.test(slug) ? { ownerId: -123, albumId: 456 } : null }));
import { GET, POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/admin/media/vk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("VK_API_ACCESS_TOKEN", "test-only"); m.saved.mockResolvedValue([]); m.list.mockResolvedValue({ ownerId: -123, albums: [{ id: 456, title: "Альбом" }] }); m.album.mockResolvedValue({ title: "Альбом", description: null, photos: [], coverUrl: null, eventDate: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("VK album selection", () => {
  it("keeps newly discovered albums unpublished", async () => { const response = await GET(new NextRequest("http://localhost/api/admin/media/vk")); expect((await response.json()).items[0].isPublished).toBe(false); expect(m.upsert).not.toHaveBeenCalled(); });
  it("publishes only an album belonging to the selected community", async () => { const rejected = await POST(request({ albumId: 789, isPublished: true })); expect(rejected.status).toBe(404); expect(m.upsert).not.toHaveBeenCalled(); const accepted = await POST(request({ albumId: 456, isPublished: true })); expect(accepted.status).toBe(200); expect(m.upsert.mock.calls[0][0].create).toMatchObject({ slug: "vk-photo-123-456", isPublished: true }); });
  it("does not modify publication on failed import", async () => { m.album.mockRejectedValue(new Error("timeout")); expect((await POST(request({ albumId: 456, isPublished: true }))).status).toBe(502); expect(m.upsert).not.toHaveBeenCalled(); });
  it("can unpublish without a working token or API", async () => { vi.stubEnv("VK_API_ACCESS_TOKEN", ""); expect((await POST(request({ slug: "vk-photo-123-456", albumId: 456, isPublished: false }))).status).toBe(200); expect(m.update).toHaveBeenCalledWith({ where: { slug: "vk-photo-123-456" }, data: { isPublished: false } }); expect(m.list).not.toHaveBeenCalled(); });
  it("retains selected albums as unknown when VK fails", async () => { m.list.mockRejectedValue(new Error("timeout")); m.saved.mockResolvedValue([{ slug: "vk-photo-123-456", title: "Сохранённый", photos: [], isPublished: true }]); const response = await GET(new NextRequest("http://localhost/api/admin/media/vk")); expect(response.status).toBe(502); expect((await response.json()).items[0]).toMatchObject({ available: null, isPublished: true }); });
});
