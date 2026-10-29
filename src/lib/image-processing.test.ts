import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareImage } from "./image-processing";

describe("uploaded image processing", () => {
  it("produces bounded WebP derivatives without modifying the original", async () => {
    const original = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "red" } }).jpeg().toBuffer();
    const copy = Buffer.from(original);
    const result = await prepareImage(original);
    expect(original.equals(copy)).toBe(true);
    expect(result).not.toBeNull();
    expect(await sharp(result!.display).metadata()).toMatchObject({ format: "webp", width: 1920, height: 960 });
    expect(await sharp(result!.thumbnail).metadata()).toMatchObject({ width: 480, height: 240 });
  });
  it("does not upscale small images", async () => {
    const original = await sharp({ create: { width: 48, height: 64, channels: 4, background: "transparent" } }).png().toBuffer();
    const result = await prepareImage(original);
    expect(await sharp(result!.display).metadata()).toMatchObject({ width: 48, height: 64, hasAlpha: true });
  });
  it("rejects invalid image bytes", async () => {
    await expect(prepareImage(Buffer.from("not an image"))).rejects.toThrow();
  });
  it("normalizes EXIF orientation", async () => {
    const original = await sharp({ create: { width: 60, height: 100, channels: 3, background: "blue" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await prepareImage(original);
    expect(await sharp(result!.display).metadata()).toMatchObject({ width: 100, height: 60 });
  });
});
