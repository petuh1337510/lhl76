import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ catalogue: vi.fn(), create: vi.fn(), update: vi.fn(), duplicate: vi.fn(), match: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
vi.mock("@/lib/public-broadcasts", () => ({ getBroadcastCatalogue: m.catalogue }));
vi.mock("@/lib/prisma", () => ({ prisma: { broadcast: { create: m.create, update: m.update, findFirst: m.duplicate }, match: { findUnique: m.match } } }));
vi.mock("next/cache", () => ({ revalidateTag: m.invalidate }));
vi.mock("@/lib/video-preview", () => ({ resolveVideoPreview: async () => null }));
import { PATCH, POST } from "./route";
const request = (body: object) => new NextRequest("http://localhost/api/admin/broadcasts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); m.catalogue.mockResolvedValue({ items: [{ id: "vk--123_42", slug: "vk--123_42", title: "VK game", videoUrl: "https://vkvideo.ru/video-123_42", saved: false, isPublished: true }] }); m.create.mockResolvedValue({ id: "saved" }); });
describe("broadcast editing", () => {
  it("persists hiding an automatic VK video so it cannot reappear as an automatic entry", async () => {
    expect((await PATCH(request({ id: "vk--123_42", isPublished: false }))).status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ slug: "vk--123_42", isPublished: false, isLive: false });
  });
  it("rejects a manual LIVE override and unsafe URLs", async () => {
    for (const data of [{ title: "Test", videoUrl: "javascript:alert(1)" }, { id: "vk--123_42", isLive: true }]) expect((await POST(request(data))).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("stores Moscow timestamps and validates linked match/end time", async () => {
    const base = { title: "Match", videoUrl: "https://vkvideo.ru/video-123_43", startsAt: "2026-11-10T20:00", endsAt: "2026-11-10T21:15" };
    expect((await POST(request(base))).status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ startsAt: new Date("2026-11-10T17:00Z"), endsAt: new Date("2026-11-10T18:15Z") });
    expect((await POST(request({ ...base, endsAt: "2026-11-10T19:00" }))).status).toBe(400);
    expect((await POST(request({ ...base, matchId: "missing" }))).status).toBe(400);
  });
  it("invalidates only the VK video cache on explicit refresh", async () => {
    expect((await POST(request({ action: "refresh" }))).status).toBe(200);
    expect(m.invalidate).toHaveBeenCalledWith("vk-broadcasts");
    expect(m.create).not.toHaveBeenCalled();
  });
});
