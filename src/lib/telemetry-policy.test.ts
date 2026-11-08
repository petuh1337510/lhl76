import { expect, it } from "vitest";
import { parseVital, telemetryRoute } from "./telemetry-policy";
it("removes search strings, player slugs and unknown path data", () => {
  expect(telemetryRoute("/player/ivanov?secret=abc")).toBe("/player/[slug]");
  expect(telemetryRoute("/admin/team?slug=private")).toBe("/admin/team");
  expect(telemetryRoute("/unknown/email@example.com")).toBe("/other");
});
it("accepts only bounded numeric vitals and strips arbitrary payload fields", () => {
  expect(parseVital({metric:"INP", value:120.12345, route:"/team/private", email:"secret", message:"secret"})).toEqual({kind:"vital", metric:"INP", value:120.123, route:"/team/[slug]"});
  for (const value of [-1, Infinity, NaN, "1", 999999]) expect(parseVital({metric:"LCP", value, route:"/"})).toBeNull();
  expect(parseVital({metric:"SECRET", value:1, route:"/"})).toBeNull();
});
it("counts errors without saving messages or stack traces", () => {
  expect(parseVital({metric:"ERROR", route:"/", message:"token=private", stack:"private"})).toEqual({kind:"vital", metric:"ERROR", value:1, route:"/"});
});
