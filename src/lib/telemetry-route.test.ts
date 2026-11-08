import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({limit: vi.fn(), write: vi.fn()}));
vi.mock("@/lib/request-limits", async original => ({...await original<typeof import("./request-limits")>(), consumeLimit: mocks.limit}));
vi.mock("@/lib/telemetry-store", () => ({writeTelemetry: mocks.write}));
import { POST } from "@/app/api/telemetry/route";
beforeEach(() => {mocks.limit.mockReset().mockResolvedValue(true);mocks.write.mockReset().mockResolvedValue(undefined);});
const request = (body: string, origin = "https://lhl-76.ru") => new Request("https://lhl-76.ru/api/telemetry", {method:"POST", headers:{origin, host:"lhl-76.ru", "Content-Type":"application/json"}, body});
it("rejects third-party submission without writing", async () => {
  expect((await POST(request('{}', 'https://other.example'))).status).toBe(403);
  expect(mocks.write).not.toHaveBeenCalled();
});
it("enforces body and rate limits", async () => {
  expect((await POST(request('x'.repeat(1025)))).status).toBe(400);
  mocks.limit.mockResolvedValue(false);
  expect((await POST(request('{}'))).status).toBe(429);
  expect(mocks.write).not.toHaveBeenCalled();
});
it("stores only whitelisted anonymous fields", async () => {
  expect((await POST(request(JSON.stringify({metric:'LCP', value:1500, route:'/player/secret?email=private', cookie:'secret'})))).status).toBe(204);
  expect(mocks.write).toHaveBeenCalledWith([{kind:'vital',metric:'LCP',value:1500,route:'/player/[slug]'}]);
});
