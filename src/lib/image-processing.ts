import sharp from "sharp";

const inputOptions = { limitInputPixels: 40_000_000, failOn: "error" as const, animated: true };

/** Validate bytes, normalize EXIF orientation, retain the source separately. */
export async function prepareImage(buffer: Buffer) {
  const metadata = await sharp(buffer, inputOptions).metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "gif"].includes(metadata.format || "")) {
    throw new Error("Неподдерживаемое изображение");
  }
  // Decode all frames; WebP retains their timing, loop count and transparency.
  // EXIF orientation applies to still photos, not a vertically stacked animation.
  const image = sharp(buffer, inputOptions);
  if ((metadata.pages || 1) === 1) image.rotate();
  const [display, thumbnail] = await Promise.all([
    image.clone().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(),
    image.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { display, thumbnail };
}
