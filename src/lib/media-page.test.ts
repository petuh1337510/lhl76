import { describe, expect, it } from "vitest";
import { mediaPage } from "./media-page";

const items = Array.from({length: 55}, (_, index) => ({key: String(index).padStart(3, "0"), title: `Файл ${index}`, url: `/uploads/${index}`, type: "image", kind: "players", date: "2026-11-01T00:00:00Z", datePrecision: "month" as const, size: 1048576, usedBy: [{label: index === 54 ? "Вымпел" : "Игрок", href: "/team"}]}));
describe("media catalogue pagination", () => {
  it("bounds each response, has no overlaps and signals the last page", () => {
    const pages = [1, 2, 3].map(page => mediaPage(items, new URLSearchParams({page: String(page)})));
    expect(pages.map(page => page.items.length)).toEqual([24, 24, 7]);
    expect(pages.map(page => page.hasMore)).toEqual([true, true, false]);
    expect(new Set(pages.flatMap(page => page.items.map(item => item.key))).size).toBe(55);
  });
  it("filters the complete catalogue, not just the first page", () => {
    const result = mediaPage(items, new URLSearchParams({name: "вЫмПеЛ", dateFrom: "2026-11-20", minSize: "1", maxSize: "1"}));
    expect(result.items.map(item => item.key)).toEqual(["054"]);
    expect(result.catalogueTotal).toBe(55);
    expect(result.total).toBe(1);
  });
  it("rejects fractional, infinite and negative page numbers", () => {
    for (const page of ["NaN", "Infinity", "-2", "1.5"]) expect(mediaPage(items, new URLSearchParams({page})).page).toBe(1);
  });
  it("keeps usedBy deletion protection intact", () => {
    expect(mediaPage(items, new URLSearchParams()).items[0].usedBy).toEqual(items[0].usedBy);
  });
});
