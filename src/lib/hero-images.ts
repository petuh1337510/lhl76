import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Crop before resizing: a very wide banner must not become blurry on a tall phone. */
export async function mobileHeroSource(source: string | null, mobile: string | null) {
  if (mobile || !source || !/^\/(uploads|images)\//.test(source)) return mobile;
  const root = path.resolve(process.cwd(), "public");
  const input = path.resolve(root, `.${source}`);
  if (!input.startsWith(root + path.sep)) return mobile;
  try {
    const original = await readFile(input);
    const hash = createHash("sha256").update(original).update("mobile-768x1080-v1").digest("hex").slice(0, 20);
    const relative = `/images/optimized/hero-mobile-${hash}.webp`;
    const destination = path.join(root, relative);
    try { await access(destination); return relative; } catch { /* Generate once per original. */ }
    const buffer = await sharp(original, { limitInputPixels: 40_000_000 }).rotate()
      .resize(768, 1080, { fit: "cover", position: "centre" }).webp({ quality: 84 }).toBuffer();
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, buffer);
    await rename(temporary, destination);
    return relative;
  } catch { return mobile; }
}
