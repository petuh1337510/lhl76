import { it, expect, vi } from "vitest";
import { mkdtemp, mkdir, readFile, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { desktopHeroSource } from "./hero-images";
it("prepares a reusable desktop banner without modifying the original", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lhl-hero-test-"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  try {
    await mkdir(path.join(root, "public/uploads"), { recursive: true });
    const originalPath = path.join(root, "public/uploads/banner.png");
    await sharp({ create: { width: 3000, height: 1200, channels: 3, background: "#123456" } }).png().toFile(originalPath);
    const original = await readFile(originalPath);
    const source = await desktopHeroSource("/uploads/banner.png");
    expect(source).toMatch(/^\/images\/optimized\/hero-desktop-[a-f0-9]+\.webp$/);
    const output = path.join(root, "public", source!);
    expect(await sharp(await readFile(output)).metadata()).toMatchObject({ width: 1920, height: 768, format: "webp" });
    const before = await stat(output);
    expect(await desktopHeroSource("/uploads/banner.png")).toBe(source);
    expect((await stat(output)).mtimeMs).toBe(before.mtimeMs);
    expect(await readFile(originalPath)).toEqual(original);
    expect(await desktopHeroSource("https://example.com/remote.jpg")).toBe("https://example.com/remote.jpg");
  } finally {
    cwd.mockRestore();
    if (!root.startsWith(path.join(os.tmpdir(), "lhl-hero-test-"))) throw new Error("Unexpected fixture path");
    await rm(root, { recursive: true, force: true });
  }
});
