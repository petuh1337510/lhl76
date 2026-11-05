import { describe, it, expect } from "vitest";
import { choice, pageNumber, safeReturn, withPublicQuery, withReturn } from "./public-navigation";
describe("public navigation", () => {
  it("validates tabs and restores valid state", () => {
    expect(choice("calendar", "table", ["table", "calendar"])).toBe("calendar");
    expect(choice("invalid", "table", ["table", "calendar"])).toBe("table");
  });
  it("bounds pagination", () => {
    for (const value of [null, "-1", "NaN", "1.5", "Infinity"]) expect(pageNumber(value, 3)).toBe(1);
    expect(pageNumber("99", 3)).toBe(3);
  });
  it("rejects external and private return targets", () => {
    for (const value of ["//evil.test", "https://evil.test", "/admin", "/team\\evil", "/api/admin/players", "/team/../admin", "/team/%2e%2e/admin"]) expect(safeReturn(value)).toBeNull();
    expect(safeReturn("/team/test?tab=roster")).toBe("/team/test?tab=roster");
  });
  it("preserves filters without nesting return links", () => {
    const result = new URL(withReturn("/player/test", "/team/a?tab=roster&from=%2Fnews"), "https://local.invalid");
    expect(result.searchParams.get("from")).toBe("/team/a?tab=roster");
  });
  it("makes a tab link usable before hydration without dropping the selected competition", () => {
    expect(withPublicQuery("/team/volki?competition=abc&tab=about#roster", "tab", "roster"))
      .toBe("/team/volki?competition=abc&tab=roster#roster");
  });
});
