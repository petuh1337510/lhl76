import { expect, it } from "vitest";
import { averageAge } from "./average-age";
it("counts completed ages including birthday boundary", () => {
  expect(averageAge(["28.10.2000", "29.10.2000"], "2026-10-28")).toBe(25.5);
});
it("excludes absent, invalid and future dates", () => {
  expect(averageAge(["—", "31.02.2000", "01.01.2030", "01.01.2000"], "2026-10-28")).toBe(26);
  expect(averageAge([], "2026-10-28")).toBeNull();
});
