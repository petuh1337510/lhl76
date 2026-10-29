import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/public/assets/[...path]/route";

const route = (parts: string[], headers?: HeadersInit) => GET(new NextRequest("http://localhost/api/public/assets/test", { headers }), { params: Promise.resolve({ path: parts }) });
describe("public runtime assets", () => {
  it("serves only the permitted public directories", async () => {
    expect((await route(["..", ".env.local"])).status).toBe(404);
    expect((await route(["images", "lhl76-logo.jpg"])).status).toBe(404);
    expect((await route(["uploads", "..", "secret.jpg"])).status).toBe(404);
    expect((await route(["uploads", "general", "test.html"])).status).toBe(404);
  });
  it("returns immutable WebP and supports conditional requests and byte ranges", async () => {
    const parts = ["images", "optimized", "hero-hockey-258d60f1efb5.webp"];
    const response = await route(parts);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    const bytes = await response.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect((await route(parts, { "if-none-match": response.headers.get("etag")! })).status).toBe(304);
    const partial = await route(parts, { range: "bytes=0-9" });
    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(10);
    expect((await route(parts, { range: "bytes=999999999-" })).status).toBe(416);
  });
});
