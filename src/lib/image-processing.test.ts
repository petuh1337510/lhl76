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
  it.each(["gif", "webp"] as const)("converts animated %s without losing frames or timing", async (format) => {
    const width = 600, height = 300;
    const red = Buffer.alloc(width * height * 3);
    const blue = Buffer.alloc(width * height * 3);
    for (let index = 0; index < red.length; index += 3) { red[index] = 255; blue[index + 2] = 255; }
    const input = sharp(Buffer.concat([red, blue]), { raw: { width, height: height * 2, channels: 3, pageHeight: height } });
    const options = { delay: [100, 240], loop: 3 };
    const original = await (format === "gif" ? input.gif(options) : input.webp(options)).toBuffer();
    const copy = Buffer.from(original);
    const result = await prepareImage(original);
    expect(original.equals(copy)).toBe(true);
    expect(await sharp(result.display, { animated: true }).metadata()).toMatchObject({ format: "webp", pages: 2, pageHeight: 300, width: 600, delay: [100, 240], loop: 3 });
    expect(await sharp(result.thumbnail, { animated: true }).metadata()).toMatchObject({ format: "webp", pages: 2, pageHeight: 240, width: 480, delay: [100, 240], loop: 3 });
    const first = await sharp(result.display, { page: 0 }).stats();
    const second = await sharp(result.display, { page: 1 }).stats();
    expect(first.channels[0].mean).toBeGreaterThan(first.channels[2].mean + 150);
    expect(second.channels[2].mean).toBeGreaterThan(second.channels[0].mean + 150);
  });
});
