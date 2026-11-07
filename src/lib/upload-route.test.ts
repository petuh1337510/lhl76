import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";

const files = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock("fs/promises", async importOriginal => ({
  ...await importOriginal<typeof import("fs/promises")>(), ...files,
}));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
import { POST } from "@/app/api/admin/upload/route";

describe("image upload response", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each(["png", "jpeg", "webp", "gif"] as const)("returns WebP URLs for %s and retains original bytes", async (format) => {
    const input = sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } });
    const original = await input.toFormat(format).toBuffer();
    const form = new FormData();
    form.set("file", new File([new Uint8Array(original)], `upload-test.${format}`, { type: `image/${format}` }));
    form.set("kind", "media");
    const response = await POST(new NextRequest("http://localhost/api/admin/upload", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.url).toMatch(/^\/uploads\/media\/.+-display\.webp$/);
    expect(result.thumbnailUrl).toMatch(/^\/uploads\/media\/.+-thumb\.webp$/);
    expect(result.originalUrl).toContain("-original-upload-test.");
    expect(files.writeFile).toHaveBeenCalledTimes(3);
    const originalWrite = files.writeFile.mock.calls.find(([name]) => String(name).includes("-original-"));
    expect(originalWrite?.[1]).toEqual(original);
    for (const suffix of ["-display.webp", "-thumb.webp"]) {
      const write = files.writeFile.mock.calls.find(([name]) => String(name).endsWith(suffix));
      expect(await sharp(write![1]).metadata()).toMatchObject({ format: "webp", width: 80, height: 60 });
    }
  });

  it("does not write corrupt images", async () => {
    const form = new FormData();
    form.set("file", new File(["not an image"], "broken.png", { type: "image/png" }));
    const response = await POST(new NextRequest("http://localhost/api/admin/upload", { method: "POST", body: form }));
    expect(response.status).toBe(400);
    expect(files.writeFile).not.toHaveBeenCalled();
  });
});
