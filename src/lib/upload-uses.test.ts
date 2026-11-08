import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const models = ["team", "player", "venue", "news", "document", "mediaAlbum", "broadcast", "homepageContent", "leaguePage", "leaguePerson", "laureate"];
  return { prisma: Object.fromEntries(models.map(name => [name, { findMany: vi.fn() }])), families: vi.fn(), remove: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
vi.mock("@/lib/legacy-card-media", () => ({ readLegacyCardMedia: async () => [] }));
vi.mock("@/lib/upload-files", async importOriginal => ({
  ...await importOriginal<typeof import("./upload-files")>(),
  readUploadFamilies: mocks.families,
  removeUploadFamily: mocks.remove,
}));

import { findUploadUses } from "./upload-uses";
import { GET, DELETE } from "@/app/api/admin/media-files/route";

const id = "79a8d346-12b7-4aab-b6ff-18d4fdce0a5c";
const key = `media/${id}`;
const url = `/uploads/media/${id}.png`;
const use = { label: "Главная: Баннер", href: "/admin/homepage-content" };

function homepage(style: string | null, imageDesktop: string | null = null) {
  // Honour the projection so forgetting to select style reproduces the bug.
  mocks.prisma.homepageContent.findMany.mockImplementation(({ select }) => {
    const row = { title: "Баннер", imageDesktop, imageMobile: null, link: null, style };
    return Promise.resolve([Object.fromEntries(Object.entries(row).filter(([field]) => select[field]))]);
  });
}

beforeEach(() => {
  for (const model of Object.values(mocks.prisma)) model.findMany.mockReset().mockResolvedValue([]);
  mocks.families.mockReset().mockResolvedValue([{ key, title: `${id}.png`, url, date: "2026-11-01T00:00:00Z", size: 100, type: "image", kind: "media" }]);
  mocks.remove.mockReset();
});

describe("media references in homepage settings", () => {
  it("protects a logo referenced only by JSON settings in both listing and deletion guard", async () => {
    homepage(JSON.stringify({ variant: "league", logoUrl: url }));
    const listing = await (await GET(new NextRequest("https://lhl-76.ru/api/admin/media-files"))).json();
    expect(listing.items[0].usedBy).toEqual([use]);
    const response = await DELETE(new NextRequest(`https://lhl-76.ru/api/admin/media-files?key=${key}`, { method: "DELETE" }));
    expect(response.status).toBe(409);
    expect((await response.json()).usedBy).toEqual([use]);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.prisma.homepageContent.findMany).toHaveBeenCalledWith({ select: expect.objectContaining({ style: true }) });
  });

  it("recognises escaped JSON paths and deduplicates variants of one file", async () => {
    const settings = JSON.stringify({ nested: [{ logoUrl: url }, { thumbnail: `/uploads/media/${id}-thumb.webp` }] }).replaceAll("/", "\\/");
    homepage(settings, `/uploads/media/${id}-display.webp`);
    expect((await findUploadUses()).get(key)).toEqual([use]);
  });

  it("retains references from plain text and malformed legacy settings", async () => {
    homepage(`{broken settings: ${url}`);
    expect((await findUploadUses()).get(key)).toEqual([use]);
  });

  it("does not invent references for empty or plain colour settings", async () => {
    for (const style of [null, "", "navy", "{broken}"]) {
      homepage(style);
      expect((await findUploadUses()).size).toBe(0);
    }
  });

  it("keeps uses from other materials and does not filter out unpublished homepage records", async () => {
    homepage(JSON.stringify({ logoUrl: url }));
    mocks.prisma.news.findMany.mockResolvedValue([{ title: "Новость", gallery: [{ src: url }] }]);
    expect((await findUploadUses()).get(key)).toEqual([{ label: "Новость «Новость»", href: "/admin/news" }, use]);
    expect(mocks.prisma.homepageContent.findMany.mock.calls[0][0]).not.toHaveProperty("where");
  });
});
