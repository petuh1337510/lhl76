import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), current: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: { news: { create: m.create, update: m.update, findUnique: m.current } } }));
vi.mock("@/lib/home-editorial", () => ({ invalidateHomeEditorial: vi.fn() }));
vi.mock("@/lib/vk-news-video", () => ({ getVkNewsPreview: m.preview }));
import { POST, PATCH } from "./route";
const clip = "https://vk.ru/clip-170455976_456240126";
const request = (body: object) => new NextRequest("http://localhost/api/admin/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); m.create.mockImplementation(async ({ data }) => ({ id: "test", ...data })); m.update.mockImplementation(async ({ data }) => ({ id: "test", ...data })); m.preview.mockResolvedValue({ thumbnail: "https://sun9.userapi.com/cover.jpg" }); m.current.mockResolvedValue({ id: "test", videoUrl: clip, imageUrl: "/uploads/custom.jpg", isPublished: false }); });
it("saves a clip with text, gallery and automatic cover", async () => {
  const response = await POST(request({ title: "Clip", excerpt: "News", body: "Full text", videoUrl: clip, gallery: ["/uploads/photo.jpg"] }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ videoUrl: clip, body: "Full text", gallery: ["/uploads/photo.jpg"], imageUrl: "https://sun9.userapi.com/cover.jpg", isPublished: false });
});
it("preserves the manual cover and supports publication without changing media", async () => {
  await PATCH(request({ id: "test", isPublished: true }));
  expect(m.preview).not.toHaveBeenCalled();
  expect(m.update.mock.calls[0][0].data).toMatchObject({ isPublished: true });
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("videoUrl");
  await PATCH(request({ id: "test", videoUrl: clip, imageUrl: "/uploads/replacement.jpg", body: "Changed", gallery: [] }));
  expect(m.update.mock.calls[1][0].data).toMatchObject({ imageUrl: "/uploads/replacement.jpg", body: "Changed", gallery: [] });
});
it("keeps news saveable if VK is unavailable, and rejects unsafe video URLs", async () => {
  m.preview.mockResolvedValue(null);
  expect((await POST(request({ title: "Clip", excerpt: "News", videoUrl: clip }))).status).toBe(201);
  expect(m.create.mock.calls[0][0].data.imageUrl).toBeNull();
  expect((await POST(request({ title: "Bad", excerpt: "Bad", videoUrl: "javascript:alert(1)" }))).status).toBe(400);
});
